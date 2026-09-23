# Script Sharing and Report Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a consultant share a finished test script — publicly or with named people — as a read-only, print-ready report document with a step contents rail, and preview that same document from the scripts list and the editor.

**Architecture:** One `recording_shares` row per recording holds the public-link settings; `share_recipients` rows hold one unguessable invite token per invited email, so a recipient opens the report without an account and every open is attributable. A single server-rendered route `/r/[token]` resolves either token kind through `resolveShareAccess`, renders the report from a `ReportDocument` DTO that carries no private fields, and streams screenshots through `/r/[token]/screenshots/[stepId]` so revoking a share kills image access too. The owner's Preview renders the identical components at `/recordings/[recordingId]/preview` with signed screenshot URLs, so there is one report implementation and one set of pixels.

**Tech Stack:** Next.js 16.3.6 (App Router, `proxy.ts` conventions), React 19, Drizzle/Postgres via Supabase, Supabase Storage behind `StorageAdapter`, Zod, Tailwind CSS 4 with the tokens in `src/app/globals.css`, Vitest, `next/font/google`.

## Design source

The approved design is the canvas **Luzid Share & Report Document**, <https://claude.ai/artifact/CtRY7GbuMos8VeN7gHLv8K>, artboards:

| Artboard | Screen | Built in |
| --- | --- | --- |
| `Main.dc.html` | Scripts list with the Preview button | Task 10 |
| `ShareDialog.dc.html` | Share dialog, public link on | Task 9 |
| `Access.dc.html` | Share dialog, invited people only | Task 9 |
| `Report.dc.html` | Report cover and overview | Task 7 |
| `ReportStep.dc.html` | Report step detail | Task 8 |
| `ReportMobile.dc.html` | Report on a phone | Task 8 |

## Assumptions this plan makes

Stated because they were decided without a round of questions, and each one is cheap to reverse before Task 3 starts:

1. **No accounts.** `docs/superpowers/plans/2026-09-23-consultant-accounts-and-public-script-sharing.md` (Supabase Auth, owner scoping, a token share backend) is **not** a prerequisite and is **not** executed here. This plan ships sharing on the current single-tenant app. When that plan later lands, every route added here gains the same `getAuthenticatedUserId()` + owner-scoped repository call as the routes in its Task 4, and `recording_shares` gains no new column — the recording's owner is the share's owner. Task 11 records this hand-off.
2. **Recipients do not sign in.** Each invited address gets its own unguessable link. That is what makes "last opened by Maria Keller" true without accounts. A forwarded link is usable by whoever holds it; the copy in the dialog says so.
3. **"Prepared by" is a field, not an identity.** With no accounts there is no signed-in name, so the cover's preparer, process owner, system label and version are per-recording document details the consultant fills in (Task 2).
4. **Mail is pluggable and optional.** `MailAdapter` has a `console` driver (the default, prints the invite link to the server log) and a `resend` driver used when `RESEND_API_KEY` is set. With no key the dialog's primary action reads **Copy invite link** instead of **Send**, so the feature is complete and testable with no external account.
5. **Roles are `viewer` and `commenter`.** Commenting itself is not in this plan; `commenter` is stored and displayed, and the report renders identically for both. The dialog does not offer a role that does nothing else.

## Global Constraints

Copied from `AGENTS.md`; every task's requirements implicitly include these.

- `src/lib/config/env.ts` is the only file that reads `process.env`. Add a variable to that Zod schema **and** to `.env.example`, then import `env`.
- The pipeline never throws. `processRecording` catches everything and records `status: "failed"` with a consultant-facing message; technical detail goes to `console.error`.
- Status lives in the database, never in a module-level variable.
- Storage goes through `StorageAdapter`. Nothing outside `src/lib/storage/` imports `@supabase/supabase-js`.
- Gemini answers with a schema. `STEP_EXTRACTION_SCHEMA` is the contract; never parse free-form model text.
- Routes stay thin: validate, call one function from `lib/`, map the result to a response. Business logic lives in `lib/`.
- All database access goes through `src/lib/db/recordings-repository.ts` (this plan adds `src/lib/db/shares-repository.ts` for the share tables, same rule: no Drizzle queries in routes or components).
- Names are spelled out: `recordingId` not `id`, `isSendingInvite` not `loading`, booleans read as questions, network/disk functions are verbs that say so.
- Comments explain *why*, never *what*.
- Design tokens live in `src/app/globals.css` (`ink-*`, `accent-*`, `--radius-card`, `--radius-control`). **Never hardcode a hex value in a component.** Light mode only, no `dark:` variants.
- Every async action needs a loading state, every list an empty state, every failure a message that says what to do next.
- Interactive elements keep the shared focus ring; do not remove outlines.
- Destructive or slow actions get optimistic UI with rollback — copy the pattern in `src/hooks/use-step-editing.ts`.
- One component per file, named after the file. `components/ui/` knows nothing about recordings, steps or shares.
- A frame that fails to capture must not fail anything; the step renders with a placeholder.
- Screenshot URLs are signed and short-lived — always send fresh ones from the server; never cache them in the client.
- This is not the Next.js in your training data. Before writing route or page code, read `node_modules/next/dist/docs/01-getting-started/15-route-handlers.md`, `03-api-reference/04-functions/cookies.md` and `03-api-reference/03-file-conventions/*` as needed; `params` is a Promise in this version, as the existing routes show.
- Before saying anything works: `npm run check` (types + lint + unit tests, all three clean), then exercise the real flow.

## Pixel reference

Values read off the artboards, expressed as the token or utility to use. Every UI task cites this table; do not re-derive spacing by eye.

**Report chrome (Tasks 7–8)**

| Element | Value |
| --- | --- |
| Workspace ground | `bg-ink-100` |
| Top bar | `h-15` (60px) · `border-b border-ink-300` · `bg-white` · padding `pl-7 pr-6` |
| Top bar brand dot | `size-2.25` (9px) circle `bg-accent-500`, gap `gap-2` to the wordmark `text-[15px] font-semibold tracking-[-0.03em] text-ink-900` |
| Top bar divider | `h-5 w-px bg-ink-200` |
| Print button | `h-8.5` (34px) · `border border-ink-300` · `rounded-[var(--radius-control)]` · `px-3.25` · `text-[13px] font-medium text-ink-700` |
| Download PDF button | same metrics · `bg-ink-900 text-white` · `px-3.5` |
| Contents rail | `w-[306px]` · `border-r border-ink-300` · `bg-ink-50` · padding `pt-5.5 pr-4 pl-5.5` |
| Rail eyebrow | `text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500` |
| Rail document title | serif `text-[18px] leading-[1.3] text-ink-900`, `mt-1.5` |
| Rail search field | `h-8.5` · `border border-ink-200` · `rounded-[var(--radius-control)]` · `bg-white` · `px-2.5` · `text-[13px]` |
| Contents row | `py-2.25 px-2.5` · `border-l-2 border-transparent` · number chip `size-5.5 rounded-[4px] bg-ink-200 text-[11px] font-semibold text-ink-700` · label `text-[13px] text-ink-700` |
| Contents row, active | `border-l-2 border-accent-500` · `rounded-r-[var(--radius-control)]` · `bg-accent-50` · chip `bg-accent-500 text-white` · label `font-medium text-ink-900` |
| Contents row, already read | chip `bg-success-50 text-success-600` · label `text-ink-500` |
| Progress bar | track `h-1 rounded-full bg-ink-200`, fill `bg-accent-500` |
| Paper sheet | `w-[860px]` · `bg-white` · `border border-ink-200` · `rounded-[4px]` · `shadow-[0_18px_44px_rgba(11,17,22,0.10)]` · cover padding `py-18 px-22` (72/88px), step padding `pt-14 px-22 pb-10` |
| Paper column gap | `pt-10` above the sheet on the cover, `pt-8.5` on a step |

**Report paper type (Tasks 7–8)**

