# Login na raiz e workspace em `/dashboard` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir login em `/`, redirecionar usuários autenticados para `/dashboard` e mover a home privada atual para essa rota sem duplicar a implementação de autenticação.

**Architecture:** A página raiz decide entre renderizar o login e redirecionar para o dashboard. O workspace atual será movido para `src/app/dashboard/page.tsx`; páginas e APIs privadas continuarão validando a sessão no servidor. A sessão será atualizada pelo `src/proxy.ts`, mas a autorização permanecerá explícita em cada página e handler.

**Tech Stack:** Next.js 16.3.6 App Router, React 19, Supabase Auth via `@supabase/ssr`, TypeScript, Vitest, Tailwind CSS 4.

## Global Constraints

- `src/lib/config/env.ts` é o único lugar que lê `process.env`.
- O proxy atualiza cookies, mas nunca substitui a validação de autorização em páginas e APIs.
- `safeReturnPath` rejeita destinos externos, caminhos iniciados por `//` e barras invertidas.
- O destino padrão após autenticação é `/dashboard`.
- A tela de login existe somente em `/`; `/login` é compatibilidade e redireciona para `/`.
- `/share/[token]` continua anônimo e não deve ser redirecionado para login.
- O workspace continua light-only, usa os tokens de `src/app/globals.css` e preserva estados de loading, vazio e erro.
- Antes de escrever código, ler as guias instaladas do Next.js 16 para autenticação, proxy, route handlers e cookies em `node_modules/next/dist/docs/`, conforme `AGENTS.md`.

## Pré-requisito e interfaces existentes

Este plano é o ajuste de rotas da implementação de contas descrita em
`docs/superpowers/plans/2026-09-23-consultant-accounts-and-public-script-sharing.md`.
Ele usa estas interfaces, que devem existir quando o plano for executado:

- `createAuthServerClient(): Promise<SupabaseClient>` em `src/lib/auth/server-client.ts`.
- `getAuthenticatedUserId(): Promise<string | null>` em `src/lib/auth/session.ts`.
- `requirePageUserId(returnPath: string): Promise<string>` em `src/lib/auth/session.ts`.
- `safeReturnPath(value: string | null): string` em `src/lib/auth/return-path.ts`.
- `loginAction`, `signupAction`, `requestPasswordResetAction`, `updatePasswordAction` e `logoutAction` em `src/lib/auth/actions.ts`.
- `AuthShell` e `AuthForm` em `src/components/auth/`; `AuthForm` aceita
  `mode: "login"`, `next: string | null` e `initialError: string | null`.

Se a implementação de contas ainda não tiver sido executada, primeiro aplique
as tarefas de fundação e conta desse plano existente; as tarefas abaixo são a
alteração de caminho aprovada neste design.

---

### Task 1: Centralizar destinos de autenticação e escrever os testes de rota

**Files:**
- Modify: `src/lib/auth/return-path.ts`
- Modify: `src/lib/auth/session.ts`
- Create: `src/lib/auth/route-destinations.ts`
- Modify: `src/lib/auth/return-path.test.ts`
- Create: `src/lib/auth/route-destinations.test.ts`

**Interfaces:**
- Produces `LOGIN_PATH = "/"`, `DASHBOARD_PATH = "/dashboard"`, `safeReturnPath(value)` e `getPostLoginPath(value)`.
- `requirePageUserId(returnPath)` redireciona visitantes para `/?next=...`.

- [ ] **Step 1: Escrever os testes de destino seguro.**

```ts
// src/lib/auth/route-destinations.test.ts
import { describe, expect, it } from "vitest";

import { DASHBOARD_PATH, LOGIN_PATH, getPostLoginPath } from "./route-destinations";

describe("authentication route destinations", () => {
  it("uses the root route as login and dashboard as the private home", () => {
    expect(LOGIN_PATH).toBe("/");
    expect(DASHBOARD_PATH).toBe("/dashboard");
  });

  it.each([
    [null, "/dashboard"],
    ["", "/dashboard"],
    ["/", "/dashboard"],
    ["/recordings/abc", "/recordings/abc"],
    ["//evil.example", "/dashboard"],
    ["https://evil.example", "/dashboard"],
    ["\\\\evil.example", "/dashboard"],
  ])("maps %s to %s after login", (next, expected) => {
    expect(getPostLoginPath(next)).toBe(expected);
  });
});
```

