# Consultant Accounts and Public Script Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each consultant a private recording workspace with Supabase email/password login and optional, revocable, read-only public script links.

**Architecture:** Supabase Auth issues cookie-based sessions; Next.js verifies the user on every private request. Drizzle repository methods scope browser-originated reads and writes by `ownerUserId`. A separate share token permits anonymous access only to a public script serializer and a screenshot streaming endpoint. The existing storage adapter and background pipeline stay server-side.

**Tech Stack:** Next.js 16.3.6, React 19, Supabase Auth and Storage, `@supabase/ssr`, Drizzle/Postgres, Zod, Vitest, Tailwind CSS 4.

## Global Constraints

- Use Supabase Auth with email and password only. Do not add social login, magic-link login, company SSO, or Row Level Security.
- Keep all recording and step data access in the existing Next.js server and Drizzle repository.
- Revoke Supabase Data API grants on application tables from `anon` and `authenticated`; the public share is served only by Next.js. This is ordinary SQL privilege control, not Row Level Security.
- A recording has one owner and is private by default. A public link shows a read-only script and screenshots, never the original video.
- One active public link per recording; revocation blocks the page and subsequent screenshot requests, and replacement uses a new token.
- Existing recording rows and their stored videos and screenshots are disposable test data and may be deleted. Preserve Auth users.
- `src/lib/config/env.ts` is the only application file that reads `process.env`; add variables there and in `.env.example`.
- Routes stay thin; database queries live in `src/lib/db/recordings-repository.ts`; Storage access stays behind `StorageAdapter`.
- Keep processing status in the database, preserve consultant-facing failure messages, and let failed screenshot capture degrade to a placeholder.
- Reuse `src/app/globals.css` tokens, light mode, shared focus ring, and loading/empty/error states. One component per file.
- Before coding, reread the installed Next.js 16 guides at `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, `01-getting-started/16-proxy.md`, `01-getting-started/15-route-handlers.md`, and `03-api-reference/04-functions/cookies.md`. These require `proxy.ts` in Next 16 and asynchronous `cookies()`.
- Before completing, run `npm run check` and exercise the real upload, edit, bad-file, two-user, public-link, and revoke flows.

## Current baseline and file map

The plan was prepared against `feat/recording-page-redesign` on 2026-09-23. Recheck `git status` before implementation because this branch is being edited concurrently. Existing recording routes include rename, insert/reorder step, evidence recapture, and frame preview; every one needs an ownership check.

| File or group | Responsibility |
| --- | --- |
| `src/lib/auth/server-client.ts`, `session.ts`, `proxy-session.ts`, `actions.ts`, `return-path.ts` | Supabase session creation, verification, refresh, account actions, safe redirects |
| `src/proxy.ts` | Next 16 session refresh entrypoint; never the sole authorization check |
| `src/app/(auth)/*`, `src/components/auth/*`, `src/app/auth/callback/route.ts` | Signup, login, verification, reset, recovery UI and callback |
| `src/lib/db/schema.ts`, `recordings-repository.ts`, `supabase/migrations/*` | Required owner, active share record, owner-scoped queries |
| `scripts/clear-test-recordings.ts` | One-time, explicit removal of existing test rows and storage objects |
| `src/app/api/recordings/*`, `src/app/api/steps/*`, private pages | Check verified user and use owner-scoped repository methods |
| `src/lib/sharing/*`, `src/app/api/recordings/[recordingId]/share/route.ts` | Create, retrieve, revoke share; public DTO |
| `src/app/share/[token]/*`, `src/components/sharing/*` | Read-only page and per-request screenshot access |
| `src/components/layout/site-header.tsx`, `src/components/recordings/recording-detail.tsx`, `src/app/page.tsx` | Account controls, share UI, focused workspace |

## Task 1: Supabase session foundation

**Files:** Modify `package.json`, `package-lock.json`, `.env.example`, `src/lib/config/env.ts`, `supabase/config.toml`; create `src/lib/auth/server-client.ts`, `src/lib/auth/session.ts`, `src/lib/auth/proxy-session.ts`, `src/proxy.ts`, `src/lib/auth/return-path.ts`, `src/lib/auth/return-path.test.ts`.

**Interfaces:** Produce `createAuthServerClient(): Promise<SupabaseClient>`, `getAuthenticatedUserId(): Promise<string | null>`, `requirePageUserId(returnPath: string): Promise<string>`, and `safeReturnPath(value: string | null): string`. Later tasks use only these helpers, not cookies directly.

- [ ] **Step 1: Write the redirect-safety test.** In `return-path.test.ts`, cover `/`, `/recordings/abc`, `//evil.example`, `https://evil.example`, `\\evil.example`, and an empty value. Expected safe values are the two local paths; every other value becomes `/`.

```ts
import { expect, it } from "vitest";
import { safeReturnPath } from "./return-path";

it.each([
  ["/", "/"],
  ["/recordings/abc", "/recordings/abc"],
  ["//evil.example", "/"],
  ["https://evil.example", "/"],
  ["\\evil.example", "/"],
  [null, "/"],
])("keeps auth redirects on this site: %s", (input, expected) => {
  expect(safeReturnPath(input)).toBe(expected);
});
```

- [ ] **Step 2: Confirm red.** Run `npm run test -- src/lib/auth/return-path.test.ts`; expect the missing-module failure.
- [ ] **Step 3: Install SSR support and add the required configuration.** Run `npm install @supabase/ssr`. Add `SUPABASE_PUBLISHABLE_KEY` and `APP_ORIGIN` to `.env.example` and the Zod schema in `env.ts`; `APP_ORIGIN` must be a URL such as `http://127.0.0.1:3000`. Set `auth.email.enable_confirmations = true`, `auth.minimum_password_length = 8`, and add `http://127.0.0.1:3000/auth/callback` to the redirect allowlist in `supabase/config.toml`. Restart local Supabase after changing Auth config. The local key comes from `supabase status`; hosted configuration must likewise enable email confirmation and permit the deployed callback URL.

```ts
// Add to environmentSchema in src/lib/config/env.ts
SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
APP_ORIGIN: z.string().url(),
```

- [ ] **Step 4: Implement the session helpers.** The server client uses the publishable key, `await cookies()`, and `getAll`/`setAll`; Server Components may be unable to write a refreshed cookie, so the setter catches that case and Proxy refreshes it. Use `getClaims()` rather than trusting `getSession()` for identity. `safeReturnPath` must reject protocol-relative and backslash paths.

```ts
// src/lib/auth/return-path.ts
export function safeReturnPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/";
}

// src/lib/auth/server-client.ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/config/env";

export async function createAuthServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set response cookies; Proxy refreshes them.
        }
      },
    },
  });
}

// src/lib/auth/session.ts
import { redirect } from "next/navigation";
import { createAuthServerClient } from "./server-client";
import { safeReturnPath } from "./return-path";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const { data, error } = await (await createAuthServerClient()).auth.getClaims();
  return error ? null : (data.claims?.sub ?? null);
}

export async function requirePageUserId(returnPath: string): Promise<string> {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  return userId;
}
```

- [ ] **Step 5: Add session refresh in `src/proxy.ts`.** Use the official Supabase `createServerClient` request-cookie/response-cookie pattern with `getClaims()`. Return the response carrying any refreshed cookies. Match application routes while excluding static assets. Set `Cache-Control: private, no-store` on responses that can carry auth cookies. Proxy only refreshes; each page and route still checks identity.

```ts
// src/lib/auth/proxy-session.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/config/env";

export async function updateAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// src/proxy.ts
import type { NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/auth/proxy-session";

export function proxy(request: NextRequest) {
  return updateAuthSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 6: Verify and commit.** Run `npm run test -- src/lib/auth/return-path.test.ts` and `npm run check`; expect pass. Commit only this task's files with `git commit -m "feat: add Supabase server sessions"`.

## Task 2: Consultant account screens and actions

**Files:** Create `src/lib/auth/actions.ts`, `src/lib/auth/auth-errors.ts`, `src/lib/auth/auth-errors.test.ts`, `src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `update-password/page.tsx`, `src/app/auth/callback/route.ts`, `src/components/auth/auth-shell.tsx`, `src/components/auth/auth-form.tsx`, `src/components/auth/auth-submit-button.tsx`; modify `src/components/layout/site-header.tsx`, `src/app/globals.css` only for new tokens if actually needed.

**Interfaces:** `loginAction`, `signupAction`, `requestPasswordResetAction`, `updatePasswordAction`, `logoutAction`; callback exchanges an Auth code for a cookie session. Action state is `{ error: string | null; success: string | null }`.

- [ ] **Step 1: Test consultant-facing error mapping.** Add table cases for `invalid_credentials`, `email_not_confirmed`, and generic service errors. The reset request result must never state whether an account exists.

```ts
import { expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

it.each([
  ["invalid_credentials", "Check your email and password, then try again."],
  ["email_not_confirmed", "Check your inbox and verify your email before signing in."],
  ["unexpected_failure", "We could not sign you in. Please try again."],
])("explains %s", (code, expected) => {
  expect(authErrorMessage(code)).toBe(expected);
});
```

- [ ] **Step 2: Confirm red.** Run `npm run test -- src/lib/auth/auth-errors.test.ts`; expect the missing-module failure.
- [ ] **Step 3: Implement account actions.** Validate trimmed email and password with Zod; signup/update require at least eight characters, matching Supabase config. `signupAction` calls `auth.signUp({ email, password, options: { emailRedirectTo: `${env.APP_ORIGIN}/auth/callback` } })`; show “Check your inbox” on success. `loginAction` calls `signInWithPassword`, then redirects to `safeReturnPath(next)`. `requestPasswordResetAction` calls `resetPasswordForEmail` with callback `?next=/update-password` and always gives neutral success feedback. `updatePasswordAction` calls `updateUser({ password })`; `logoutAction` calls `signOut()` then redirects to `/login`. Never log passwords or raw Auth tokens.

```ts
// Core action pattern in src/lib/auth/actions.ts
"use server";
const client = await createAuthServerClient();
const { error } = await client.auth.signInWithPassword({ email, password });
if (error) return { error: authErrorMessage(error.code), success: null };
redirect(safeReturnPath(formData.get("next")?.toString() ?? null));

// The remaining Supabase calls in their named actions:
await client.auth.signUp({ email, password, options: {
  emailRedirectTo: `${env.APP_ORIGIN}/auth/callback`,
} });
await client.auth.resetPasswordForEmail(email, {
  redirectTo: `${env.APP_ORIGIN}/auth/callback?next=/update-password`,
});
await client.auth.updateUser({ password });
await client.auth.signOut();
```

- [ ] **Step 4: Implement callback and pages.** `GET /auth/callback` reads `code`, exchanges it with `auth.exchangeCodeForSession(code)`, validates `next` through `safeReturnPath`, and redirects. On error it redirects to `/login?error=expired-link`. The four account pages use `AuthShell` and the client `AuthForm` with labeled inputs, `useActionState` and `useFormStatus` for pending states, links between login/signup/reset, and clear success/error text. The password-update page requires a valid recovery session. Do not import the service-role storage client into any account component.

```ts
// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createAuthServerClient } from "@/lib/auth/server-client";
import { safeReturnPath } from "@/lib/auth/return-path";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=expired-link", request.url));
  const { error } = await (await createAuthServerClient()).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=expired-link", request.url));
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(next, request.url));
}

// src/components/auth/auth-submit-button.tsx
"use client";
import { useFormStatus } from "react-dom";
export function AuthSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="h-10 rounded-[var(--radius-control)] bg-accent-500 px-4 text-white disabled:opacity-60">{pending ? "Working…" : label}</button>;
}
```
- [ ] **Step 5: Verify actual Auth flow and commit.** Run focused tests and `npm run check`. With local Supabase running, sign up, open the email in Inbucket at `http://127.0.0.1:54324`, verify, log in, log out, request password reset, and update password. Commit with `git commit -m "feat: add consultant signup and login"`.

## Task 3: Ownership schema, cleanup, and repository

**Files:** Modify `src/lib/db/schema.ts`, `src/lib/types/process-step.ts`, `src/lib/db/recordings-repository.ts`, `src/lib/storage/supabase-storage.ts`, `README.md`; create the next Drizzle migration and `scripts/clear-test-recordings.ts`.

**Interfaces:** Browser-facing repository methods require `ownerUserId`: `createRecording({ ownerUserId, ... })`, `listRecordings(ownerUserId)`, `findRecording(recordingId, ownerUserId)`, `findRecordingWithSteps(recordingId, ownerUserId)`, and owner-scoped rename/delete/step methods. Pipeline-only methods remain internal and keyed by an already-owned recording ID.

- [ ] **Step 1: Add a failing two-owner integration check.** Use local Supabase Auth admin to create two fixture users, create one recording for each, and assert each `listRecordings(userId)` returns only its own rows; `findRecording(otherId, userId)` returns null; owner-scoped step update/delete/reorder/insert/evidence lookup reject a foreign step. Run it against disposable local Supabase only, with `node --env-file=.env.local --import tsx scripts/check-recording-ownership.ts`. Before implementation, expect the new `ownerUserId` interface or column to fail.

```ts
// Key assertions in scripts/check-recording-ownership.ts, with two fixture Auth user IDs
const ownedByA = await createRecording({
  ownerUserId: ownerA, title: "Owner A", originalFileName: "a.mp4",
  videoPath: "test/a.mp4", durationSeconds: 1,
});
assert((await listRecordings(ownerA)).some((row) => row.id === ownedByA.id));
assert(!(await listRecordings(ownerB)).some((row) => row.id === ownedByA.id));
assert.equal(await findRecording(ownedByA.id, ownerB), null);
```
- [ ] **Step 2: Make storage removal report failures.** The existing adapter ignores `{ error }` from Supabase Storage. Change it to throw on an error so the cleanup script never silently leaves files behind.

```ts
const { error } = await this.client.storage.from(bucket).remove(paths);
if (error) throw new Error(`Could not remove stored files: ${error.message}`);
```

- [ ] **Step 3: Write and run the explicit one-time cleanup.** Add `listLegacyRecordingAssets(): Promise<Array<{ recordingId: string; videoPath: string; screenshotPaths: string[] }>>` and `deleteLegacyRecording(recordingId: string): Promise<void>` to the repository while the old schema is still active. The script uses those functions to remove stored objects, then rows. Guard it with a required `--delete-test-recordings` argument, print row/object counts, and stop on any storage error. Run `node --env-file=.env.local --import tsx scripts/clear-test-recordings.ts --delete-test-recordings` against the authorized development database; confirm zero recording rows before migrating. Do not touch Auth users or other buckets. Make it refuse to run after `owner_user_id` exists, so it cannot later remove real account data.

```ts
// Core of scripts/clear-test-recordings.ts
if (!process.argv.includes("--delete-test-recordings")) {
  throw new Error("Pass --delete-test-recordings to remove the old test data.");
}
for (const item of await listLegacyRecordingAssets()) {
  await storage.remove({ bucket: STORAGE_BUCKETS.recordings, paths: [item.videoPath] });
  await storage.remove({ bucket: STORAGE_BUCKETS.screenshots, paths: item.screenshotPaths });
  await deleteLegacyRecording(item.recordingId);
}
```
- [ ] **Step 4: Add the owner column and migration.** Add `ownerUserId: uuid("owner_user_id").notNull()` and an `(owner_user_id, created_at)` index. Generate the Drizzle migration after cleanup, then add only the SQL foreign key and grant revocations shown below if the generator did not emit them. Auth owns `auth.users`; do not generate or manage that table with Drizzle. Apply with `npm run db:migrate`. Ensure the migration does not recreate `auth.users` or enable RLS.

```sql
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_owner_user_id_auth_users_id_fk"
  FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");
REVOKE ALL ON TABLE "recordings", "process_steps" FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 5: Scope repository queries.** Add `ownerUserId` to the `Recording` type and row mapper. Every externally callable `SELECT`, `UPDATE`, and `DELETE` uses `and(eq(recordings.id, recordingId), eq(recordings.ownerUserId, ownerUserId))`. Step operations use an owner-qualified join or subquery through `recordings`; reject foreign IDs before storage or FFmpeg work. Reorder validates that the provided IDs are exactly the recording's current step IDs, with no duplicates, before updating positions. `insertStepAfter` rejects an `afterStepId` outside the owned recording. Distinguish internal pipeline functions in naming and documentation so routes cannot call them as an authorization shortcut.

```ts
// Representative owner-scoped read
.where(and(eq(recordings.id, recordingId), eq(recordings.ownerUserId, ownerUserId)))

// Representative step ownership condition
inArray(
  processSteps.recordingId,
  db.select({ id: recordings.id }).from(recordings)
    .where(eq(recordings.ownerUserId, ownerUserId)),
)
```

- [ ] **Step 6: Verify and commit.** Run the two-owner integration check, `npm run db:migrate`, and `npm run check`; expect all pass. Also call Supabase's `/rest/v1/recordings?select=id` and `/rest/v1/process_steps?select=id` with the publishable key as both an anonymous and authenticated API client; each request must fail with a privilege error. Commit with `git commit -m "feat: assign recordings to consultants"`.

## Task 4: Protect every private page and API

**Files:** Modify `src/app/page.tsx`, `src/app/recordings/[recordingId]/page.tsx`, `src/app/api/recordings/route.ts`, `src/app/api/recordings/[recordingId]/route.ts`, `src/app/api/recordings/[recordingId]/retry/route.ts`, `src/app/api/recordings/[recordingId]/steps/route.ts`, `src/app/api/steps/[stepId]/route.ts`, `src/app/api/steps/[stepId]/evidence/route.ts`, `src/app/api/steps/[stepId]/frames/route.ts`, and any route added to these groups while this branch evolves.

**Interfaces:** Private API response without a verified session is 401. A resource belonging to another user gives 404. Private pages redirect to `/login` or show not-found as appropriate.

- [ ] **Step 1: Write an HTTP integration matrix before editing routes.** For ID-specific methods, assert anonymous 401, owner success, and second user 404. The matrix includes `GET/PATCH/DELETE /api/recordings/[recordingId]`; retry `POST`; step insert `POST` and reorder `PATCH`; step `PATCH/DELETE`; evidence `PUT`; and frame preview `GET`. For `GET /api/recordings`, each signed-in user gets 200 with only their own rows; for upload `POST`, either signed-in user creates a recording belonging only to them. Both return 401 anonymously. For page requests, assert login redirect and private 404. Include a foreign step ID in an owned recording's reorder body and ensure no positions change. Use Vitest route tests that mock session and repository boundaries for the fast red/green cycle, plus the two-account live flow in Task 7.

```ts
// Representative case for src/app/api/recordings/[recordingId]/route.test.ts
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUserId: vi.fn() }));
vi.mock("@/lib/db/recordings-repository", () => ({ findRecordingWithSteps: vi.fn() }));
it("rejects an anonymous detail request before reading data", async () => {
  vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
  const response = await GET(new NextRequest("http://localhost/api/recordings/a"), {
    params: Promise.resolve({ recordingId: "a" }),
  });
  expect(response.status).toBe(401);
  expect(findRecordingWithSteps).not.toHaveBeenCalled();
});
```
- [ ] **Step 2: Confirm the matrix fails against the current unprotected routes.** Run the integration script with both authenticated cookie jars and an anonymous jar; expect cross-user requests to succeed unexpectedly until this task is implemented.
- [ ] **Step 3: Add per-request verification.** Resolve `getAuthenticatedUserId()` at the start of every route, before upload, storage, FFmpeg, or DB access. Return `apiError("Sign in to continue.", 401)` when null. Pass the verified ID to owner-scoped repository methods. In pages, call `requirePageUserId` and query by owner ID; metadata must not reveal a foreign script title. Return 404 on a missing or foreign resource.

```ts
const ownerUserId = await getAuthenticatedUserId();
if (!ownerUserId) return apiError("Sign in to continue.", 401);
const recording = await findRecording(recordingId, ownerUserId);
if (!recording) return apiError("This recording does not exist.", 404);
```

- [ ] **Step 4: Preserve pipeline and storage boundaries.** Upload writes `ownerUserId` from the verified session. Retry checks ownership before calling internal status update; evidence and frame preview check the parent recording before downloading video. Deletion checks ownership before removing storage. No browser request can call an internal repository method without an owner check.

```ts
// In upload, after verified owner ID and before processRecording:
const recording = await createRecording({
  ownerUserId, title, originalFileName, videoPath, durationSeconds,
});
// In both evidence and frame-preview routes, before withLocalVideo:
const found = await findStepWithRecording(stepId, ownerUserId);
if (!found) return apiError("This step does not exist.", 404);
```
- [ ] **Step 5: Verify and commit.** Run the HTTP matrix and `npm run check`; expect all pass. Commit with `git commit -m "feat: enforce private recording access"`.

## Task 5: Revocable public sharing backend

**Files:** Modify `src/lib/db/schema.ts`, `src/lib/db/recordings-repository.ts`; create the next migration, `src/lib/sharing/public-recording.ts`, `src/lib/sharing/public-recording.test.ts`, `src/app/api/recordings/[recordingId]/share/route.ts`, `src/app/share/[token]/page.tsx`, `src/app/share/[token]/screenshots/[stepId]/route.ts`.

**Interfaces:** `findShareForOwner(recordingId, ownerUserId)`, `createShareForOwner(recordingId, ownerUserId)`, `revokeShareForOwner(recordingId, ownerUserId)`, `findPublicRecordingByToken(token)`, and `findPublicScreenshotByToken(token, stepId)`. Public DTO contains only `title`, `status`, and ordered step presentation fields plus app-local screenshot routes.

- [ ] **Step 1: Write a public DTO test before implementation.** Given a recording with `videoPath`, `originalFileName`, `ownerUserId`, `errorMessage`, and steps, assert the public DTO has `title`, `status`, steps, and `/share/<token>/screenshots/<stepId>` URLs but none of the private fields. Test a step with no screenshot returns `null` URL. Assert that step DTOs also omit `screenshotPath` and `recordingId`.

```ts
expect(JSON.stringify(publicRecording)).not.toMatch(
  /videoPath|originalFileName|ownerUserId|errorMessage|screenshotPath|recordingId/,
);
expect(publicRecording.steps[0].screenshotUrl)
  .toBe(`/share/${token}/screenshots/${stepId}`);
```

- [ ] **Step 2: Confirm red.** Run `npm run test -- src/lib/sharing/public-recording.test.ts`; expect the missing-module failure.
- [ ] **Step 3: Add the share table and repository operations.** Create `recording_public_shares` with `recording_id` as its primary key and cascading FK to recordings, unique `token`, and `created_at`. Generate/apply a migration, adding `REVOKE ALL ON TABLE "recording_public_shares" FROM PUBLIC, anon, authenticated;` so its tokens cannot be read through the Supabase Data API. Tokens come from `randomBytes(32).toString("base64url")`. `POST` is idempotent for an existing share; `DELETE` removes the row. Queries join recordings for owner checks. Public lookup uses only token and returns no video path in its DTO. Concurrent POSTs return the one active share instead of 500.

```ts
export const recordingPublicShares = pgTable("recording_public_shares", {
  recordingId: uuid("recording_id").primaryKey()
    .references(() => recordings.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// In the repository, on create after confirming owner access:
const token = randomBytes(32).toString("base64url");
const [created] = await db.insert(recordingPublicShares)
  .values({ recordingId, token }).onConflictDoNothing().returning();
return created ?? await findShareForOwner(recordingId, ownerUserId);
```

- [ ] **Step 4: Add owner-only management and public endpoints.** `GET/POST/DELETE /api/recordings/[recordingId]/share` require a verified owner; return 401/404 as in Task 4. `GET /share/[token]` needs no session, returns a read-only page using the public DTO, `robots: { index: false, follow: false }`, and dynamic/no-store behavior. Invalid or revoked token uses the neutral unavailable-link UI. `GET /share/[token]/screenshots/[stepId]` verifies both the active token and that the step belongs to that recording, downloads through `StorageAdapter`, and responds as `image/png` with `Cache-Control: no-store`; missing screenshots get 404. Do not redirect to a signed Storage URL, because that would remain usable after revoke.

```ts
const found = await findPublicScreenshotByToken(token, stepId);
if (!found?.screenshotPath) return new Response(null, { status: 404 });
const body = await storage.download({
  bucket: STORAGE_BUCKETS.screenshots,
  path: found.screenshotPath,
});
return new Response(new Uint8Array(body), {
  headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
});
```

- [ ] **Step 5: Test share behavior with two users.** Owner creates and retrieves link; second user cannot view/manage it through the private API; anonymous visitor can view page and screenshot but not edit or reach video; revoke makes page and screenshot return 404; replacement token differs and old token stays invalid. Assert direct Supabase Data API access to `recording_public_shares` fails with a privilege error. Run focused tests, the HTTP integration check, and `npm run check`; expect pass. Commit with `git commit -m "feat: add revocable public script links"`.

## Task 6: Share controls and consultant-focused workspace

**Files:** Create `src/components/sharing/share-controls.tsx`, `src/components/sharing/public-script.tsx`; modify `src/components/recordings/recording-detail.tsx`, `src/components/layout/site-header.tsx`, `src/app/page.tsx`, `src/components/upload/hero.tsx`, `src/lib/api/client.ts`, `src/app/globals.css` only if a missing reusable token is needed.

**Interfaces:** `ShareControls({ recordingId, initialShareUrl })` manages create/copy/revoke and rolls back on failure. `PublicScript({ recording })` renders only public DTO data and no edit props.

- [ ] **Step 1: Add share API client calls.** `fetchShare(recordingId)`, `createShare(recordingId)`, and `revokeShare(recordingId)` use the existing `requestJson` wrapper and return `{ url: string | null }` or `{ revoked: true }`; the API returns a same-origin `/share/<token>` URL. Never put `ownerUserId` in request bodies.

```ts
export const fetchShare = (recordingId: string) =>
  requestJson<{ url: string | null }>(`/api/recordings/${recordingId}/share`, { cache: "no-store" });
export const createShare = (recordingId: string) =>
  requestJson<{ url: string }>(`/api/recordings/${recordingId}/share`, { method: "POST" });
export const revokeShare = (recordingId: string) =>
  requestJson<{ revoked: true }>(`/api/recordings/${recordingId}/share`, { method: "DELETE" });
```
- [ ] **Step 2: Add the share control.** Keep one client component with `isCreatingShare`, `isRevokingShare`, `isCopyingLink`, `shareUrl`, and `errorMessage`. Use optimistic revoke with rollback, as `use-step-editing.ts` does. Show who can view the link, a selectable URL, Copy link, and Revoke link. A failed clipboard write tells the consultant to select/copy the URL manually. Include `aria-live` feedback and keep the shared focus ring.

```tsx
// Core revoke behavior in ShareControls
async function handleRevoke() {
  const previousUrl = shareUrl;
  setShareUrl(null);
  setIsRevokingShare(true);
  try {
    await revokeShare(recordingId);
  } catch {
    setShareUrl(previousUrl);
    setErrorMessage("The link is still active. Please try revoking it again.");
  } finally {
    setIsRevokingShare(false);
  }
}
```
- [ ] **Step 3: Update account header and workspace.** The server-rendered header calls Supabase `auth.getUser()` for the current email and shows Logout; preserve the orange New script action. The owner script page passes `findShareForOwner(recordingId, ownerUserId)` to `ShareControls` as `initialShareUrl`. The home page lists only owner recordings, keeps upload prominent, and reduces marketing-heavy hero copy. Account pages and public page reuse the same ink/orange tokens and responsive spacing. The public component renders title, status, ordered steps, and screenshots without edit handlers or private recording metadata.

```tsx
// Data passed to the private page and public component
const ownerUserId = await requirePageUserId(`/recordings/${recordingId}`);
const recording = await findRecordingWithSteps(recordingId, ownerUserId);
if (!recording) notFound();
const share = await findShareForOwner(recordingId, ownerUserId);
return <RecordingDetail initialRecording={await serializeRecording(recording)}
  initialShareUrl={share ? `/share/${share.token}` : null} />;
```
- [ ] **Step 4: Verify interactions and commit.** Check desktop and mobile widths, keyboard traversal, empty workspace, pending actions, failure feedback, public page, and owner page. Run `npm run check`; expect pass. Commit with `git commit -m "feat: add consultant account and sharing UI"`.

## Task 7: End-to-end validation and release notes

**Files:** Modify `README.md` and `.env.example` only if Task 1 did not finish setup documentation; add a short manual verification record under `docs/` if useful. No new implementation code unless a concrete failure is found.

- [ ] **Step 1: Recheck the entire spec.** Match every acceptance criterion in `docs/superpowers/specs/2026-09-23-consultant-accounts-and-public-script-sharing-design.md` to a passing test or observed UI action. Check all current `src/app/api/recordings/**` and `src/app/api/steps/**` files for missing session checks, including routes added after this plan was written.
- [ ] **Step 2: Run the required command.** Run `npm run check`; expected exit 0 with typecheck, lint, and Vitest all passing. Run the ownership/share HTTP integration checks against local Supabase.
- [ ] **Step 3: Exercise the real flow.** Create two accounts, verify emails, log in separately, upload a small valid video, observe analyzing → capturing → ready, edit/reorder a step, try a bad file, test private cross-user reads and writes, create/copy/open/revoke a public link, and confirm the raw video remains inaccessible. Confirm status survives reload and missing frame degrades to a placeholder.
- [ ] **Step 4: Review the diff and document setup.** Explain publishable key, callback URLs, email confirmation, local Inbucket, FFmpeg, migration ordering, and public-link behavior in `README.md`. Check `git diff --check`, then commit any verification fixes or docs separately. Report actual test results and any remaining limitations.

## Plan self-review

- The ownership matrix covers the current rename, insert, reorder, evidence, and frame-preview routes as well as the original upload, detail, retry, edit, and delete routes.
- The public serializer and screenshot stream have no path to source video data. Share revocation invalidates subsequent page and screenshot requests.
- The cleanup is explicitly authorized for existing test recordings and is sequenced before the required owner column. No Auth users or other buckets are removed.
- Supabase Auth is the only authentication system; authorization stays in Next.js and Drizzle. No RLS task appears.