| Element | Value |
| --- | --- |
| Rule above the cover eyebrow row | `border-b-2 border-ink-900`, row `pb-3.5` |
| Cover eyebrow | `text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700`; the confidentiality side `text-accent-700` |
| Cover title | `font-serif text-[42px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-950` |
| Cover subtitle | `font-serif text-[18px] leading-[1.5] text-ink-700` |
| Detail card | `grid-cols-3 gap-y-5.5 gap-x-7` · `p-5.5 px-6` · `bg-ink-50 border border-ink-200 rounded-[var(--radius-control)]` |
| Detail label | `text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500` |
| Detail value | `mt-1.25 text-sm text-ink-900` |
| Section heading | `font-serif text-[22px] font-semibold tracking-[-0.01em] text-ink-950` |
| Body paragraph | `font-serif text-base leading-[1.72] text-ink-700` |
| Summary table header cell | `text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-700`, `border-b border-ink-700`, `py-2.25` |
| Summary table body cell | `py-2.75 border-b border-ink-200 text-sm`, index column `text-ink-500`, action `text-ink-900`, rest `text-ink-700` |
| Step numeral | `font-serif text-[40px] font-semibold leading-none text-accent-500` |
| Step title | `font-serif text-[30px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink-950` |
| Step meta chip | `h-6.5 px-2.5 rounded-full border border-ink-200 text-xs text-ink-700`, label part `text-ink-500` |
| Test-data panel | `p-4 px-4.5 border border-ink-200 rounded-[var(--radius-control)] bg-ink-50`; `<dl>` `grid-cols-[auto_minmax(0,1fr)] gap-y-1.75 gap-x-3.5 text-sm`; values `font-mono text-ink-900` |
| Expected-result panel | same padding · `border border-ink-300 bg-white`; check icon `text-success-600`; body `font-serif text-[15px] leading-[1.65] text-ink-700` |
| Figure frame | `border border-ink-300 rounded-[var(--radius-control)] overflow-hidden`; chrome strip `h-7.5 bg-ink-200 border-b border-ink-300 px-3 text-[11px] text-ink-700` |
| Figure caption | `mt-2.5 text-xs text-ink-500` |
| Step footer | `mt-7.5 pt-4.5 border-t border-ink-200`, links `text-[13px] font-medium`, next link `text-accent-700` |
| Phone header | `px-4 py-3 border-b border-ink-200`; every control `h-11` (44px minimum) |
| Phone step pager | `h-11.5` buttons, previous `border border-ink-300 text-ink-700`, next `bg-accent-500 text-white` |

**Share dialog (Task 9)**

| Element | Value |
| --- | --- |
| Backdrop | `bg-ink-950/55` |
| Panel | `w-[560px]` · `rounded-[var(--radius-card)]` · `bg-white` · `shadow-[0_24px_60px_rgba(11,17,22,0.28)]` |
| Header | `pt-5.5 px-6 pb-4.5` · `border-b border-ink-200`; title `text-lg font-medium tracking-[-0.03em] text-ink-900`; subtitle `mt-1.25 text-[13px] text-ink-500` |
| Body | `p-5 px-6` · `flex flex-col gap-5` |
| Field label | `text-[13px] font-medium text-ink-700` |
| Chip input | `min-h-10 px-2.5 py-1.5 border border-ink-300 rounded-[var(--radius-control)]`; chip `h-6 pl-2 pr-1 rounded-[4px] bg-ink-100 text-xs text-ink-700` |
| Person row | avatar `size-7.5 rounded-full`, own avatar `bg-ink-700 text-white`, others `bg-ink-100 text-ink-700`, initials `text-[11px] font-semibold`; name `text-[13px] text-ink-900`; meta `text-xs text-ink-500`, pending meta `text-warning-600` |
| Role select | `h-7 px-2.25 border border-ink-200 rounded-[var(--radius-control)] text-xs text-ink-700` |
| Link block | `p-3.5 border border-ink-200 rounded-[var(--radius-card)] bg-ink-50 flex flex-col gap-3` |
| Link block icon tile | `size-8 rounded-[var(--radius-control)]`, on `bg-accent-50 text-accent-700`, off `bg-ink-200 text-ink-700` |
| Switch | `w-11 h-6.5 rounded-full`, on `bg-accent-500` knob at `left-5.25`, off `bg-ink-300` knob at `left-0.75`, knob `size-5 bg-white` |
| Link field | `h-9.5 px-3 border border-ink-200 rounded-[var(--radius-control)] bg-white text-[13px] text-ink-700` |
| Footer | `py-3.5 px-6 border-t border-ink-200`, note `text-xs text-ink-500`, Done `h-9.5 px-4.5 border border-ink-300` |

**Scripts list (Task 10)**

| Element | Value |
| --- | --- |
| Share-state chip | `h-5 px-1.75 rounded-[4px] bg-ink-100 text-[11px] font-medium text-ink-700` with a globe (public) or lock (invited) icon at `size-2.75` |
| Action divider | `h-6.5 w-px bg-ink-200` |
| Preview button | `h-8.5 px-3 border border-ink-300 rounded-[var(--radius-control)] text-[13px] font-medium text-ink-700` |
| Preview button, not ready | `border-ink-200 bg-ink-50 text-ink-400`, `disabled`, `title="Available once the script is ready"` |
| Row menu button | `size-8.5 border border-ink-200 rounded-[var(--radius-control)] text-ink-500` |

Tailwind 4 resolves arbitrary spacing like `py-2.25` against the 4px scale (`0.25 × 4px = 1px` increments), so these map exactly to the artboard pixels. Where a needed value has no utility, use an arbitrary one (`h-[34px]`) rather than rounding.

## File map

| File or group | Responsibility |
| --- | --- |
| `src/lib/types/process-step.ts`, `src/lib/db/schema.ts`, `supabase/migrations/*` | `testData` and `responsible` on a step; document details on a recording; the three share tables |
| `src/lib/gemini/step-extraction-prompt.ts` | Ask Gemini for test data and the responsible role |
| `src/lib/db/recordings-repository.ts` | Step and recording reads/writes, including document details |
| `src/lib/db/shares-repository.ts` | Every query against `recording_shares`, `share_recipients`, `share_access_events` |
| `src/lib/sharing/share-tokens.ts`, `share-access.ts`, `report-document.ts`, `invite-email.ts` | Token generation, token → access resolution, the public DTO, the invite mail body |
| `src/lib/mail/mail-adapter.ts`, `console-mail.ts`, `resend-mail.ts`, `mail.ts` | Pluggable mail, console driver by default |
| `src/app/api/recordings/[recordingId]/share/route.ts`, `share/recipients/route.ts`, `share/recipients/[recipientId]/route.ts`, `document/route.ts` | Thin share and document-detail endpoints |
| `src/app/r/[token]/page.tsx`, `not-found.tsx`, `screenshots/[stepId]/route.ts` | The shared report and its image stream |
| `src/app/recordings/[recordingId]/preview/page.tsx` | Owner preview of the same report |
| `src/components/report/*` | Every piece of the report document, shared by both routes |
| `src/components/sharing/share-dialog.tsx`, `share-button.tsx`, `share-state-chip.tsx` | The dialog and its entry points |
| `src/components/recordings/recording-list.tsx`, `recording-detail.tsx`, `document-details-panel.tsx` | Preview button, Share button, document details form |
| `src/app/globals.css` | `--font-serif`, the print stylesheet |

---

## Task 1: Test data and responsible role on a step

The report shows a Test data panel and a Responsible chip. Neither field exists today: `ProcessStep` has no `testData`, and although `process_steps.responsible` exists in the database it is not selected, typed or edited. This task makes both first-class end to end.

**Files:**
- Modify: `src/lib/types/process-step.ts`, `src/lib/db/schema.ts`, `src/lib/db/recordings-repository.ts`, `src/lib/gemini/step-extraction-prompt.ts`, `src/lib/gemini/step-extraction-prompt.test.ts`, `src/components/steps/step-row.tsx`, `src/components/steps/step-table.tsx`
- Create: `supabase/migrations/0003_step_test_data.sql` (generated), `src/lib/db/step-mapping.test.ts`

**Interfaces:**
- Produces: `ProcessStep` gains `testData: string` and `responsible: string`; `StepFieldUpdates` gains both; `ExtractedStep` gains both. Later tasks read `step.testData` and `step.responsible`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing mapper test.**