- [ ] **Step 2: Executar o teste para confirmar a falha.**

Run: `npm run test -- src/lib/auth/route-destinations.test.ts`

Expected: FAIL because `route-destinations.ts` and `getPostLoginPath` do not
exist yet.

- [ ] **Step 3: Implementar as constantes e o destino pós-login.**

Keep the existing public `safeReturnPath` in `src/lib/auth/return-path.ts` as
the single implementation of validation and import it here; do not maintain a
second validator:

```ts
// src/lib/auth/route-destinations.ts
import { safeReturnPath } from "./return-path";

export const LOGIN_PATH = "/";
export const DASHBOARD_PATH = "/dashboard";

export function getPostLoginPath(next: string | null): string {
  const safePath = safeReturnPath(next);
  return safePath === LOGIN_PATH ? DASHBOARD_PATH : safePath;
}
```

- [ ] **Step 4: Atualizar o guard de página para apontar para a raiz.**

```ts
// src/lib/auth/session.ts
import { redirect } from "next/navigation";

import { safeReturnPath } from "./return-path";
import { createAuthServerClient } from "./server-client";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const { data, error } = await (await createAuthServerClient()).auth.getClaims();
  return error ? null : (data.claims?.sub ?? null);
}

export async function requirePageUserId(returnPath: string): Promise<string> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect(`/?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  }
  return userId;
}
```

Use the actual existing session implementation as the base and change only the
redirect destination; preserve its `getClaims()` behavior and server-client
boundary.

- [ ] **Step 5: Executar os testes focados e o typecheck.**

Run: `npm run test -- src/lib/auth/return-path.test.ts src/lib/auth/route-destinations.test.ts`

Expected: PASS for the existing safety cases and all new root/dashboard cases.

Run: `npm run typecheck`

Expected: PASS with no unresolved auth imports.

- [ ] **Step 6: Commitar a unidade de destinos.**

```bash
git add src/lib/auth/return-path.ts src/lib/auth/session.ts src/lib/auth/route-destinations.ts src/lib/auth/return-path.test.ts src/lib/auth/route-destinations.test.ts
git commit -m "feat: centralize root login destinations"
```

---

### Task 2: Tornar `/` a única tela de login e preservar `/login`

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/login/page.tsx`
- Modify: `src/lib/auth/actions.ts`
- Modify: `src/app/auth/callback/route.ts`
- Test: `src/lib/auth/route-destinations.test.ts`

**Interfaces:**
- `/` renderiza `AuthShell`/`AuthForm` para visitantes e redireciona usuários autenticados para `DASHBOARD_PATH`.
- `/login` não renderiza formulário duplicado; redireciona para `/`, mantendo `next` quando presente.
- `loginAction` e o callback usam `getPostLoginPath(next)`.

- [ ] **Step 1: Escrever os testes de decisão da página raiz.**

Add a pure helper so the route decision can be tested without rendering
Supabase or Next server components:

```ts
// src/lib/auth/route-destinations.test.ts
import { getLandingPath } from "./route-destinations";

describe("root landing path", () => {
  it("sends an authenticated user to dashboard", () => {
    expect(getLandingPath(true)).toBe("/dashboard");
  });

  it("keeps an anonymous user at the login route", () => {
    expect(getLandingPath(false)).toBe("/");
  });
});
```

- [ ] **Step 2: Confirmar a falha do novo teste.**

Run: `npm run test -- src/lib/auth/route-destinations.test.ts`

Expected: FAIL because `getLandingPath` does not exist.

- [ ] **Step 3: Implementar a decisão pura e a página raiz.**

```ts
// src/lib/auth/route-destinations.ts
export function getLandingPath(isAuthenticated: boolean): string {
  return isAuthenticated ? DASHBOARD_PATH : LOGIN_PATH;
}
```

Move the login page's current form composition into the root page while
preserving its metadata, action state, error query handling, and links:

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { DASHBOARD_PATH } from "@/lib/auth/route-destinations";