```ts
// src/lib/db/step-mapping.test.ts
import { expect, it } from "vitest";

import { toProcessStep } from "./recordings-repository";

const row = {
  id: "step-1",
  recordingId: "rec-1",
  position: 0,
  action: "Enter the sold-to party",
  system: "SAP S/4HANA",
  testData: "Sold-to party 0000017100",
  description: "",
  responsible: "Key user",
  expectedResult: "",
  timestampSeconds: 134,
  evidenceTimestampSeconds: 134,
  screenshotPath: null,
  evidenceAnnotations: [],
  createdAt: new Date("2026-09-23T10:00:00Z"),
};

it("carries test data and the responsible role out of the database", () => {
  const step = toProcessStep(row);

  expect(step.testData).toBe("Sold-to party 0000017100");
  expect(step.responsible).toBe("Key user");
});
```

- [ ] **Step 2: Confirm red.** Run `npm run test -- src/lib/db/step-mapping.test.ts`. Expected: FAIL — `toProcessStep` is not exported, and the two properties do not exist on `ProcessStep`.

- [ ] **Step 3: Add the fields to the type.** In `src/lib/types/process-step.ts`, inside `ProcessStep` after `system`, and mirror them in `ExtractedStep`:

```ts
  /** Concrete values a tester must type, e.g. "Quantity 1000" — "" when none. */
  testData: string;
  /** The role performing the step, e.g. "Process Analyst" — "" when unclear. */
  responsible: string;
```

Extend `StepFieldUpdates` to `Pick<ProcessStep, "action" | "system" | "testData" | "description" | "responsible" | "expectedResult">`.

- [ ] **Step 4: Add the column and migrate.** In `src/lib/db/schema.ts`, add to `processSteps` after `system`:

```ts
    testData: text("test_data").notNull().default(""),
```

`responsible` already exists in the table; leave it. Run `npm run db:generate`, check the generated SQL adds only `ALTER TABLE "process_steps" ADD COLUMN "test_data" text DEFAULT '' NOT NULL;`, then `npm run db:migrate`.

- [ ] **Step 5: Export and extend the mapper.** In `src/lib/db/recordings-repository.ts`, change `function toProcessStep` to `export function toProcessStep` and add the two properties:

```ts
    system: row.system,
    testData: row.testData,
    description: row.description,
    responsible: row.responsible,
```

In `replaceSteps` and `appendStep`, persist `testData` and `responsible` from the extracted step (`testData: step.testData ?? ""`, `responsible: step.responsible ?? ""`).

- [ ] **Step 6: Confirm green.** Run `npm run test -- src/lib/db/step-mapping.test.ts`. Expected: PASS.

- [ ] **Step 7: Extend the Gemini contract.** In `src/lib/gemini/step-extraction-prompt.ts`, add both to `required` (order: `action`, `system`, `testData`, `description`, `responsible`, `expectedResult`, `timestampSeconds`) and to `properties`:

```ts
          testData: {
            type: Type.STRING,
            description:
              'Literal values the tester must enter, as "Field value" pairs separated by "; ", e.g. "Sold-to party 0000017100; PO number PO-2026-0942". Empty string when the step enters nothing.',
          },
          responsible: {
            type: Type.STRING,
            description:
              'Role performing the step, e.g. "Process Analyst" or "Key user". Empty string when the recording does not make the role clear.',
          },
```

Add one line to `STEP_EXTRACTION_INSTRUCTIONS` telling the model never to invent test values that are not visible on screen.

- [ ] **Step 8: Update the schema test.** `src/lib/gemini/step-extraction-prompt.test.ts` asserts the exact `required` array; update it to the seven names in the order above. Run `npm run test -- src/lib/gemini/step-extraction-prompt.test.ts`. Expected: PASS.

- [ ] **Step 9: Show and edit both fields.** In `src/components/steps/step-row.tsx`, add `testData` and `responsible` to `toDraft`, render them read-only in the collapsed row (an `EmptyCell` when empty), and add two `LabelledInput`s to the expanded editor — Test data after System, Responsible after Description. Update the column headings in `src/components/steps/step-table.tsx` to match. Keep one field per file boundary; no new component is needed.

- [ ] **Step 10: Verify and commit.**

```bash
npm run check
git add src/lib/types/process-step.ts src/lib/db/schema.ts src/lib/db/recordings-repository.ts src/lib/db/step-mapping.test.ts src/lib/gemini src/components/steps supabase/migrations
git commit -m "feat: record test data and the responsible role for each step"
```

---

## Task 2: Document details on a recording

The report cover shows Prepared by, Process owner, System, Recorded, Version and Scope. Only the recorded date and step count are derivable; the other four are consultant-entered.

**Files:**
- Modify: `src/lib/types/process-step.ts`, `src/lib/db/schema.ts`, `src/lib/db/recordings-repository.ts`, `src/lib/api/client.ts`, `src/components/recordings/recording-detail.tsx`
- Create: `supabase/migrations/0004_recording_document_details.sql` (generated), `src/lib/validation/document-details.ts`, `src/lib/validation/document-details.test.ts`, `src/app/api/recordings/[recordingId]/document/route.ts`, `src/components/recordings/document-details-panel.tsx`

**Interfaces:**
- Consumes: Task 1's repository conventions.
- Produces: `DocumentDetails = { preparedBy: string; processOwner: string; systemLabel: string; documentVersion: string; confidentialityNote: string }`; `Recording` gains `documentDetails: DocumentDetails`; `updateRecordingDocumentDetails(recordingId, details): Promise<Recording | null>`; `PATCH /api/recordings/[recordingId]/document`; client call `updateDocumentDetailsRequest(recordingId, details)`.

- [ ] **Step 1: Write the failing validation test.**

```ts
// src/lib/validation/document-details.test.ts
import { expect, it } from "vitest";

import { parseDocumentDetails } from "./document-details";

it("trims every field and fills what the consultant left out", () => {
  expect(parseDocumentDetails({ preparedBy: "  Rafael Cerri " })).toEqual({
    preparedBy: "Rafael Cerri",
    processOwner: "",
    systemLabel: "",
    documentVersion: "",
    confidentialityNote: "",
  });
});

it("rejects a field longer than 120 characters", () => {
  expect(() => parseDocumentDetails({ processOwner: "x".repeat(121) })).toThrow(
    /120 characters/,
  );
});
```

- [ ] **Step 2: Confirm red.** Run `npm run test -- src/lib/validation/document-details.test.ts`. Expected: FAIL with a missing-module error.

- [ ] **Step 3: Implement the parser.**

```ts
// src/lib/validation/document-details.ts
import { z } from "zod";

import type { DocumentDetails } from "@/lib/types/process-step";

const field = z
  .string()
  .trim()
  .max(120, "Keep each document detail under 120 characters.")
  .default("");

const documentDetailsSchema = z.object({
  preparedBy: field,
  processOwner: field,
  systemLabel: field,
  documentVersion: field,
  confidentialityNote: field,
});

export function parseDocumentDetails(input: unknown): DocumentDetails {
  const parsed = documentDetailsSchema.safeParse(input ?? {});

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  return parsed.data;
}
```

Add the `DocumentDetails` type to `src/lib/types/process-step.ts` and `documentDetails: DocumentDetails` to `Recording`.

- [ ] **Step 4: Confirm green.** Run `npm run test -- src/lib/validation/document-details.test.ts`. Expected: PASS.

- [ ] **Step 5: Store the details.** In `schema.ts`, add to `recordings`:

```ts
  documentDetails: jsonb("document_details")
    .$type<import("@/lib/types/process-step").DocumentDetails>()
    .notNull()
    .default({
      preparedBy: "",
      processOwner: "",
      systemLabel: "",
      documentVersion: "",
      confidentialityNote: "",
    }),
```

Run `npm run db:generate` then `npm run db:migrate`. Map it in `toRecording` and add:

```ts
export async function updateRecordingDocumentDetails(params: {
  recordingId: string;
  documentDetails: DocumentDetails;
}): Promise<Recording | null> {
  const [row] = await db
    .update(recordings)
    .set({ documentDetails: params.documentDetails, updatedAt: new Date() })
    .where(eq(recordings.id, params.recordingId))
    .returning();

  return row ? toRecording(row) : null;
}
```