export const metadata = {
  title: "Sign in · Luzid",
  description: "Sign in to create and manage your test scripts.",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/">) {
  if (await getAuthenticatedUserId()) redirect(DASHBOARD_PATH);

  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : null;
  const errorCode = typeof error === "string" ? error : null;
  return (
    <AuthShell>
      <AuthForm mode="login" next={nextPath} initialError={errorCode} />
    </AuthShell>
  );
}
```

Adapt the exact `AuthForm` prop names to the account implementation, but keep
the root page server-rendered and keep session lookup before private data access.

- [ ] **Step 4: Transform `/login` into a compatibility redirect.**

```tsx
// src/app/login/page.tsx
import { redirect } from "next/navigation";

export default async function LegacyLoginRedirect({
  searchParams,
}: PageProps<"/login">) {
  const { next } = await searchParams;
  const destination = next
    ? `/?next=${encodeURIComponent(next)}`
    : "/";
  redirect(destination);
}
```

Do not import `AuthForm` into this page. There must be exactly one login form.

- [ ] **Step 5: Update login action, callback, and logout destination.**

```ts
// src/lib/auth/actions.ts — relevant login behavior
import { getPostLoginPath } from "./route-destinations";

const next = formData.get("next")?.toString() ?? null;
redirect(getPostLoginPath(next));
```

```ts
// src/app/auth/callback/route.ts — relevant success behavior
const next = safeReturnPath(request.nextUrl.searchParams.get("next"));
return NextResponse.redirect(new URL(getPostLoginPath(next), request.url));
```

```ts
// src/lib/auth/actions.ts — logout behavior
await client.auth.signOut();
redirect("/");
```

Preserve the existing invalid-code and Auth error handling. Only successful
post-login and logout destinations change.

- [ ] **Step 6: Run focused tests and commit.**

Run: `npm run test -- src/lib/auth/route-destinations.test.ts src/lib/auth/auth-errors.test.ts`

Expected: PASS, including the existing account error mapping tests.

Run: `npm run typecheck`

Expected: PASS with the root page, redirect page, and auth callback typed for
Next.js 16 asynchronous `searchParams`.

```bash
git add src/app/page.tsx src/app/login/page.tsx src/app/'(auth)'/login/page.tsx src/lib/auth/actions.ts src/app/auth/callback/route.ts src/lib/auth/route-destinations.ts src/lib/auth/route-destinations.test.ts
git commit -m "feat: make root route the login screen"
```

---

### Task 3: Move the current workspace to `/dashboard`

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Modify: `src/components/layout/site-header.tsx`
- Modify: `src/components/layout/page-shell.tsx` only if dashboard navigation needs a route-specific prop
- Create: `src/app/dashboard/loading.tsx` if the current loading boundary is route-specific
- Create: `src/app/dashboard/error.tsx` if the dashboard needs a route-local failure boundary

**Interfaces:**
- `/dashboard` renders the existing `PageShell`, `Hero`, `UploadPanel`, and `RecordingList` composition.
- The page queries recordings only after `requirePageUserId("/dashboard")` returns the verified user.
- Header logo and “New script” links point to `/dashboard` and `/dashboard#upload`.

- [ ] **Step 1: Add a failing route composition check.**

Create a small pure route contract test that documents the new workspace URLs:

```ts
// src/lib/auth/route-destinations.test.ts
import { getDashboardLink, getNewScriptLink } from "./route-destinations";

describe("dashboard links", () => {
  it("uses dashboard as the workspace home", () => {
    expect(getDashboardLink()).toBe("/dashboard");
    expect(getNewScriptLink()).toBe("/dashboard#upload");
  });
});
```

- [ ] **Step 2: Confirmar a falha.**

Run: `npm run test -- src/lib/auth/route-destinations.test.ts`

Expected: FAIL because the dashboard link helpers do not exist.

- [ ] **Step 3: Implementar os links centralizados.**

```ts
// src/lib/auth/route-destinations.ts
export function getDashboardLink(): string {
  return DASHBOARD_PATH;
}

export function getNewScriptLink(): string {
  return `${DASHBOARD_PATH}#upload`;
}
```

- [ ] **Step 4: Criar o dashboard com a composição atual da home.**

```tsx
// src/app/dashboard/page.tsx
import { PageShell } from "@/components/layout/page-shell";
import { RecordingList } from "@/components/recordings/recording-list";
import { Hero } from "@/components/upload/hero";
import { UploadPanel } from "@/components/upload/upload-panel";
import { requirePageUserId } from "@/lib/auth/session";
import { listRecordings } from "@/lib/db/recordings-repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard · Luzid",
  description: "Create and manage editable test scripts.",
};