- [ ] **Step 6: Add the thin route.**

```ts
// src/app/api/recordings/[recordingId]/document/route.ts
import type { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api/responses";
import { updateRecordingDocumentDetails } from "@/lib/db/recordings-repository";
import { parseDocumentDetails } from "@/lib/validation/document-details";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await params;

  let documentDetails;
  try {
    documentDetails = parseDocumentDetails(await request.json());
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Check the document details.",
      400,
    );
  }

  const recording = await updateRecordingDocumentDetails({
    recordingId,
    documentDetails,
  });

  if (!recording) return apiError("This script does not exist.", 404);

  return apiOk({ recording });
}
```

Add `updateDocumentDetailsRequest` to `src/lib/api/client.ts` following the shape of `renameRecordingRequest`.

- [ ] **Step 7: Add the editor panel.** Create `src/components/recordings/document-details-panel.tsx`: a `surface-card` section headed "Document details", five `LabelledInput`s (Prepared by, Process owner, System, Version, Confidentiality note), a `Button` with `isLoading={isSavingDetails}`, inline error text, and a success toast through the existing `onSuccess` callback pattern. Render it in `recording-detail.tsx` below the step list, only when `recording.status === "ready"`. Placeholder text tells the consultant what appears on the report cover when a field is empty ("Not stated").

- [ ] **Step 8: Verify and commit.**

```bash
npm run check
git add src/lib/types/process-step.ts src/lib/db src/lib/validation src/lib/api/client.ts src/app/api/recordings src/components/recordings supabase/migrations
git commit -m "feat: let a consultant fill in the report's document details"
```

---

## Task 3: Share tables and repository

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `supabase/migrations/0005_recording_shares.sql` (generated), `src/lib/sharing/share-tokens.ts`, `src/lib/sharing/share-tokens.test.ts`, `src/lib/db/shares-repository.ts`

**Interfaces:**
- Produces: `createShareToken(): string`; types `RecordingShare`, `ShareRecipient`, `ShareRole = "viewer" | "commenter"`; repository functions `findShare(recordingId)`, `ensureShare(recordingId)`, `updateShareSettings(params)`, `listRecipients(recordingId)`, `addRecipient(params)`, `updateRecipientRole(params)`, `revokeRecipient(recipientId)`, `findShareByPublicToken(token)`, `findRecipientByInviteToken(token)`, `recordShareOpen(params)`, `findLatestOpen(recordingId)`, `listShareStatesForRecordings(recordingIds)`.
- Consumes: Task 1 and 2 schema conventions.

- [ ] **Step 1: Write the failing token test.**

```ts
// src/lib/sharing/share-tokens.test.ts
import { expect, it } from "vitest";

import { createShareToken } from "./share-tokens";

it("makes a url-safe token long enough not to be guessed", () => {
  const token = createShareToken();

  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

it("never repeats a token", () => {
  const tokens = new Set(Array.from({ length: 500 }, createShareToken));

  expect(tokens.size).toBe(500);
});
```

- [ ] **Step 2: Confirm red.** Run `npm run test -- src/lib/sharing/share-tokens.test.ts`. Expected: FAIL with a missing-module error.

- [ ] **Step 3: Implement the token.**

```ts
// src/lib/sharing/share-tokens.ts
import { randomBytes } from "node:crypto";

/** 32 random bytes is what keeps a share link unguessable; base64url keeps it copy-pasteable. */
export function createShareToken(): string {
  return randomBytes(32).toString("base64url");
}
```

- [ ] **Step 4: Confirm green.** Run `npm run test -- src/lib/sharing/share-tokens.test.ts`. Expected: PASS.

- [ ] **Step 5: Add the tables.** In `src/lib/db/schema.ts`:

```ts
export const shareRoleEnum = pgEnum("share_role", ["viewer", "commenter"]);

export const recordingShares = pgTable("recording_shares", {
  recordingId: uuid("recording_id")
    .primaryKey()
    .references(() => recordings.id, { onDelete: "cascade" }),
  publicToken: text("public_token").notNull().unique(),
  isPublicLinkEnabled: boolean("is_public_link_enabled").notNull().default(false),
  publicExpiresAt: timestamp("public_expires_at", { withTimezone: true }),
  allowsPdfDownload: boolean("allows_pdf_download").notNull().default(true),
  showsPreparerIdentity: boolean("shows_preparer_identity").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shareRecipients = pgTable(
  "share_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordingId: uuid("recording_id")
      .notNull()
      .references(() => recordings.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: shareRoleEnum("role").notNull().default("viewer"),
    inviteToken: text("invite_token").notNull().unique(),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("share_recipients_recording_email_idx").on(
      table.recordingId,
      sql`lower(${table.email})`,
    ),
  ],
);

export const shareAccessEvents = pgTable(
  "share_access_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordingId: uuid("recording_id")
      .notNull()
      .references(() => recordings.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => shareRecipients.id, {
      onDelete: "set null",
    }),
    isPublicLink: boolean("is_public_link").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("share_access_events_recording_opened_idx").on(
      table.recordingId,
      table.openedAt,
    ),
  ],
);
```

Import `boolean`, `uniqueIndex` from `drizzle-orm/pg-core` and `sql` from `drizzle-orm`. Run `npm run db:generate`; open the generated SQL and append, so tokens are never readable through the Supabase Data API:

```sql
REVOKE ALL ON TABLE "recording_shares", "share_recipients", "share_access_events" FROM PUBLIC, anon, authenticated;
```

Run `npm run db:migrate`.

- [ ] **Step 6: Write the repository.** Create `src/lib/db/shares-repository.ts` with the functions named in Interfaces. Rules that matter:
  - `ensureShare` inserts `{ recordingId, publicToken: createShareToken() }` with `.onConflictDoNothing()` and re-reads, so two concurrent calls both return the one row.
  - `addRecipient` lowercases the email for the conflict target and uses `.onConflictDoUpdate({ target: ..., set: { role, revokedAt: null } })`, so re-inviting a revoked address reactivates that row rather than failing.
  - `findRecipientByInviteToken` returns the recipient joined to its recording, and returns `null` when `revokedAt` is set.
  - `recordShareOpen` inserts an event and, for a recipient, updates `lastOpenedAt` in the same call sequence.
  - `listShareStatesForRecordings(recordingIds)` returns `Map<string, { isPublicLinkEnabled: boolean; activeRecipientCount: number }>` in one query per table, for the list chips in Task 10.

```ts
// Representative body
export async function ensureShare(recordingId: string): Promise<RecordingShare> {
  await db
    .insert(recordingShares)
    .values({ recordingId, publicToken: createShareToken() })
    .onConflictDoNothing();

  const share = await findShare(recordingId);
  if (!share) throw new Error(`No share row for recording ${recordingId}`);
  return share;
}
```

- [ ] **Step 7: Verify and commit.**

```bash
npm run check
git add src/lib/db src/lib/sharing supabase/migrations
git commit -m "feat: add share, recipient and access tables"
```

---

## Task 4: Access resolution and the report DTO

The one piece of logic that decides whether a token may see a script, and the only shape the report is ever rendered from.

**Files:**
- Create: `src/lib/sharing/share-access.ts`, `src/lib/sharing/share-access.test.ts`, `src/lib/sharing/report-document.ts`, `src/lib/sharing/report-document.test.ts`, `src/lib/format/report-date.ts`, `src/lib/format/report-date.test.ts`

**Interfaces:**
- Consumes: Task 3's repository, Task 2's `DocumentDetails`.
- Produces:

```ts
export type ShareAccess =
  | { kind: "granted"; recordingId: string; isPublicLink: boolean;
      recipientId: string | null; allowsPdfDownload: boolean;
      showsPreparerIdentity: boolean }
  | { kind: "expired" }
  | { kind: "denied" };

export async function resolveShareAccess(token: string): Promise<ShareAccess>;

export type ReportStep = {
  position: number; number: string; action: string; system: string;
  testData: string; responsible: string; description: string;
  expectedResult: string; timestampLabel: string; screenshotUrl: string | null;
};

export type ReportDocument = {
  title: string; subtitle: string; confidentialityNote: string;
  details: Array<{ label: string; value: string }>;
  steps: ReportStep[];
  allowsPdfDownload: boolean;
};

export function toReportDocument(params: {
  recording: RecordingWithSteps;
  screenshotUrlForStep: (stepId: string) => string | null;
  showsPreparerIdentity: boolean;
  allowsPdfDownload: boolean;
}): ReportDocument;
```