export default async function DashboardPage() {
  const userId = await requirePageUserId("/dashboard");
  const recordings = await listRecordings(userId);

  return (
    <PageShell>
      <div className="space-y-8">
        <Hero recordingCount={recordings.length} />
        <UploadPanel />
        <RecordingList recordings={recordings} />
      </div>
    </PageShell>
  );
}
```

Use the owner-scoped repository signature from the account plan. If ownership
has not yet been applied, keep the page call aligned with the repository
interface that will be introduced by that plan rather than reintroducing a
client-supplied user ID.

- [ ] **Step 5: Update the header navigation.**

```tsx
// src/components/layout/site-header.tsx — relevant links
<Link href="/dashboard" aria-label="Luzid">
  <Image src="/luzid-logo.svg" alt="Luzid" width={102} height={32} priority />
</Link>

<Link href="/dashboard#upload">New script</Link>
```

Preserve the existing focus ring, logo sizing, accent token, and responsive
layout. Do not leave any workspace CTA pointing to `/#upload`.

- [ ] **Step 6: Add route-local loading and failure states if needed.**

If the existing global `src/app/loading.tsx` already gives the dashboard a
usable loading state, reuse it. Otherwise add a dashboard boundary with an
actionable message:

```tsx
// src/app/dashboard/loading.tsx
export default function DashboardLoading() {
  return <p className="mx-auto w-full max-w-6xl px-6 py-10 text-ink-500">Loading your scripts…</p>;
}
```

Do not add a client-side in-memory job state; recording status remains in the
database and the existing polling hook remains unchanged.

- [ ] **Step 7: Run route checks and commit.**

Run: `npm run test -- src/lib/auth/route-destinations.test.ts`

Expected: PASS for dashboard and new-script links.

Run: `npm run typecheck`

Expected: PASS with no duplicate `src/app/page.tsx` route and no stale
workspace links.

```bash
git add src/app/page.tsx src/app/dashboard/page.tsx src/app/dashboard/loading.tsx src/app/dashboard/error.tsx src/components/layout/site-header.tsx src/components/layout/page-shell.tsx src/lib/auth/route-destinations.ts src/lib/auth/route-destinations.test.ts
git commit -m "feat: move workspace to dashboard"
```

---

### Task 4: Protect private pages and update route-aware links

**Files:**
- Modify: `src/app/recordings/[recordingId]/page.tsx`
- Modify: `src/app/api/recordings/route.ts`
- Modify: `src/app/api/recordings/[recordingId]/route.ts`
- Modify: `src/app/api/recordings/[recordingId]/retry/route.ts`
- Modify: `src/app/api/recordings/[recordingId]/steps/route.ts`
- Modify: `src/app/api/steps/[stepId]/route.ts`
- Modify: `src/app/api/steps/[stepId]/evidence/route.ts`
- Modify: `src/app/api/steps/[stepId]/frames/route.ts`
- Modify: `src/components/recordings/recording-list.tsx` if it contains a home link
- Modify: `src/components/recordings/recording-detail.tsx` if it contains a home or new-script link

**Interfaces:**
- Private pages call `requirePageUserId` before repository access.
- Private APIs call `getAuthenticatedUserId` before upload, storage, FFmpeg, or database work and return `401` anonymously.
- Foreign resources remain indistinguishable from missing resources (`404`).
- Public share routes, when present, do not call the private guard.

- [ ] **Step 1: Write the redirect and authorization matrix.**

Add route-level tests or extend the existing route test files with these
assertions:

```ts
it("redirects an anonymous dashboard page request to root login", async () => {
  vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
  await requirePageUserId("/dashboard");
  expect(redirect).toHaveBeenCalledWith("/?next=%2Fdashboard");
});

it("returns 401 before reading a private API anonymously", async () => {
  vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
  const response = await GET(request, { params: Promise.resolve({ recordingId: "r1" }) });
  expect(response.status).toBe(401);
  expect(findRecordingWithSteps).not.toHaveBeenCalled();
});
```

Use the actual method and repository mocks from each route; do not assert a
specific database error for a foreign ID.

- [ ] **Step 2: Confirmar os testes contra as rotas atuais.**

Run: `npm run test -- src/app/api/recordings src/app/api/steps`

Expected: the new anonymous cases fail until each private route performs the
session check.

- [ ] **Step 3: Proteger a página de detalhe e escopar sua metadata.**

```tsx
// src/app/recordings/[recordingId]/page.tsx — relevant flow
const { recordingId } = await params;
const userId = await requirePageUserId(`/recordings/${recordingId}`);
const recording = await findRecordingWithSteps(recordingId, userId);

if (!recording) notFound();
```

Apply the same verified `userId` to `generateMetadata`; metadata must not query
or reveal a foreign recording title.

- [ ] **Step 4: Add the session guard to every private API.**

Use this exact ordering at the beginning of each handler, before request-body
parsing that could trigger upload work, repository reads, storage, or FFmpeg:

```ts
const userId = await getAuthenticatedUserId();
if (!userId) return apiError("Sign in to continue.", 401);
```

Then pass `userId` to owner-scoped repository methods. For ID-specific reads or
writes, map a missing result to `404`, never `403`, so another user's resource
is not disclosed. Keep route handlers thin and leave ownership logic in the
repository.

- [ ] **Step 5: Update internal links and verify public routes remain open.**

Replace every workspace link matching `href="/"` or `href="/#upload"` with
`/dashboard` or `/dashboard#upload`. Keep the public share page and its image
endpoint outside the private route guard.

Run: `rg -n 'href="/"|href="/#upload"|redirect\("/login|/login\?next' src`

Expected: only the intentional `/login` compatibility route and auth error
fallbacks remain; no workspace navigation points to the login screen.

- [ ] **Step 6: Run the private-route test suite and commit.**

Run: `npm run test -- src/app/api`

Expected: PASS for anonymous `401`, owner success, foreign `404`, and public
share access where those route tests exist.

```bash
git add src/app/recordings/'[recordingId]'/page.tsx src/app/api src/components/recordings src/lib/auth
git commit -m "feat: protect dashboard routes and update navigation"
```

---

### Task 5: Full verification and documentation alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-23-consultant-accounts-and-public-script-sharing.md` only if its route table still says login is `/login` or workspace is `/`
- Modify: `docs/superpowers/plans/2026-09-23-consultant-accounts-and-public-script-sharing.md` only if its implementation snippets still hard-code `/login` as the login screen or `/` as the workspace

**Interfaces:**
- Documentation describes `/` as login and `/dashboard` as the private workspace.
- The final verification command is `npm run check`.

- [ ] **Step 1: Update the README route description.**

Change the project layout entry from:

```text
│  ├─ page.tsx                     upload + list of scripts
```

to:

```text
│  ├─ page.tsx                     login screen and auth redirect
│  ├─ dashboard/page.tsx           private upload + list of scripts
```

Add the route summary near the project layout:

```md
The public entry route is `/`, which shows login to signed-out visitors and
redirects signed-in users to `/dashboard`. The dashboard owns the upload and
private script list. `/login` is kept as a compatibility redirect to `/`.
```

- [ ] **Step 2: Search documentation and code for stale route assumptions.**

Run: `rg -n 'login|/dashboard|href="/"|/#upload|workspace|home' README.md docs src`

Update only statements that describe the changed route contract. Do not rewrite
the public sharing or data-ownership requirements.

- [ ] **Step 3: Run static verification.**

Run: `npm run check`

Expected: TypeScript, ESLint, and all Vitest tests pass.

- [ ] **Step 4: Exercise the real flow.**

With local Supabase and the app running:

1. Open `/` signed out and confirm the login form is the first screen.
2. Open `/login` and confirm it lands on `/`.
3. Log in and confirm the browser lands on `/dashboard`.
4. Upload a valid video, confirm the dashboard list and status polling work.
5. Open a recording detail, log out, and confirm the next private request returns to `/?next=/recordings/recordingId`.
6. Log in again and confirm the saved destination opens after authentication.
7. Open a valid `/share/token` link signed out and confirm it remains public.
8. Try an invalid video and confirm the actionable failure message remains visible on `/dashboard`.

- [ ] **Step 5: Commit documentation and final verification.**

```bash
git add README.md docs/superpowers/specs/2026-09-23-consultant-accounts-and-public-script-sharing.md docs/superpowers/plans/2026-09-23-consultant-accounts-and-public-script-sharing.md
git commit -m "docs: align account routes with dashboard workspace"
```

The implementation is complete only after the final `npm run check` and the
real-flow checklist both pass.