- [ ] **Step 1: Write the failing access tests.**

```ts
// src/lib/sharing/share-access.test.ts
import { beforeEach, expect, it, vi } from "vitest";

import { findRecipientByInviteToken, findShareByPublicToken } from "@/lib/db/shares-repository";
import { resolveShareAccess } from "./share-access";

vi.mock("@/lib/db/shares-repository", () => ({
  findShareByPublicToken: vi.fn(),
  findRecipientByInviteToken: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(findShareByPublicToken).mockResolvedValue(null);
  vi.mocked(findRecipientByInviteToken).mockResolvedValue(null);
});

const share = {
  recordingId: "rec-1",
  isPublicLinkEnabled: true,
  publicExpiresAt: null,
  allowsPdfDownload: true,
  showsPreparerIdentity: false,
};

it("lets an enabled public link through", async () => {
  vi.mocked(findShareByPublicToken).mockResolvedValue(share);

  await expect(resolveShareAccess("tok")).resolves.toMatchObject({
    kind: "granted",
    recordingId: "rec-1",
    isPublicLink: true,
    recipientId: null,
  });
});

it("denies a public link the consultant switched off", async () => {
  vi.mocked(findShareByPublicToken).mockResolvedValue({
    ...share,
    isPublicLinkEnabled: false,
  });

  await expect(resolveShareAccess("tok")).resolves.toEqual({ kind: "denied" });
});

it("reports an expired link separately, so the page can say so", async () => {
  vi.mocked(findShareByPublicToken).mockResolvedValue({
    ...share,
    publicExpiresAt: new Date("2020-01-01T00:00:00Z"),
  });

  await expect(resolveShareAccess("tok")).resolves.toEqual({ kind: "expired" });
});

it("lets an invited recipient through even when the public link is off", async () => {
  vi.mocked(findRecipientByInviteToken).mockResolvedValue({
    id: "rcp-1",
    recordingId: "rec-1",
    role: "viewer",
    share: { ...share, isPublicLinkEnabled: false },
  });

  await expect(resolveShareAccess("tok")).resolves.toMatchObject({
    kind: "granted",
    isPublicLink: false,
    recipientId: "rcp-1",
  });
});

it("denies an unknown token", async () => {
  await expect(resolveShareAccess("nope")).resolves.toEqual({ kind: "denied" });
});
```

- [ ] **Step 2: Confirm red.** Run `npm run test -- src/lib/sharing/share-access.test.ts`. Expected: FAIL with a missing-module error.

- [ ] **Step 3: Implement resolution.** Look up the invite token first (a recipient link keeps working when the public link is off), then the public token. An expired public link returns `expired`; a revoked recipient is already filtered by the repository and falls through to `denied`.

```ts
// src/lib/sharing/share-access.ts
import {
  findRecipientByInviteToken,
  findShareByPublicToken,
} from "@/lib/db/shares-repository";

export async function resolveShareAccess(token: string): Promise<ShareAccess> {
  if (!token) return { kind: "denied" };

  const recipient = await findRecipientByInviteToken(token);
  if (recipient) {
    return {
      kind: "granted",
      recordingId: recipient.recordingId,
      isPublicLink: false,
      recipientId: recipient.id,
      allowsPdfDownload: recipient.share.allowsPdfDownload,
      showsPreparerIdentity: recipient.share.showsPreparerIdentity,
    };
  }

  const share = await findShareByPublicToken(token);
  if (!share || !share.isPublicLinkEnabled) return { kind: "denied" };
  if (share.publicExpiresAt && share.publicExpiresAt.getTime() <= Date.now()) {
    return { kind: "expired" };
  }

  return {
    kind: "granted",
    recordingId: share.recordingId,
    isPublicLink: true,
    recipientId: null,
    allowsPdfDownload: share.allowsPdfDownload,
    showsPreparerIdentity: share.showsPreparerIdentity,
  };
}
```

- [ ] **Step 4: Confirm green.** Run `npm run test -- src/lib/sharing/share-access.test.ts`. Expected: PASS.

- [ ] **Step 5: Write the failing DTO test.** Assert the cover details, the two-digit step number, the timestamp label, and — the point of the DTO — that nothing private survives serialization.

```ts
// src/lib/sharing/report-document.test.ts
it("keeps private recording data out of the shared document", () => {
  const document = toReportDocument({
    recording: recordingFixture, // has videoPath, originalFileName, errorMessage
    screenshotUrlForStep: (stepId) => `/r/tok/screenshots/${stepId}`,
    showsPreparerIdentity: false,
    allowsPdfDownload: true,
  });

  expect(JSON.stringify(document)).not.toMatch(
    /videoPath|originalFileName|errorMessage|screenshotPath|o2c-sales-order\.mov/,
  );
  expect(document.steps[0].number).toBe("01");
  expect(document.steps[0].timestampLabel).toBe("02:14");
  expect(document.details.map((detail) => detail.label)).toEqual([
    "Process owner", "System", "Recorded", "Version", "Scope",
  ]);
});

it("adds Prepared by first when the consultant chose to show it", () => {
  const document = toReportDocument({ ...base, showsPreparerIdentity: true });

  expect(document.details[0]).toEqual({ label: "Prepared by", value: "Rafael Cerri" });
});
```

- [ ] **Step 6: Confirm red.** Run `npm run test -- src/lib/sharing/report-document.test.ts`. Expected: FAIL with a missing-module error.

- [ ] **Step 7: Implement the DTO and the date format.** `report-date.ts` exports `formatReportDate(isoDate: string): string` using `new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })` so a server render and a client render never disagree; its test pins `"2026-09-23T10:00:00Z"` to `"23 Sep 2026"`. `toReportDocument` builds only listed fields, numbers steps `String(index + 1).padStart(2, "0")`, labels timestamps with the existing `formatTimestamp`, fills an empty detail with `"Not stated"`, sets `subtitle` from `documentDetails.systemLabel` (falling back to `""`), and sets `scope` to `` `${steps.length} steps · ${formatTimestamp(durationSeconds)}` ``.

- [ ] **Step 8: Confirm green and commit.**

```bash
npm run test -- src/lib/sharing src/lib/format
npm run check
git add src/lib/sharing src/lib/format
git commit -m "feat: resolve share tokens and build the report document"
```

---

## Task 5: Share API and mail

**Files:**
- Modify: `src/lib/config/env.ts`, `.env.example`, `src/lib/api/client.ts`
- Create: `src/lib/mail/mail-adapter.ts`, `src/lib/mail/console-mail.ts`, `src/lib/mail/resend-mail.ts`, `src/lib/mail/mail.ts`, `src/lib/sharing/invite-email.ts`, `src/lib/sharing/invite-email.test.ts`, `src/lib/validation/share-settings.ts`, `src/lib/validation/share-settings.test.ts`, `src/app/api/recordings/[recordingId]/share/route.ts`, `src/app/api/recordings/[recordingId]/share/route.test.ts`, `src/app/api/recordings/[recordingId]/share/recipients/route.ts`, `src/app/api/recordings/[recordingId]/share/recipients/[recipientId]/route.ts`

**Interfaces:**
- Consumes: Tasks 3 and 4.
- Produces: `GET/PATCH /api/recordings/[recordingId]/share` → `{ share: ShareState }`; `POST /api/recordings/[recordingId]/share/recipients` → `{ recipients: RecipientState[] }`; `PATCH`/`DELETE .../recipients/[recipientId]`. `ShareState = { publicUrl: string; isPublicLinkEnabled: boolean; expiresInDays: 0 | 7 | 30 | 90; allowsPdfDownload: boolean; showsPreparerIdentity: boolean; recipients: RecipientState[]; lastOpened: { email: string | null; openedAt: string } | null; isMailConfigured: boolean }`. `RecipientState = { id: string; email: string; role: ShareRole; inviteUrl: string; lastOpenedAt: string | null; hasOpened: boolean }`.

- [ ] **Step 1: Write the failing settings-validation test.**

```ts
// src/lib/validation/share-settings.test.ts
import { expect, it } from "vitest";

import { parseInviteEmails, parseShareSettings } from "./share-settings";

it("accepts the four link lifetimes the dialog offers", () => {
  expect(parseShareSettings({ isPublicLinkEnabled: true, expiresInDays: 30 }))
    .toMatchObject({ isPublicLinkEnabled: true, expiresInDays: 30 });
});

it("refuses a lifetime that is not on the menu", () => {
  expect(() => parseShareSettings({ expiresInDays: 5 })).toThrow(/link expiry/i);
});

it("splits, trims, lowercases and de-duplicates pasted addresses", () => {
  expect(parseInviteEmails(" M.Keller@deloitte.com, a.novak@ey.com ,m.keller@deloitte.com"))
    .toEqual(["m.keller@deloitte.com", "a.novak@ey.com"]);
});

it("names the address it could not accept", () => {
  expect(() => parseInviteEmails("good@ey.com, not-an-email")).toThrow(
    /not-an-email/,
  );
});
```

- [ ] **Step 2: Confirm red.** Run `npm run test -- src/lib/validation/share-settings.test.ts`. Expected: FAIL with a missing-module error.

- [ ] **Step 3: Implement the parsers** in `src/lib/validation/share-settings.ts` with Zod: `expiresInDays: z.union([z.literal(0), z.literal(7), z.literal(30), z.literal(90)])` (0 means never), booleans optional with defaults, and `parseInviteEmails` splitting on `/[,;\s]+/`, validating each with `z.string().email()`, and throwing `` `${value} is not an email address.` `` on the first failure. Run the test again. Expected: PASS.

- [ ] **Step 4: Add the mail adapter.**

```ts
// src/lib/mail/mail-adapter.ts
export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
};

export interface MailAdapter {
  /** True when a real provider is configured; the UI offers "Send" only then. */
  readonly isConfigured: boolean;
  send(mail: OutgoingMail): Promise<void>;
}
```

`console-mail.ts` implements it with `isConfigured = false` and `console.info` (never throwing, so a failed invite mail cannot break the request). `resend-mail.ts` posts to `https://api.resend.com/emails` with `env.RESEND_API_KEY` and `env.MAIL_FROM`, throwing a consultant-facing `Error` on a non-2xx. `mail.ts` exports `export const mail: MailAdapter = env.RESEND_API_KEY ? new ResendMail() : new ConsoleMail();`. Add to `env.ts` and `.env.example`:

```ts
  APP_ORIGIN: z.string().url("APP_ORIGIN must be a valid URL"),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().email().default("luzid@localhost"),
```

- [ ] **Step 5: Write and pass the invite-body test.** `invite-email.ts` exports `buildInviteEmail({ recipientEmail, recordingTitle, inviteUrl, preparedBy })`. The test asserts the subject contains the script title, the body contains the exact `inviteUrl`, and the body never contains the words "password" or "account" — the point of this design is that there is neither.

- [ ] **Step 6: Write the failing route test.**

```ts
// src/app/api/recordings/[recordingId]/share/route.test.ts
import { expect, it, vi } from "vitest";

import { ensureShare } from "@/lib/db/shares-repository";
import { GET } from "./route";

vi.mock("@/lib/db/shares-repository");
vi.mock("@/lib/db/recordings-repository");

it("answers 404 for a recording that does not exist", async () => {
  vi.mocked(findRecording).mockResolvedValue(null);

  const response = await GET(new NextRequest("http://localhost/api/recordings/x/share"), {
    params: Promise.resolve({ recordingId: "x" }),
  });

  expect(response.status).toBe(404);
  expect(ensureShare).not.toHaveBeenCalled();
});

it("returns an absolute public url built from APP_ORIGIN", async () => {
  vi.mocked(findRecording).mockResolvedValue(recordingFixture);
  vi.mocked(ensureShare).mockResolvedValue({ ...shareFixture, publicToken: "tok" });

  const response = await GET(/* … */);

  await expect(response.json()).resolves.toMatchObject({
    share: { publicUrl: "http://127.0.0.1:3000/r/tok" },
  });
});
```

- [ ] **Step 7: Confirm red, then implement the four routes.** Each route stays thin: resolve `params`, `findRecording` → 404 when missing, validate the body through Task 5's parsers, call one repository function, map to `ShareState`. `PATCH /share` converts `expiresInDays` to `publicExpiresAt` (`null` for 0). `POST /share/recipients` calls `parseInviteEmails`, adds each recipient, then — outside the transaction and inside `try/catch` so a mail failure never loses the invite — sends through `mail`. The response always includes `inviteUrl` so the dialog can offer **Copy invite link** when `isMailConfigured` is false.

```ts
const share = await ensureShare(recordingId);
const recipients = await Promise.all(
  emails.map((email) => addRecipient({ recordingId, email, role })),
);

for (const recipient of recipients) {
  try {
    await mail.send(
      buildInviteEmail({
        recipientEmail: recipient.email,
        recordingTitle: recording.title,
        inviteUrl: `${env.APP_ORIGIN}/r/${recipient.inviteToken}`,
        preparedBy: recording.documentDetails.preparedBy,
      }),
    );
  } catch (error) {
    console.error("Invite mail failed", error);
  }
}
```

- [ ] **Step 8: Add the client calls.** In `src/lib/api/client.ts`: `fetchShareState`, `updateShareSettingsRequest`, `inviteRecipientsRequest`, `updateRecipientRoleRequest`, `revokeRecipientRequest` — all through `requestJson`, all returning `{ share: ShareState }` so the dialog has one state shape to hold.

- [ ] **Step 9: Verify and commit.**

```bash
npm run check
git add src/lib/config/env.ts .env.example src/lib/mail src/lib/sharing src/lib/validation src/lib/api/client.ts src/app/api/recordings
git commit -m "feat: add the share settings and invite API"
```

---

## Task 6: The shared route, its screenshots, and its shell

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/app/r/[token]/page.tsx`, `src/app/r/[token]/not-found.tsx`, `src/app/r/[token]/screenshots/[stepId]/route.ts`, `src/components/report/report-shell.tsx`, `src/components/report/report-top-bar.tsx`, `src/components/report/report-unavailable.tsx`

**Interfaces:**
- Consumes: Task 4's `resolveShareAccess` and `toReportDocument`.
- Produces: `ReportShell({ document, contents, children })`; the route contract `/r/[token]` and `/r/[token]/screenshots/[stepId]`.

- [ ] **Step 1: Add the serif face and the report tokens.** In `src/app/layout.tsx`, load the display face with `next/font/google` and expose it as a CSS variable:

```tsx
import { Source_Serif_4 } from "next/font/google";

const reportSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});
```

Add `reportSerif.variable` to the `<html>` className. In `globals.css`, inside `@theme`, add `--font-serif: var(--font-serif-face), Georgia, "Times New Roman", serif;` wired to that variable, so components use `font-serif` and never a font name.

- [ ] **Step 2: Write the failing screenshot-route test.** Assert a denied token yields 404 **before** any storage call, and that a granted token responds `image/png` with `Cache-Control: no-store`.

```ts
vi.mock("@/lib/sharing/share-access");
vi.mock("@/lib/storage/supabase-storage");

it("does not touch storage for a revoked link", async () => {
  vi.mocked(resolveShareAccess).mockResolvedValue({ kind: "denied" });

  const response = await GET(request, {
    params: Promise.resolve({ token: "tok", stepId: "step-1" }),
  });

  expect(response.status).toBe(404);
  expect(storage.download).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Confirm red, then implement the screenshot stream.** Resolve access, confirm the step belongs to that recording, download through `StorageAdapter`, and answer with the bytes. Never redirect to a signed Storage URL — that URL would outlive a revoke.

```ts
const access = await resolveShareAccess(token);
if (access.kind !== "granted") return new Response(null, { status: 404 });

const step = await findStepWithRecording(stepId);
if (!step || step.recording.id !== access.recordingId || !step.screenshotPath) {
  return new Response(null, { status: 404 });
}

const body = await storage.download({
  bucket: STORAGE_BUCKETS.screenshots,
  path: step.screenshotPath,
});

return new Response(new Uint8Array(body), {
  headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
});
```

- [ ] **Step 4: Implement the page.** `src/app/r/[token]/page.tsx` is a Server Component: `export const dynamic = "force-dynamic";` and `export const metadata = { robots: { index: false, follow: false } };`. It resolves access, renders `ReportUnavailable` for `denied`/`expired` (distinct copy: "This link was turned off" versus "This link expired on …", each saying to ask the sender for a new one), loads the recording, guards `status !== "ready"` with the same unavailable page, builds the DTO with `screenshotUrlForStep: (stepId) => `/r/${token}/screenshots/${stepId}``, records the open with `recordShareOpen`, and renders `ReportShell`.

- [ ] **Step 5: Build the shell and top bar** to the Pixel reference: `ReportShell` is the `flex h-dvh flex-col bg-ink-100` frame with `ReportTopBar` above a `flex min-h-0 flex-1` row of contents rail and the scrolling paper column. `ReportTopBar` takes `{ title, stepLabel, footnote, allowsPdfDownload }`, renders the brand lockup, Print (`window.print()`, so it is a small client component) and Download PDF, and omits Download PDF entirely when `allowsPdfDownload` is false. Both buttons keep the shared focus ring.

- [ ] **Step 6: Verify and commit.** With the dev server running and a share row inserted by hand, open `/r/<token>`; the shell, top bar and an unavailable page all render.

```bash
npm run check
git add src/app/globals.css src/app/layout.tsx src/app/r src/components/report
git commit -m "feat: serve a shared script at its own read-only route"
```

---

## Task 7: Report cover and contents rail

**Files:**
- Create: `src/components/report/report-contents.tsx`, `src/components/report/report-cover.tsx`, `src/components/report/report-detail-grid.tsx`, `src/components/report/report-summary-table.tsx`
- Modify: `src/app/r/[token]/page.tsx`

**Interfaces:**
- Consumes: `ReportDocument` from Task 4, `ReportShell` from Task 6.
- Produces: `ReportContents({ title, eyebrow, steps, activeSectionId })` (client), `ReportCover({ document })`.

- [ ] **Step 1: Build the contents rail** per the Pixel reference. It is a client component because it tracks the active section: an `IntersectionObserver` over `#overview` and every `#step-<position>`, `rootMargin: "-25% 0px -60% 0px"`, storing `activeSectionId`. Rows are real `<a href="#step-3">` elements — never a div with an `onClick`. The search field filters the rows by action, system and test data, and shows "No step matches *query*" as its empty state. Steps before the active one take the "already read" chip; the rail shows `Step N of M` and the progress bar on a step section, and the plain contents header on the cover.

- [ ] **Step 2: Build the cover.** `ReportCover` renders, in order: the 2px rule with "Process test script" and the confidentiality note (`text-accent-700`, omitted when the note is empty); the serif title; the subtitle; `ReportDetailGrid`; the `1. Purpose and scope` section from the recording's description paragraph plus a fixed second paragraph explaining what each step carries; and `ReportSummaryTable` (`#`, Action, System, Responsible) listing every step, with a caption line when the list is longer than five rows.

- [ ] **Step 3: Check the pixels against the artboard.** Open `Report.dc.html` beside `/r/<token>` at a 1440px viewport. Walk the Pixel reference row by row: rail width 306, paper 860 with 72/88 padding, title 42px serif, detail card three columns, table header rule `border-ink-700`. Fix what differs in the component, never by adding a hex.

- [ ] **Step 4: Verify and commit.**

```bash
npm run check
git add src/components/report src/app/r
git commit -m "feat: render the report cover and step contents"
```

---

## Task 8: Step sections, figures, print and phone

**Files:**
- Create: `src/components/report/report-step-section.tsx`, `src/components/report/report-figure.tsx`, `src/components/report/report-test-data.tsx`, `src/components/report/report-expected-result.tsx`, `src/components/report/report-contents-drawer.tsx`
- Modify: `src/app/globals.css`, `src/components/report/report-shell.tsx`

**Interfaces:**
- Consumes: `ReportStep`, `ReportShell`.
- Produces: `ReportStepSection({ step, previousStep, nextStep, totalSteps })`.

- [ ] **Step 1: Build the step section** to the Pixel reference: `id={`step-${step.position}`}`, the accent numeral beside the serif title, the three meta chips (each omitted when its value is empty), the description paragraph, then the two-column `ReportTestData` / `ReportExpectedResult` grid — when `testData` is empty the expected-result panel spans both columns rather than leaving a hole. The footer holds previous/next anchors and `Step N of M`.

- [ ] **Step 2: Build the figure.** `ReportFigure` renders the chrome strip with the step's system as its label, the `<img>` with `alt={`Screen after: ${step.action}`}`, `loading="lazy"`, and the caption `Figure N · <action> · captured at <timestamp>`. When `screenshotUrl` is null it renders a bordered `bg-ink-50` placeholder reading "No screen capture for this step" — a missing frame never breaks the document.

- [ ] **Step 3: Write the print stylesheet.** In `globals.css`:

```css
@media print {
  @page { margin: 18mm 16mm; }

  .report-chrome { display: none; }

  .report-paper {
    width: auto;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
  }

  .report-step { break-inside: avoid; page-break-inside: avoid; }
  .report-step + .report-step { break-before: page; }
  .report-figure img { max-height: 92mm; object-fit: contain; }
  a[href^="#"] { text-decoration: none; color: inherit; }
}
```

Apply `report-chrome` to the top bar, the rail and the drawer, `report-paper` to the sheet, `report-step` to each section, `report-figure` to each figure.

- [ ] **Step 4: Build the phone layout.** Below `md`, the rail is hidden and `ReportContentsDrawer` renders the `h-11` **Steps** button, the `Step N of M` label, the icon-only Download button (with `aria-label`), the 3px progress bar, and a slide-over panel holding the same `ReportContents` list. The step pager at the bottom uses the two `h-11.5` buttons from the Pixel reference. Verify at 390×844 that no horizontal scroll appears and every target is at least 44px.

- [ ] **Step 5: Check the pixels** against `ReportStep.dc.html` at 1440px and `ReportMobile.dc.html` at 390px, the same way as Task 7 Step 3.

- [ ] **Step 6: Verify and commit.** Print to PDF from the browser and confirm: no chrome, one step per page, figures inside their page, captions attached.

```bash
npm run check
git add src/components/report src/app/globals.css
git commit -m "feat: render report steps, figures, print layout and the phone view"
```

---

## Task 9: The share dialog

**Files:**
- Create: `src/components/sharing/share-dialog.tsx`, `src/components/sharing/share-button.tsx`, `src/components/sharing/recipient-row.tsx`, `src/components/sharing/public-link-block.tsx`, `src/hooks/use-share-state.ts`
- Modify: `src/components/recordings/recording-detail.tsx`

**Interfaces:**
- Consumes: Task 5's client calls and `ShareState`.
- Produces: `ShareButton({ recordingId })` rendering the dialog; `useShareState(recordingId)` exposing `{ share, isLoadingShare, hasLoadError, isSendingInvite, isSavingSettings, inviteRecipients, changeRecipientRole, revokeRecipient, saveSettings }`.

- [ ] **Step 1: Build the hook.** `useShareState` fetches on open with `cache: "no-store"`, holds one `ShareState`, and follows the optimistic-with-rollback pattern of `src/hooks/use-step-editing.ts`: a role change and a revoke apply to local state first and restore the previous state on failure, with a message that says what to do next ("That person still has access. Try removing them again."). Settings changes (`isPublicLinkEnabled`, `expiresInDays`, `allowsPdfDownload`, `showsPreparerIdentity`) are optimistic the same way.

- [ ] **Step 2: Build the dialog to the Pixel reference.** A `<dialog>`-backed modal: `Escape` closes it, focus moves to the invite input on open and returns to the Share button on close, the backdrop is `bg-ink-950/55`, and the panel is `w-[560px]`. Sections in artboard order: header (title + subtitle + close), invite-by-email (chip input, role select, **Send** — or **Copy invite link** when `share.isMailConfigured` is false — and the helper line), people with access, then `PublicLinkBlock`. Loading state: a `skeleton` block in place of the body while `isLoadingShare`. Error state: `hasLoadError` replaces the body with "We could not load the sharing settings." and a Retry button.

- [ ] **Step 3: Build `PublicLinkBlock` for both artboard states.** On (`ShareDialog.dc.html`): accent icon tile, "Anyone with the link can view", the switch, the link field with **Copy link**, the two checkboxes and the expiry select. Off (`Access.dc.html`): ink tile, "Restricted — invited people only", the sub-line about old links, switch off, and the link field and options hidden. The switch is a real `<button role="switch" aria-checked>`. A failed `navigator.clipboard.writeText` falls back to selecting the field's text and saying "Copy it with ⌘C." — never a silent failure.

- [ ] **Step 4: Build `RecipientRow`.** Initials avatar, name line (the address's local part, title-cased, when no name is known), meta line showing `opened 2 days ago` via `formatRelativeDate` or `invite pending · Resend` in `text-warning-600`, the role select, and a Remove item. Removal is optimistic with rollback and announced through `aria-live="polite"`.

- [ ] **Step 5: Place the Share button.** In `recording-detail.tsx`, the header actions become Preview (Task 10), Share (`variant="primary"`, share-nodes icon) and the existing row menu, in that order, matching `ShareDialog.dc.html`. Add `ShareNodesIcon`, `GlobeIcon`, `LockIcon`, `EyeIcon` and `LinkIcon` to `src/components/ui/icons.tsx` in the existing stroke style.

- [ ] **Step 6: Check the pixels** against `ShareDialog.dc.html` and `Access.dc.html` at 1280px.

- [ ] **Step 7: Verify and commit.**

```bash
npm run check
git add src/components/sharing src/components/ui/icons.tsx src/components/recordings src/hooks
git commit -m "feat: add the share dialog for links and invited people"
```

---

## Task 10: Preview from the list and the editor

**Files:**
- Create: `src/app/recordings/[recordingId]/preview/page.tsx`, `src/components/sharing/share-state-chip.tsx`
- Modify: `src/components/recordings/recording-list.tsx`, `src/components/recordings/recording-detail.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: Tasks 6–8's report components, Task 3's `listShareStatesForRecordings`.
- Produces: the route `/recordings/[recordingId]/preview`.

- [ ] **Step 1: Build the owner preview page.** A Server Component that loads the recording with steps, calls `notFound()` when it is missing or not `ready`, serializes screenshots the normal signed-URL way, builds the same DTO with `screenshotUrlForStep: (stepId) => serializedById.get(stepId)?.screenshotUrl ?? null`, and renders the same `ReportShell`. It passes `previewNotice` so the top bar carries an `bg-accent-50 text-accent-700` strip reading "Preview — this is what your client sees" with a "Back to editing" link. Signed URLs are generated per request and never cached.

- [ ] **Step 2: Add the row actions.** In `recording-list.tsx`, the row becomes a `<li>` holding the existing `<Link>` for the title area plus a sibling actions group — a link inside a link is invalid, so the card link no longer wraps the whole row; give the title link `after:absolute after:inset-0` positioning within a `relative` row so the row still feels clickable, and keep the actions above it with `relative z-10`. Add the `ShareStateChip`, the divider, the Preview link styled per the Pixel reference (`<Link href={`/recordings/${recording.id}/preview`}>`), and the row menu button. When `recording.status !== "ready"`, render Preview as a disabled `<button>` with the title attribute from the Pixel reference.

- [ ] **Step 3: Feed the chips.** `src/app/page.tsx` calls `listShareStatesForRecordings` once for the listed ids and passes a `shareStates` map into `RecordingList`; the chip reads "Public link" with a globe when the public link is on, "N invited" with a lock when only recipients exist, and renders nothing when neither.

- [ ] **Step 4: Add Preview to the editor header** in `recording-detail.tsx` as a `secondary` Button linking to the same route, left of Share.

- [ ] **Step 5: Check the pixels** against `Main.dc.html` at 1280px, including the disabled Preview on a capturing row.

- [ ] **Step 6: Verify and commit.**

```bash
npm run check
git add src/app/recordings src/app/page.tsx src/components/recordings src/components/sharing
git commit -m "feat: preview the report from the list and the editor"
```

---

## Task 11: End-to-end validation and documentation

**Files:** Modify `README.md`, `.env.example` if Task 5 left it incomplete; no new implementation code unless a failure is found.

- [ ] **Step 1: Run the required command.** `npm run check`; expected exit 0, with typecheck, lint and Vitest all clean. Record the actual counts.

- [ ] **Step 2: Exercise the real pipeline.** Upload a short screen recording, watch `analyzing → capturing → ready`, confirm Gemini filled Test data and Responsible on most steps, edit a step, edit the document details, and upload a non-video file to confirm the failure message still reads like a sentence.

- [ ] **Step 3: Exercise sharing.** Turn the public link on, copy it, open it in a private window: cover, contents, steps, figures. Turn the link off and reload: the "turned off" page. Set the expiry to 7 days, then set `public_expires_at` to the past by hand and reload: the "expired" page. Invite two addresses, confirm the console driver logged both invite links, open one, and confirm the dialog then shows `opened just now` for that person and hides it for the other. Revoke one recipient and confirm their link 404s while the other still works. Confirm a screenshot URL copied from a live report 404s after the link is revoked.

- [ ] **Step 4: Check the document itself.** At 1440px, 768px and 390px: no horizontal scroll, the rail's active row tracks scrolling, search filters, every contents anchor lands on its step. Print to PDF and check chrome is gone, steps do not split across pages, and figures keep their captions. Tab through the report and the dialog: focus ring visible everywhere, dialog traps and restores focus.

- [ ] **Step 5: Confirm nothing private leaks.** `curl` a report route and grep the HTML for the video filename, any `videoPath`, any `supabase.co` storage URL and the error message column; each must be absent. Confirm `/r/<token>` sends `X-Robots-Tag`/`robots` meta as no-index.

- [ ] **Step 6: Document the feature.** In `README.md`, add a Sharing section covering: the two token kinds, that recipients need no account and a forwarded link works, `APP_ORIGIN` and the optional `RESEND_API_KEY`/`MAIL_FROM`, the console mail driver in development, how revocation and expiry behave, and that screenshots stream through the app so revoking is immediate. Note the hand-off in Assumption 1 for whoever executes the accounts plan.

- [ ] **Step 7: Review and commit.**

```bash
git diff --check
npm run check
git add README.md .env.example
git commit -m "docs: explain script sharing and the report document"
```

## Plan self-review

- **Design coverage.** Every artboard maps to a task: list and Preview (10), both dialog states (9), cover (7), step detail (8), phone (8). The cover's Test data, Responsible, Prepared by, Process owner, System, Version and Scope have real sources because Tasks 1 and 2 add them; without those two tasks the report would render placeholder text in six places.
- **Type consistency.** `ShareState`/`RecipientState` are defined once in Task 5 and consumed unchanged in Task 9; `ReportDocument`/`ReportStep` are defined in Task 4 and consumed in Tasks 6–8, 10; `DocumentDetails` is defined in Task 2 and read in Task 4; `toProcessStep` is exported in Task 1 and used by the Task 4 fixtures.
- **Revocation is airtight.** Both the page and the screenshot stream resolve the token on every request, and no signed Storage URL ever reaches a shared reader, so turning a link off or removing a person takes effect on the next request with nothing cached to outlive it.
- **Known deviations from the artboards, deliberate.** The step footer shows `Step N of M` on screen instead of the artboard's `Page 6 of 14`, because a browser cannot know its own pagination; print gets one step per page instead. The artboards' sample screen captures are drawn mock chrome; the real figure renders the stored frame or the placeholder from Task 8 Step 2.
- **Open risk.** Task 10 Step 2 changes the list row from a whole-row link to a link plus sibling actions. If the `after:inset-0` overlay fights the action buttons in testing, fall back to a plain non-link card with the title as the only link, and say so in the commit.
