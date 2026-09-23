# Recording Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/recordings/[recordingId]` to match the approved design canvas — a seven-column step table with large evidence, a full in-place step editor (including position and evidence-frame selection), an inline script rename, and a 44px action menu.

**Architecture:** The page stays a client component owning one `SerializedRecording`, polled by `useRecording` and mutated optimistically by `useStepEditing` (the existing rollback pattern). Four new capabilities go in behind thin API routes: rename a recording, insert a step at a position, move a step to an explicit position, and re-capture the evidence frame for a step at a chosen timestamp. Evidence gets its own timestamp column so changing the frame never rewrites the step's timestamp in the script. The video work reuses `captureFrameAtTimestamp`; the only new server machinery is a helper that materialises the stored video in a temp directory, extracted from the pipeline so both callers share it.

**Tech Stack:** Next.js 16.3.6 (App Router, Turbopack), React 19.2, TypeScript, Tailwind v4 with `@theme` tokens in `src/app/globals.css`, Drizzle ORM + Postgres (Supabase), Zod v4, FFmpeg via `spawn`. Vitest is added in Task 1 for the pure-logic test cycle.

**Design source:** the canvas at https://claude.ai/artifact/1LdcSUaQDNYmYik4zzuoEB — artboards `Main.dc.html` (read mode), `EditStep.dc.html` (edit mode), `FramePicker.dc.html` (frame dialog), `RenameScript.dc.html` (title states). Where this plan and the artboards disagree, the artboards win; re-read the artboard file with the Artifact `read` action rather than working from memory.

## Global Constraints

- `src/lib/config/env.ts` is the only place `process.env` is read. New variables go in that schema and in `.env.example`.
- The pipeline never throws. `processRecording` records `status: "failed"` with a consultant-readable message; technical detail goes to `console.error`.
- Job state lives in the database, never in a module-level variable.
- Nothing outside `src/lib/storage/` imports `@supabase/supabase-js`.
- Gemini answers with `STEP_EXTRACTION_SCHEMA`; never parse free-form model text.
- Route handlers validate, call one function from `lib/`, and map the result to a response. Business logic lives in `lib/`.
- All database access goes through `src/lib/db/recordings-repository.ts`. Routes and components never build Drizzle queries.
- Names are spelled out: `recordingId` not `id`, `isChangingFrame` not `loading`, `fetchRecording` / `captureFrameAtTimestamp` for anything hitting network or disk. Booleans read as questions.
- Comments explain *why*. A comment restating the code gets deleted.
- Design tokens only — `ink-*`, `accent-*`, `success-*`, `danger-*`, `--radius-card`, `--radius-control`. **Never hardcode a hex value in a component.** Light mode only; no `dark:` variants.
- Every async action has a loading state, every list an empty state, every failure a message saying what to do next. Interactive elements keep the shared focus ring.
- Destructive or slow actions use optimistic UI with rollback — the pattern in `src/hooks/use-step-editing.ts`.
- One component per file, named after the file. `components/ui/` knows nothing about recordings or steps.
- A frame that fails to capture must never fail the recording; the step renders with a placeholder.
- Screenshot URLs are signed and short-lived — always send fresh ones from the server, never cache them in the client.
- `npm run check` (types + lint) must be clean before any commit.

**Pixel mapping** — the artboards are authored in raw px; the app is Tailwind v4 with the tokens above. Use this table, not eyeballing:

| Artboard | Tailwind |
|---|---|
| `#121c24` / `#2a3a48` / `#5b6b7a` / `#c8d3dd` / `#e2e8ee` / `#f1f4f7` / `#f8fafb` | `ink-900` / `ink-700` / `ink-500` / `ink-300` / `ink-200` / `ink-100` / `ink-50` |
| `#e74b2e` / `#fdf3f0` / `#c0341f` / `#17805a` / `#e7f6f0` | `accent-500` / `accent-50` / `danger-600` / `success-600` / `success-50` |
| radius 10px / 6px / 4px | `rounded-[var(--radius-card)]` / `rounded-[var(--radius-control)]` / `rounded` |
| 44×44 control | `size-11` |
| 28px step badge | `size-7` |
| 240×144 thumbnail | `h-36 w-60` |
| 420×252 evidence panel | `h-[252px] w-[420px]` |
| 158×96 filmstrip frame | `h-24 w-[158px]` |
| header cell: 11px, 600, 0.08em, uppercase | `text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-500` |
| body cell 14px / 1.55 | `text-sm leading-relaxed` |
| cell padding 16px | `p-4` |

**Out of scope, deliberately:** the "Export" button drawn in the `Main.dc.html` header. No export feature exists in this codebase and inventing one is a separate project. Do not build a button that does nothing — leave the header at Re-analyze + Delete.

---

### Task 1: A test cycle, and the pure frame-window logic

Adds Vitest for pure modules (no jsdom, no component tests — UI is verified in the browser at Task 14) and builds the timestamp maths the frame picker needs.

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/video/frame-window.ts`
- Create: `src/lib/video/frame-window.test.ts`
- Create: `src/lib/format/timestamp.test.ts`
- Modify: `package.json` (scripts, devDependencies)
- Modify: `src/lib/format/timestamp.ts`
- Modify: `AGENTS.md:78-84` (the "Before you say it works" block)

**Interfaces:**
- Consumes: nothing.
- Produces: `buildFrameWindow(params: { centerSeconds: number; durationSeconds: number | null; count?: number; stepSeconds?: number }): number[]` — the filmstrip timestamps, ascending, always containing `centerSeconds`, clamped into the video. `formatTimestampWithTenths(totalSeconds: number): string` — `M:SS.t`, used wherever a frame timecode is shown.

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest@^3
```

- [ ] **Step 2: Add the config and the scripts**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Only pure modules are tested here: anything importing `@/lib/config/env`
// needs a real environment, which belongs in the manual flow, not in unit tests.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

and change `"check"` to:

```json
"check": "npm run typecheck && npm run lint && npm run test"
```

- [ ] **Step 3: Write the failing tests**

Create `src/lib/video/frame-window.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildFrameWindow } from "@/lib/video/frame-window";

describe("buildFrameWindow", () => {
  it("centres the window on the given timestamp", () => {
    expect(
      buildFrameWindow({ centerSeconds: 10, durationSeconds: 60, count: 5, stepSeconds: 0.8 }),
    ).toEqual([8.4, 9.2, 10, 10.8, 11.6]);
  });

  it("includes the centre timestamp when the count is even", () => {
    const window = buildFrameWindow({
      centerSeconds: 10,
      durationSeconds: 60,
      count: 4,
      stepSeconds: 1,
    });
    expect(window).toContain(10);
    expect(window).toHaveLength(4);
  });

  it("never returns a timestamp before the start of the video", () => {
    const window = buildFrameWindow({
      centerSeconds: 0.4,
      durationSeconds: 60,
      count: 5,
      stepSeconds: 0.8,
    });
    expect(Math.min(...window)).toBeGreaterThanOrEqual(0);
    expect(window).toContain(0.4);
  });

  it("never returns a timestamp past the end of the video", () => {
    const window = buildFrameWindow({
      centerSeconds: 59.9,
      durationSeconds: 60,
      count: 5,
      stepSeconds: 0.8,
    });
    expect(Math.max(...window)).toBeLessThanOrEqual(59.8);
  });

  it("returns ascending, unique timestamps", () => {
    const window = buildFrameWindow({
      centerSeconds: 0,
      durationSeconds: 1,
      count: 6,
      stepSeconds: 0.8,
    });
    expect(window).toEqual([...window].sort((a, b) => a - b));
    expect(new Set(window).size).toBe(window.length);
  });

  it("falls back to the centre alone when the duration is unknown", () => {
    expect(
      buildFrameWindow({ centerSeconds: 5, durationSeconds: null, count: 5, stepSeconds: 0.8 }),
    ).toEqual([3.4, 4.2, 5, 5.8, 6.6]);
  });
});
```

Create `src/lib/format/timestamp.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatTimestamp, formatTimestampWithTenths } from "@/lib/format/timestamp";

describe("formatTimestamp", () => {
  it("formats whole seconds as M:SS", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(14.6)).toBe("0:14");
    expect(formatTimestamp(107)).toBe("1:47");
  });
});

describe("formatTimestampWithTenths", () => {
  it("keeps one decimal so neighbouring frames are distinguishable", () => {
    expect(formatTimestampWithTenths(14.62)).toBe("0:14.6");
    expect(formatTimestampWithTenths(0)).toBe("0:00.0");
    expect(formatTimestampWithTenths(59.98)).toBe("1:00.0");
  });

  it("never renders a negative time", () => {
    expect(formatTimestampWithTenths(-3)).toBe("0:00.0");
  });
});
```

- [ ] **Step 4: Run the tests and watch them fail**

```bash
npm test
```

Expected: FAIL — `Failed to resolve import "@/lib/video/frame-window"` and `formatTimestampWithTenths is not a function`.

- [ ] **Step 5: Write the implementations**

Create `src/lib/video/frame-window.ts`:

```ts
import { clampTimestampToVideo } from "@/lib/video/capture-frame";

const DEFAULT_FRAME_COUNT = 6;
const DEFAULT_STEP_SECONDS = 0.8;

/** Rounds to tenths so two window entries never differ below what the UI shows. */
function roundToTenth(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}

/**
 * The timestamps offered beside a chosen frame. The centre is always in the
 * result — a consultant must be able to see which frame is the current one —
 * and everything is clamped into the video so FFmpeg is never asked for a
 * frame that does not exist.
 */
export function buildFrameWindow(params: {
  centerSeconds: number;
  durationSeconds: number | null;
  count?: number;
  stepSeconds?: number;
}): number[] {
  const count = params.count ?? DEFAULT_FRAME_COUNT;
  const stepSeconds = params.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const center = roundToTenth(
    clampTimestampToVideo(params.centerSeconds, params.durationSeconds),
  );

  const stepsBefore = Math.floor((count - 1) / 2);
  const offsets = Array.from(
    { length: count },
    (_unused, index) => (index - stepsBefore) * stepSeconds,
  );

  const timestamps = offsets.map((offset) =>
    roundToTenth(clampTimestampToVideo(center + offset, params.durationSeconds)),
  );

  return [...new Set([center, ...timestamps])]
    .sort((left, right) => left - right)
    .slice(0, count);
}
```

Append to `src/lib/format/timestamp.ts`:

```ts
/** `M:SS.t` — the notation the frame picker uses, where a tenth of a second matters. */
export function formatTimestampWithTenths(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds * 10) / 10);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds - minutes * 60;

  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}
```

- [ ] **Step 6: Run the tests and make them pass**

```bash
npm test
```

Expected: PASS — 8 tests. If the even-count case fails, the `[...new Set([center, ...timestamps])]` line is what guarantees the centre survives; fix there, not in the test.

- [ ] **Step 7: Note the test command in AGENTS.md**

In `AGENTS.md`, under "Before you say it works", change the comment on the check command to:

```bash
npm run check        # types + lint + unit tests, all three must be clean
```

- [ ] **Step 8: Run the full check and commit**

```bash
npm run check
git add package.json package-lock.json vitest.config.ts src/lib/video/frame-window.ts src/lib/video/frame-window.test.ts src/lib/format/timestamp.ts src/lib/format/timestamp.test.ts AGENTS.md
git commit -m "test: add vitest and the frame-window timestamp helpers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Evidence gets its own timestamp

A step's `timestampSeconds` is where Gemini says the action happens — it belongs in the exported script. The frame a consultant picks for the screenshot is a separate fact, so it gets its own column. Without this, choosing a clearer frame would silently rewrite the script's timing.

**Files:**
- Modify: `src/lib/db/schema.ts:40-56`
- Modify: `src/lib/types/process-step.ts`
- Modify: `src/lib/db/recordings-repository.ts` (`toProcessStep`, `setStepScreenshotPath`, `appendStep`)
- Modify: `src/lib/pipeline/process-recording.ts:100-135`
- Create: `supabase/migrations/<generated>_step_evidence_timestamp.sql` (via `npm run db:generate`)

**Interfaces:**
- Consumes: nothing.
- Produces: `ProcessStep.evidenceTimestampSeconds: number` (defaults to the step's own timestamp at capture time) and `setStepEvidence(params: { stepId: string; screenshotPath: string; evidenceTimestampSeconds: number }): Promise<void>`, which replaces `setStepScreenshotPath`.

- [ ] **Step 1: Add the column to the schema**

In `src/lib/db/schema.ts`, inside `processSteps`, after `timestampSeconds`:

```ts
    timestampSeconds: real("timestamp_seconds").notNull().default(0),
    evidenceTimestampSeconds: real("evidence_timestamp_seconds")
      .notNull()
      .default(0),
```

- [ ] **Step 2: Add it to the domain type**

In `src/lib/types/process-step.ts`, inside `ProcessStep`, after `timestampSeconds`:

```ts
  timestampSeconds: number;
  /** Where the stored screenshot was taken — a consultant may move this without moving the step. */
  evidenceTimestampSeconds: number;
```

Leave `ExtractedStep` alone: Gemini does not choose evidence frames.

- [ ] **Step 3: Generate and apply the migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new file under `supabase/migrations/` containing `ALTER TABLE "process_steps" ADD COLUMN "evidence_timestamp_seconds" real DEFAULT 0 NOT NULL;`, then `migrations applied successfully!`. Rename the generated file to `<number>_step_evidence_timestamp.sql` only if drizzle-kit's random name is kept elsewhere — otherwise leave it as generated.

- [ ] **Step 4: Carry the column through the repository**

In `src/lib/db/recordings-repository.ts`, in `toProcessStep`:

```ts
    timestampSeconds: row.timestampSeconds,
    evidenceTimestampSeconds: row.evidenceTimestampSeconds,
```

Replace `setStepScreenshotPath` with:

```ts
export async function setStepEvidence(params: {
  stepId: string;
  screenshotPath: string;
  evidenceTimestampSeconds: number;
}): Promise<ProcessStep | null> {
  const [row] = await db
    .update(processSteps)
    .set({
      screenshotPath: params.screenshotPath,
      evidenceTimestampSeconds: params.evidenceTimestampSeconds,
    })
    .where(eq(processSteps.id, params.stepId))
    .returning();

  return row ? toProcessStep(row) : null;
}
```

In `appendStep`, add to the inserted values:

```ts
      timestampSeconds: lastTimestamp,
      evidenceTimestampSeconds: lastTimestamp,
```

- [ ] **Step 5: Update the pipeline's capture loop**

In `src/lib/pipeline/process-recording.ts`, change the import from `setStepScreenshotPath` to `setStepEvidence`, and inside `captureScreenshotsForSteps` hold the clamped timestamp so it can be stored:

```ts
  for (const step of params.steps) {
    const evidenceTimestampSeconds = clampTimestampToVideo(
      step.timestampSeconds,
      params.durationSeconds,
    );

    try {
      const pngBytes = await captureFrameAtTimestamp({
        videoPath: params.localVideoPath,
        timestampSeconds: evidenceTimestampSeconds,
      });

      const screenshotPath = buildStepScreenshotPath(
        params.recordingId,
        step.id,
      );

      await storage.upload({
        bucket: STORAGE_BUCKETS.screenshots,
        path: screenshotPath,
        body: pngBytes,
        contentType: "image/png",
      });

      await setStepEvidence({
        stepId: step.id,
        screenshotPath,
        evidenceTimestampSeconds,
      });
    } catch (error) {
      console.error(`[pipeline] screenshot for step ${step.id} failed`, error);
    }
  }
```

- [ ] **Step 6: Verify and commit**

```bash
npm run check
```

Expected: clean. Then:

```bash
git add src/lib/db/schema.ts src/lib/types/process-step.ts src/lib/db/recordings-repository.ts src/lib/pipeline/process-recording.ts supabase/migrations
git commit -m "feat: store the timestamp each evidence frame was taken at

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Serving frames from a stored video

Both the filmstrip and the "use this frame" action need the video on local disk. The pipeline already does this inline; extract it so there is one way to do it, then build the read side.

**Files:**
- Create: `src/lib/video/with-local-video.ts`
- Create: `src/lib/types/frame-preview.ts`
- Create: `src/lib/video/frame-preview.ts`
- Modify: `src/lib/pipeline/process-recording.ts:31-95`
- Create: `src/app/api/steps/[stepId]/frames/route.ts`

**Interfaces:**
- Consumes: `buildFrameWindow` (Task 1), `ProcessStep.evidenceTimestampSeconds` (Task 2).
- Produces: `withLocalVideo<TResult>(videoPath: string, use: (localVideoPath: string, videoBytes: Buffer) => Promise<TResult>): Promise<TResult>`; `FramePreview = { timestampSeconds: number; dataUrl: string | null }` in `src/lib/types/frame-preview.ts`; `capturePreviewFrames(params: { localVideoPath: string; timestamps: number[] }): Promise<FramePreview[]>`; and `GET /api/steps/[stepId]/frames?at=<seconds>` returning `{ frames: FramePreview[], durationSeconds: number | null }`.

**Why data URLs:** these previews are transient and never stored, so there is nothing to sign or clean up. They are small (a 320px-wide JPEG is a few KB) and expire with the response — which is exactly the lifetime a scrub preview should have.

- [ ] **Step 1: Extract the temp-video helper**

Create `src/lib/video/with-local-video.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STORAGE_BUCKETS } from "@/lib/config/env";
import { storage } from "@/lib/storage/supabase-storage";

/**
 * Materialises a stored recording on local disk for the duration of one
 * operation. FFmpeg needs a seekable file, and the temp directory is removed
 * even when the work throws.
 */
export async function withLocalVideo<TResult>(
  videoPath: string,
  use: (localVideoPath: string, videoBytes: Buffer) => Promise<TResult>,
): Promise<TResult> {
  const workingDirectory = await mkdtemp(join(tmpdir(), "luzid-video-"));

  try {
    const localVideoPath = join(workingDirectory, "source-video");
    const videoBytes = await downloadStoredVideo(videoPath);
    await writeFile(localVideoPath, videoBytes);

    return await use(localVideoPath, videoBytes);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

/** Storage failures are reported in terms the user can act on. */
async function downloadStoredVideo(videoPath: string): Promise<Buffer> {
  try {
    return await storage.download({
      bucket: STORAGE_BUCKETS.recordings,
      path: videoPath,
    });
  } catch (error) {
    console.error(`[video] could not download ${videoPath}`, error);
    throw new Error(
      "We could not retrieve the stored video for this recording. Please upload it again.",
    );
  }
}
```

- [ ] **Step 2: Make the pipeline use it**

In `src/lib/pipeline/process-recording.ts`: delete the local `downloadStoredVideo` function and the `mkdtemp`/`rm`/`writeFile`/`tmpdir`/`join` imports, import `withLocalVideo` from `@/lib/video/with-local-video`, and restructure `processRecording` so the whole body runs inside the helper:

```ts
export async function processRecording(recording: Recording): Promise<void> {
  try {
    await withLocalVideo(recording.videoPath, async (localVideoPath, videoBytes) => {
      await updateRecordingStatus({
        recordingId: recording.id,
        status: "analyzing",
      });

      const extractedProcess = await extractProcessSteps({
        videoBytes,
        mimeType: guessMimeTypeFromPath(recording.videoPath),
      });

      const savedSteps = await replaceSteps({
        recordingId: recording.id,
        steps: extractedProcess.steps,
      });

      if (savedSteps.length === 0) {
        await updateRecordingStatus({
          recordingId: recording.id,
          status: "failed",
          errorMessage:
            "Gemini did not find any distinct steps in this recording. Try a video that shows a full process from start to finish.",
        });
        return;
      }

      await updateRecordingStatus({
        recordingId: recording.id,
        status: "capturing",
        title: extractedProcess.title,
      });

      await captureScreenshotsForSteps({
        recordingId: recording.id,
        localVideoPath,
        durationSeconds: recording.durationSeconds,
        steps: savedSteps,
      });

      await updateRecordingStatus({
        recordingId: recording.id,
        status: "ready",
      });
    });
  } catch (error) {
    console.error(`[pipeline] recording ${recording.id} failed`, error);

    await updateRecordingStatus({
      recordingId: recording.id,
      status: "failed",
      errorMessage: toUserFacingMessage(error),
    });
  }
}
```

The early `return` inside the callback ends the callback, not the pipeline — the status is already written to `failed` at that point, so nothing after it should run. Keep `guessMimeTypeFromPath` and `toUserFacingMessage` where they are.

- [ ] **Step 3: Build the preview capture**

Create `src/lib/types/frame-preview.ts` — the type lives apart from the FFmpeg code so the browser client can import it without pulling `node:child_process` into the module graph:

```ts
/** One scrub preview. `dataUrl` is null when FFmpeg could not read that frame. */
export type FramePreview = {
  timestampSeconds: number;
  dataUrl: string | null;
};
```

Create `src/lib/video/frame-preview.ts`:

```ts
import type { FramePreview } from "@/lib/types/frame-preview";
import { captureFrameAtTimestamp } from "@/lib/video/capture-frame";

/**
 * Grabs several small frames for the picker. A frame that fails is returned as
 * null rather than failing the whole strip — the same rule the pipeline uses.
 */
export async function capturePreviewFrames(params: {
  localVideoPath: string;
  timestamps: number[];
}): Promise<FramePreview[]> {
  return Promise.all(
    params.timestamps.map(async (timestampSeconds) => {
      try {
        const pngBytes = await captureFrameAtTimestamp({
          videoPath: params.localVideoPath,
          timestampSeconds,
        });

        return {
          timestampSeconds,
          dataUrl: `data:image/png;base64,${pngBytes.toString("base64")}`,
        };
      } catch (error) {
        console.error(
          `[video] preview frame at ${timestampSeconds}s failed`,
          error,
        );
        return { timestampSeconds, dataUrl: null };
      }
    }),
  );
}
```

- [ ] **Step 4: Add the repository lookup this route needs**

In `src/lib/db/recordings-repository.ts`, add:

```ts
/** A step plus the recording it belongs to — what the frame picker needs in one read. */
export async function findStepWithRecording(
  stepId: string,
): Promise<{ step: ProcessStep; recording: Recording } | null> {
  const [row] = await db
    .select()
    .from(processSteps)
    .innerJoin(recordings, eq(processSteps.recordingId, recordings.id))
    .where(eq(processSteps.id, stepId))
    .limit(1);

  if (!row) return null;

  return {
    step: toProcessStep(row.process_steps),
    recording: toRecording(row.recordings),
  };
}
```

The joined result is keyed by table name (`row.process_steps`, `row.recordings`) — that is how Drizzle returns a `select()` over a join without a projection.

- [ ] **Step 5: Add the route**

Create `src/app/api/steps/[stepId]/frames/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/responses";
import { findStepWithRecording } from "@/lib/db/recordings-repository";
import { capturePreviewFrames } from "@/lib/video/frame-preview";
import { buildFrameWindow } from "@/lib/video/frame-window";
import { withLocalVideo } from "@/lib/video/with-local-video";

export const runtime = "nodejs";
export const maxDuration = 60;

const atSecondsSchema = z.coerce.number().min(0).max(24 * 60 * 60);

/** The frames offered around a timestamp, for choosing a step's evidence. */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/steps/[stepId]/frames">,
) {
  const { stepId } = await context.params;

  try {
    const found = await findStepWithRecording(stepId);

    if (!found) {
      return apiError("This step does not exist.", 404);
    }

    const requestedAt = request.nextUrl.searchParams.get("at");
    const parsedAt = requestedAt === null ? null : atSecondsSchema.safeParse(requestedAt);

    if (parsedAt && !parsedAt.success) {
      return apiError("That position in the recording is not valid.", 400);
    }

    const centerSeconds = parsedAt?.data ?? found.step.evidenceTimestampSeconds;

    const frames = await withLocalVideo(
      found.recording.videoPath,
      (localVideoPath) =>
        capturePreviewFrames({
          localVideoPath,
          timestamps: buildFrameWindow({
            centerSeconds,
            durationSeconds: found.recording.durationSeconds,
          }),
        }),
    );

    return apiOk({
      frames,
      durationSeconds: found.recording.durationSeconds,
    });
  } catch (error) {
    console.error(`[api] loading frames for step ${stepId} failed`, error);
    return apiError(
      "Could not read frames from this recording. Check that FFmpeg is installed and try again.",
      500,
    );
  }
}
```

- [ ] **Step 6: Verify against a real recording**

```bash
npm run check
```

Then, with the dev server running and `<STEP_ID>` taken from `curl -s http://localhost:3000/api/recordings | python3 -c 'import sys,json;print(json.load(sys.stdin)["recordings"][0]["id"])'` followed by a fetch of that recording:

```bash
curl -s "http://localhost:3000/api/steps/<STEP_ID>/frames?at=12" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["durationSeconds"], [(f["timestampSeconds"], bool(f["dataUrl"])) for f in d["frames"]])'
```

Expected: the duration, then six ascending timestamps around 12 with `True` for each frame that captured.

- [ ] **Step 7: Commit**

```bash
git add src/lib/video src/lib/pipeline/process-recording.ts src/lib/db/recordings-repository.ts "src/app/api/steps/[stepId]/frames/route.ts"
git commit -m "feat: serve preview frames around a step's evidence timestamp

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Choosing a step's evidence frame

The write side: capture at the chosen timestamp, replace the stored screenshot, and return the step with a fresh signed URL.

**Files:**
- Create: `src/app/api/steps/[stepId]/evidence/route.ts`
- Modify: `src/lib/api/client.ts`

**Interfaces:**
- Consumes: `findStepWithRecording`, `setStepEvidence`, `withLocalVideo`, `captureFrameAtTimestamp`, `clampTimestampToVideo`.
- Produces: `PUT /api/steps/[stepId]/evidence` with body `{ timestampSeconds: number }` returning `{ step: SerializedStep }`; client functions `fetchStepFrames(stepId, atSeconds?)` and `changeStepEvidenceRequest(stepId, timestampSeconds)`.

- [ ] **Step 1: Write the route**

Create `src/app/api/steps/[stepId]/evidence/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/responses";
import { serializeStep } from "@/lib/api/serialize-recording";
import { STORAGE_BUCKETS } from "@/lib/config/env";
import {
  findStepWithRecording,
  setStepEvidence,
} from "@/lib/db/recordings-repository";
import {
  buildStepScreenshotPath,
  storage,
} from "@/lib/storage/supabase-storage";
import {
  captureFrameAtTimestamp,
  clampTimestampToVideo,
} from "@/lib/video/capture-frame";
import { withLocalVideo } from "@/lib/video/with-local-video";

export const runtime = "nodejs";
export const maxDuration = 60;

const changeEvidenceRequestSchema = z.object({
  timestampSeconds: z.number().min(0).max(24 * 60 * 60),
});

/** Replaces the screenshot for one step with the frame at the given moment. */
export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/steps/[stepId]/evidence">,
) {
  const { stepId } = await context.params;

  try {
    const parsed = changeEvidenceRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiError("That position in the recording is not valid.", 400);
    }

    const found = await findStepWithRecording(stepId);

    if (!found) {
      return apiError("This step does not exist.", 404);
    }

    const evidenceTimestampSeconds = clampTimestampToVideo(
      parsed.data.timestampSeconds,
      found.recording.durationSeconds,
    );

    const pngBytes = await withLocalVideo(
      found.recording.videoPath,
      (localVideoPath) =>
        captureFrameAtTimestamp({
          videoPath: localVideoPath,
          timestampSeconds: evidenceTimestampSeconds,
        }),
    );

    const screenshotPath = buildStepScreenshotPath(
      found.recording.id,
      found.step.id,
    );

    await storage.upload({
      bucket: STORAGE_BUCKETS.screenshots,
      path: screenshotPath,
      body: pngBytes,
      contentType: "image/png",
    });

    const step = await setStepEvidence({
      stepId,
      screenshotPath,
      evidenceTimestampSeconds,
    });

    if (!step) {
      return apiError("This step does not exist.", 404);
    }

    return apiOk({ step: await serializeStep(step) });
  } catch (error) {
    console.error(`[api] changing evidence for step ${stepId} failed`, error);
    return apiError(
      "Could not capture that frame. Check that FFmpeg is installed and try again.",
      500,
    );
  }
}
```

The upload overwrites the same object path, so no orphan is left behind and no delete is needed. `storage.upload` must therefore pass `upsert` — check `src/lib/storage/supabase-storage.ts`; if its `upload` does not already set `{ upsert: true }` on the Supabase call, add it there, since the pipeline relies on the same behaviour when re-analyzing.

- [ ] **Step 2: Add the client calls**

In `src/lib/api/client.ts`, add `import type { FramePreview } from "@/lib/types/frame-preview";` and:

```ts
export function fetchStepFrames(
  stepId: string,
  atSeconds?: number,
  signal?: AbortSignal,
) {
  const query = atSeconds === undefined ? "" : `?at=${atSeconds}`;

  return requestJson<{ frames: FramePreview[]; durationSeconds: number | null }>(
    `/api/steps/${stepId}/frames${query}`,
    { signal, cache: "no-store" },
  );
}

export function changeStepEvidenceRequest(
  stepId: string,
  timestampSeconds: number,
) {
  return requestJson<{ step: SerializedStep }>(
    `/api/steps/${stepId}/evidence`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestampSeconds }),
    },
  );
}
```

- [ ] **Step 3: Verify end to end**

```bash
npm run check
```

With the dev server running:

```bash
curl -s -X PUT -H 'Content-Type: application/json' -d '{"timestampSeconds": 9.5}' "http://localhost:3000/api/steps/<STEP_ID>/evidence" | python3 -c 'import sys,json; s=json.load(sys.stdin)["step"]; print(s["evidenceTimestampSeconds"], s["timestampSeconds"], bool(s["screenshotUrl"]))'
```

Expected: `9.5`, the step's original `timestampSeconds` unchanged, and `True`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/steps/[stepId]/evidence/route.ts" src/lib/api/client.ts src/lib/storage/supabase-storage.ts
git commit -m "feat: re-capture a step's evidence frame at a chosen timestamp

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Renaming a script, and inserting a step at a position

Two small server capabilities the redesigned page needs, shipped together because each is one repository function plus one route branch.

**Files:**
- Modify: `src/lib/db/recordings-repository.ts`
- Modify: `src/app/api/recordings/[recordingId]/route.ts`
- Modify: `src/app/api/recordings/[recordingId]/steps/route.ts`
- Modify: `src/lib/api/client.ts`
- Create: `src/lib/validation/recording-title.ts`
- Create: `src/lib/validation/recording-title.test.ts`

**Interfaces:**
- Consumes: nothing beyond Task 2's types.
- Produces: `renameRecording(params: { recordingId: string; title: string }): Promise<Recording | null>`; `insertStepAfter(params: { recordingId: string; afterStepId: string | null }): Promise<ProcessStep>`; `recordingTitleSchema`; `PATCH /api/recordings/[recordingId]` with `{ title }`; `POST /api/recordings/[recordingId]/steps` accepting an optional `{ afterStepId }`; client `renameRecordingRequest(recordingId, title)` and `addStep(recordingId, afterStepId?)`.

- [ ] **Step 1: Write the failing validation test**

Create `src/lib/validation/recording-title.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { recordingTitleSchema } from "@/lib/validation/recording-title";

describe("recordingTitleSchema", () => {
  it("trims the title", () => {
    expect(recordingTitleSchema.parse("  Create a Purchase Order  ")).toBe(
      "Create a Purchase Order",
    );
  });

  it("rejects an empty title with a message a consultant can act on", () => {
    const result = recordingTitleSchema.safeParse("   ");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "A script needs a name so it can be found again.",
    );
  });

  it("rejects a title longer than 200 characters", () => {
    const result = recordingTitleSchema.safeParse("x".repeat(201));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Keep the name under 200 characters.",
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- recording-title
```

Expected: FAIL — `Failed to resolve import "@/lib/validation/recording-title"`.

- [ ] **Step 3: Write the schema**

Create `src/lib/validation/recording-title.ts`:

```ts
import { z } from "zod";

const MAX_TITLE_LENGTH = 200;

export const recordingTitleSchema = z
  .string()
  .trim()
  .min(1, "A script needs a name so it can be found again.")
  .max(MAX_TITLE_LENGTH, "Keep the name under 200 characters.");
```

- [ ] **Step 4: Run it and make it pass**

```bash
npm test -- recording-title
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Add the repository functions**

In `src/lib/db/recordings-repository.ts`:

```ts
export async function renameRecording(params: {
  recordingId: string;
  title: string;
}): Promise<Recording | null> {
  const [row] = await db
    .update(recordings)
    .set({ title: params.title, updatedAt: new Date() })
    .where(eq(recordings.id, params.recordingId))
    .returning();

  return row ? toRecording(row) : null;
}

/**
 * Inserts an empty step directly below another one, shifting everything after
 * it down. `afterStepId` of null puts the new step first.
 */
export async function insertStepAfter(params: {
  recordingId: string;
  afterStepId: string | null;
}): Promise<ProcessStep> {
  return db.transaction(async (transaction) => {
    const existingSteps = await transaction
      .select()
      .from(processSteps)
      .where(eq(processSteps.recordingId, params.recordingId))
      .orderBy(asc(processSteps.position));

    const afterIndex = params.afterStepId
      ? existingSteps.findIndex((step) => step.id === params.afterStepId)
      : -1;
    const insertAt = afterIndex + 1;
    const timestampSeconds =
      existingSteps[afterIndex]?.timestampSeconds ??
      existingSteps[0]?.timestampSeconds ??
      0;

    await Promise.all(
      existingSteps.slice(insertAt).map((step, offset) =>
        transaction
          .update(processSteps)
          .set({ position: insertAt + offset + 1 })
          .where(eq(processSteps.id, step.id)),
      ),
    );

    const [row] = await transaction
      .insert(processSteps)
      .values({
        recordingId: params.recordingId,
        position: insertAt,
        action: "New step",
        system: "",
        testData: "",
        description: "",
        responsible: "",
        expectedResult: "",
        timestampSeconds,
        evidenceTimestampSeconds: timestampSeconds,
      })
      .returning();

    return toProcessStep(row);
  });
}
```

Keep `appendStep` — it is still what the "Add a step at the end" button calls.

- [ ] **Step 6: Add the rename route**

In `src/app/api/recordings/[recordingId]/route.ts`, add the import of `renameRecording` and `recordingTitleSchema`, plus:

```ts
const renameRequestSchema = z.object({ title: recordingTitleSchema });

/** Renames a script. The name is the only recording field a user edits by hand. */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]">,
) {
  const { recordingId } = await context.params;

  try {
    const parsed = renameRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "This name is not valid.",
        400,
      );
    }

    const recording = await renameRecording({
      recordingId,
      title: parsed.data.title,
    });

    if (!recording) {
      return apiError("This recording does not exist.", 404);
    }

    return apiOk({ recording });
  } catch (error) {
    console.error(`[api] renaming recording ${recordingId} failed`, error);
    return apiError("Could not save the new name.", 500);
  }
}
```

Add `import { z } from "zod";` and `import { recordingTitleSchema } from "@/lib/validation/recording-title";` at the top.

- [ ] **Step 7: Teach the steps route to insert**

In `src/app/api/recordings/[recordingId]/steps/route.ts`, add above `POST`:

```ts
const addStepRequestSchema = z.object({
  afterStepId: z.string().uuid().nullish(),
});
```

and replace the body of `POST` with:

```ts
  const { recordingId } = await context.params;

  try {
    if (!(await findRecording(recordingId))) {
      return apiError("This recording does not exist.", 404);
    }

    // A POST with no body still means "add one at the end".
    const body = await request.json().catch(() => ({}));
    const parsed = addStepRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Could not tell where to add this step.", 400);
    }

    const step = parsed.data.afterStepId
      ? await insertStepAfter({
          recordingId,
          afterStepId: parsed.data.afterStepId,
        })
      : await appendStep({ recordingId });

    return apiOk({ step: await serializeStep(step) }, 201);
  } catch (error) {
    console.error(`[api] adding a step to ${recordingId} failed`, error);
    return apiError("Could not add a step.", 500);
  }
```

Change the handler's first parameter from `_request` to `request`, and import `insertStepAfter`.

- [ ] **Step 8: Add the client calls**

In `src/lib/api/client.ts`, replace `addStep` and add the rename:

```ts
export function addStep(recordingId: string, afterStepId?: string) {
  return requestJson<{ step: SerializedStep }>(
    `/api/recordings/${recordingId}/steps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ afterStepId: afterStepId ?? null }),
    },
  );
}

export function renameRecordingRequest(recordingId: string, title: string) {
  return requestJson<{ recording: Recording }>(
    `/api/recordings/${recordingId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );
}
```

- [ ] **Step 9: Verify and commit**

```bash
npm run check
```

With the dev server running:

```bash
curl -s -X PATCH -H 'Content-Type: application/json' -d '{"title":"Renamed by curl"}' "http://localhost:3000/api/recordings/<RECORDING_ID>" | head -c 120
curl -s -X POST -H 'Content-Type: application/json' -d '{"afterStepId":"<STEP_ID>"}' "http://localhost:3000/api/recordings/<RECORDING_ID>/steps" | python3 -c 'import sys,json; print(json.load(sys.stdin)["step"]["position"])'
```

Expected: the renamed recording, then the new step's position exactly one after the referenced step. Re-fetch the recording and confirm positions are `0..n` with no duplicates. Rename it back afterwards.

```bash
git add src/lib/db/recordings-repository.ts src/lib/validation "src/app/api/recordings/[recordingId]/route.ts" "src/app/api/recordings/[recordingId]/steps/route.ts" src/lib/api/client.ts
git commit -m "feat: rename a script and insert a step at a position

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The UI primitives — icons and the bigger row menu

`components/ui/` gains the glyphs the design uses and a row menu that matches `Main.dc.html`: 44×44 trigger, 44px items, icons, separators, a destructive item.

**Files:**
- Modify: `src/components/ui/icons.tsx`
- Modify: `src/components/ui/row-menu.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: icons `GripIcon`, `FrameIcon`, `CloseIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `ExpandIcon` (alongside the existing `MoreIcon`, `PencilIcon`, `ArrowUpIcon`, `ArrowDownIcon`, `PlusIcon`, `TrashIcon`, `ImageIcon`); `RowMenuItem` gains `icon?: ReactNode`.

- [ ] **Step 1: Add the icons**

Append to `src/components/ui/icons.tsx`, following the existing `BASE_ICON_PROPS` pattern:

```tsx
export function GripIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path
        d="M9 6.01V6M9 12.01V12M9 18.01V18M15 6.01V6M15 12.01V12M15 18.01V18"
        strokeWidth={2.5}
      />
    </svg>
  );
}

export function FrameIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18M9 5v14" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ExpandIcon({ className }: IconProps) {
  return (
    <svg {...BASE_ICON_PROPS} className={className}>
      <path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />
    </svg>
  );
}
```

- [ ] **Step 2: Grow the row menu**

In `src/components/ui/row-menu.tsx`, change the item type and the two render blocks. The type gains an icon and a separator flag:

```tsx
export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  isDisabled?: boolean;
  isDestructive?: boolean;
  /** Draws a hairline above this item, grouping what comes before it. */
  hasSeparatorAbove?: boolean;
};
```

Add `import type { ReactNode } from "react";`. The trigger becomes 44×44 with a border, matching the artboard:

```tsx
        className={classNames(
          "grid size-11 place-items-center rounded-[var(--radius-control)] border transition-colors",
          isOpen
            ? "border-ink-300 bg-ink-100 text-ink-900"
            : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50",
        )}
      >
        <MoreIcon className="size-5" />
```

The panel and its items:

```tsx
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 w-59 overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-white p-1.5 shadow-lg"
        >
          {items.map((item) => (
            <Fragment key={item.label}>
              {item.hasSeparatorAbove ? (
                <span className="mx-1 my-1.5 block h-px bg-ink-200" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.isDisabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onSelect();
                }}
                className={classNames(
                  "flex h-11 w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  item.isDestructive
                    ? "text-danger-600 hover:bg-danger-50"
                    : "text-ink-900 hover:bg-ink-50",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </Fragment>
          ))}
        </div>
```

Add `Fragment` to the React import. `w-59` is 236px in Tailwind v4's 4px scale — if the build rejects it, use `w-[236px]`.

- [ ] **Step 3: Verify and commit**

```bash
npm run check
```

Expected: clean (`StepRow` still compiles — its menu items simply have no icons yet).

```bash
git add src/components/ui/icons.tsx src/components/ui/row-menu.tsx
git commit -m "feat: enlarge the row menu and add the redesign's icons

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Evidence at a readable size

`StepScreenshot` currently draws a 112×64 thumbnail with a fixed placeholder. The redesign needs three sizes and a placeholder that offers an action.

**Files:**
- Modify: `src/components/steps/step-screenshot.tsx`

**Interfaces:**
- Consumes: `formatTimestampWithTenths` (Task 1).
- Produces: `StepScreenshot` props `{ screenshotUrl, timestampSeconds, stepNumber, onOpen, size?: "thumbnail" | "panel", onChangeFrame?: () => void }` where `thumbnail` is 240×144 (the table) and `panel` is 420×252 (the editor).

- [ ] **Step 1: Rewrite the component**

Replace `src/components/steps/step-screenshot.tsx` with:

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { classNames } from "@/components/ui/class-names";
import { FrameIcon, ImageIcon } from "@/components/ui/icons";
import { formatTimestampWithTenths } from "@/lib/format/timestamp";

type StepScreenshotSize = "thumbnail" | "panel";

type StepScreenshotProps = {
  screenshotUrl: string | null;
  timestampSeconds: number;
  stepNumber: number;
  onOpen: () => void;
  size?: StepScreenshotSize;
  /** When given, a missing or unwanted frame can be replaced from here. */
  onChangeFrame?: () => void;
};

const FRAME_CLASS_NAMES: Record<StepScreenshotSize, string> = {
  thumbnail: "h-36 w-60",
  panel: "h-[252px] w-[420px]",
};

const IMAGE_SIZES: Record<StepScreenshotSize, string> = {
  thumbnail: "240px",
  panel: "420px",
};

/** The evidence for one step, with a graceful placeholder when a frame is missing. */
export function StepScreenshot({
  screenshotUrl,
  timestampSeconds,
  stepNumber,
  onOpen,
  size = "thumbnail",
  onChangeFrame,
}: StepScreenshotProps) {
  const [hasLoadError, setHasLoadError] = useState(false);
  const timecode = formatTimestampWithTenths(timestampSeconds);

  if (!screenshotUrl || hasLoadError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <div
          className={classNames(
            "grid shrink-0 place-items-center rounded-[var(--radius-control)] border border-dashed border-ink-300 bg-ink-50 text-center",
            FRAME_CLASS_NAMES[size],
          )}
        >
          <span className="px-3 text-[13px] text-ink-500">
            <ImageIcon className="mx-auto mb-1 size-5" />
            No frame captured at {timecode}
          </span>
        </div>
        {onChangeFrame ? (
          <Button size="sm" variant="secondary" onClick={onChangeFrame}>
            <FrameIcon className="size-4" />
            Pick a frame
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open the evidence frame for step ${stepNumber}, captured at ${timecode}`}
        className={classNames(
          "group relative shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-ink-200 bg-white transition-colors hover:border-ink-300",
          FRAME_CLASS_NAMES[size],
        )}
      >
        <Image
          src={screenshotUrl}
          alt={`Screen at ${timecode} during step ${stepNumber}`}
          fill
          sizes={IMAGE_SIZES[size]}
          unoptimized
          onError={() => setHasLoadError(true)}
          className="object-cover object-top transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <span className="absolute right-1.5 bottom-1.5 rounded bg-ink-950/80 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {timecode}
        </span>
      </button>

      {onChangeFrame ? (
        <Button size="sm" variant="secondary" onClick={onChangeFrame}>
          <FrameIcon className="size-4" />
          Change frame
        </Button>
      ) : null}
    </div>
  );
}
```

`frameClassName` is gone; every caller is updated in Tasks 8 and 9.

- [ ] **Step 2: Verify and commit**

```bash
npm run check
```

Expected: errors in `step-row.tsx` about `frameClassName` — that file is rewritten in Task 8. If you are committing task by task, do Task 8 before this commit, or temporarily drop the `frameClassName` prop from `StepRow`'s call. Prefer the former.

---

### Task 8: The table row, read mode

`Main.dc.html` translated into `StepRow`: seven columns, test data as a chip inside the description, a drag handle that appears on hover, and the enlarged menu with its new items.

**Files:**
- Modify: `src/components/steps/step-row.tsx`
- Modify: `src/components/steps/step-table.tsx`

**Interfaces:**
- Consumes: `StepScreenshot` (Task 7), `RowMenu` (Task 6).
- Produces: `StepRow` props gain `onInsertBelow: (stepId: string) => Promise<void>` and `onChangeEvidence: (step: SerializedStep) => void`; `StepTable` passes both through and renders the seven headings `Step, Action, System, Description, Evidence, Expected result, Edit`.

- [ ] **Step 1: Rewrite the read-mode markup in `step-row.tsx`**

Replace the read-mode `return` (everything after the `if (isEditing)` block) with:

```tsx
  return (
    <tr className="group border-t border-ink-200 align-top transition-colors hover:bg-ink-50">
      <td className="p-4">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="text-ink-400 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <GripIcon className="size-3.5" />
          </span>
          <span
            className={classNames(
              "grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold",
              "bg-ink-100 text-ink-900 group-hover:bg-ink-900 group-hover:text-white",
            )}
          >
            {stepNumber}
          </span>
        </span>
      </td>

      <td className="p-4 text-sm leading-snug font-semibold text-ink-900">
        {step.action}
      </td>

      <td className="p-4">
        {step.system.trim().length > 0 ? (
          <span className="inline-flex h-[22px] items-center rounded border border-ink-200 px-2 text-xs text-ink-700">
            {step.system}
          </span>
        ) : (
          <span className="text-sm text-ink-300">—</span>
        )}
      </td>

      <td className="p-4 text-sm leading-relaxed text-ink-700">
        <p>
          {step.description.trim().length > 0 ? (
            step.description
          ) : (
            <span className="text-ink-300">—</span>
          )}
        </p>
        {step.testData.trim().length > 0 ? (
          <span className="mt-2 inline-flex items-center rounded bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-700">
            {step.testData}
          </span>
        ) : null}
      </td>

      <td className="p-4">
        <StepScreenshot
          screenshotUrl={step.screenshotUrl}
          timestampSeconds={step.evidenceTimestampSeconds}
          stepNumber={stepNumber}
          onOpen={() => onOpenScreenshot(step)}
          onChangeFrame={
            step.screenshotUrl === null
              ? () => onChangeEvidence(step)
              : undefined
          }
        />
      </td>

      <td className="p-4">
        {step.expectedResult.trim().length > 0 ? (
          <span className="block rounded-[var(--radius-control)] border-l-2 border-success-600/40 bg-success-50/60 px-3 py-2.5 text-[13px] leading-relaxed text-ink-700">
            {step.expectedResult}
          </span>
        ) : (
          <span className="text-sm text-ink-300">—</span>
        )}
      </td>

      <td className="py-4 pr-4 text-right">
        <div className="flex justify-end">
          <RowMenu
            label={`Actions for step ${stepNumber}`}
            items={[
              {
                label: "Edit this step",
                icon: <PencilIcon className="size-4" />,
                onSelect: startEditing,
              },
              {
                label: "Change evidence frame",
                icon: <FrameIcon className="size-4" />,
                onSelect: () => onChangeEvidence(step),
              },
              {
                label: "Move up",
                icon: <ArrowUpIcon className="size-4" />,
                hasSeparatorAbove: true,
                isDisabled: isFirst,
                onSelect: () => void onMove(step.id, "up"),
              },
              {
                label: "Move down",
                icon: <ArrowDownIcon className="size-4" />,
                isDisabled: isLast,
                onSelect: () => void onMove(step.id, "down"),
              },
              {
                label: "Insert step below",
                icon: <PlusIcon className="size-4" />,
                onSelect: () => void onInsertBelow(step.id),
              },
              {
                label: "Delete step",
                icon: <TrashIcon className="size-4" />,
                hasSeparatorAbove: true,
                isDestructive: true,
                onSelect: () => void onDelete(step.id),
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );
```

Update the imports to include `classNames`, `GripIcon`, `FrameIcon`, `PencilIcon`, `ArrowUpIcon`, `ArrowDownIcon`, `PlusIcon`, `TrashIcon`, and add the two new props to `StepRowProps`:

```tsx
  onInsertBelow: (stepId: string) => Promise<void>;
  onChangeEvidence: (step: SerializedStep) => void;
```

Delete the now-unused `CellValue` helper if the em-dash spans above cover every use.

- [ ] **Step 2: Fix the column widths in `step-table.tsx`**

Replace the `<table>` opening and headings so the widths come from a `colgroup`, matching the artboard's 76 / 180 / 108 / auto / 272 / 248 / 76:

```tsx
        <table className="w-full min-w-[1160px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[76px]" />
            <col className="w-[180px]" />
            <col className="w-[108px]" />
            <col />
            <col className="w-[272px]" />
            <col className="w-[248px]" />
            <col className="w-[76px]" />
          </colgroup>
          <thead>
            <tr className="bg-ink-50">
              {COLUMN_HEADINGS.map((heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={classNames(
                    "px-4 py-3 text-[11px] font-semibold tracking-[0.08em] text-ink-500 uppercase",
                    index === COLUMN_HEADINGS.length - 1 && "text-right",
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
```

and set:

```tsx
const COLUMN_HEADINGS = [
  "Step",
  "Action",
  "System",
  "Description",
  "Evidence",
  "Expected result",
  "Edit",
] as const;
```

The separate "Step actions" `<th>` with the `sr-only` span is removed — "Edit" is now a real visible heading, as in the artboard. Import `classNames`. Add `onInsertStep` and `onChangeEvidence` to `StepTableProps` and pass them to each `StepRow`.

- [ ] **Step 3: Thread the props from the page**

In `src/components/steps/step-list.tsx` and `src/components/recordings/recording-detail.tsx`, add the matching props. In `recording-detail.tsx` the evidence handler opens a dialog that Task 10 builds — for now hold the step in state:

```tsx
  const [stepChangingEvidence, setStepChangingEvidence] =
    useState<SerializedStep | null>(null);
```

and pass `onChangeEvidence={setStepChangingEvidence}`. Add `onInsertStep={stepEditing.insertStepBelow}` once Task 9 adds it; until then, pass `stepEditing.appendEmptyStep`-style placeholder is NOT acceptable — do Task 9 first if you are executing out of order.

- [ ] **Step 4: Verify in the browser**

```bash
npm run check
```

Start the preview (`preview_start` with the `luzid-dev` config; if another session holds port 3000, attach to it by URL instead of starting a second Next dev server — Next refuses two in one directory). Open a ready recording at a 1440px viewport and compare against `Main.dc.html` side by side. Check: seven headings, 240×144 thumbnails, 44px menu button, hover reveals the grip and darkens the step badge, menu has six items with separators before "Move up" and before "Delete step".

- [ ] **Step 5: Commit**

```bash
git add src/components/steps src/components/recordings/recording-detail.tsx
git commit -m "feat: rebuild the step row to match the redesigned table

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Editing a step, including its position

`EditStep.dc.html`: the row expands full width, with Position + Action + System on one line, Test data, Description, Expected result stacked, and the evidence panel on the right.

**Files:**
- Modify: `src/components/steps/step-row.tsx` (the `isEditing` branch)
- Modify: `src/hooks/use-step-editing.ts`
- Modify: `src/components/ui/field.tsx`

**Interfaces:**
- Consumes: `insertStepAfter` route (Task 5), `StepScreenshot` size `panel` (Task 7).
- Produces: `useStepEditing` gains `insertStepBelow(afterStepId: string): Promise<void>` and `moveStepToPosition(stepId: string, position: number): Promise<void>` (1-based, clamped); `field.tsx` gains `LabelledInput` for single-line fields.

- [ ] **Step 1: Add the single-line field**

In `src/components/ui/field.tsx`, add beside `AutoGrowingTextarea`:

```tsx
type LabelledInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Hidden labels keep the control announced when the design shows no caption. */
  isLabelHidden?: boolean;
};

export function LabelledInput({
  label,
  isLabelHidden = false,
  className,
  ...inputProps
}: LabelledInputProps) {
  return (
    <label className="block">
      <span
        className={classNames(
          "mb-1.5 block text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase",
          isLabelHidden && "sr-only",
        )}
      >
        {label}
      </span>
      <input
        {...inputProps}
        className={classNames(SHARED_FIELD_CLASS_NAMES, "h-11", className)}
      />
    </label>
  );
}
```

Add `type InputHTMLAttributes` to the React import. Change `SHARED_FIELD_CLASS_NAMES`'s `text-sm` to `text-[15px]` only if the artboard's 15px body is not already matched — check `EditStep.dc.html` before changing a shared constant, since `AutoGrowingTextarea` uses it too.

- [ ] **Step 2: Add the two hook actions**

In `src/hooks/use-step-editing.ts`, add inside the hook:

```tsx
  const insertStepBelow = useCallback(
    async (afterStepId: string) => {
      const previousSteps = recording.steps;
      const insertAt =
        previousSteps.findIndex((step) => step.id === afterStepId) + 1;

      try {
        const { step } = await addStep(recording.id, afterStepId);
        setSteps([
          ...previousSteps.slice(0, insertAt),
          step,
          ...previousSteps.slice(insertAt),
        ]);
        onSuccess("Step added — fill it in");
      } catch (error) {
        onError(
          error instanceof Error ? error.message : "Could not add a step.",
        );
      }
    },
    [recording.id, recording.steps, setSteps, onSuccess, onError],
  );

  const moveStepToPosition = useCallback(
    async (stepId: string, position: number) => {
      const previousSteps = recording.steps;
      const currentIndex = previousSteps.findIndex((step) => step.id === stepId);
      const targetIndex = Math.min(
        Math.max(position - 1, 0),
        previousSteps.length - 1,
      );

      if (currentIndex === -1 || currentIndex === targetIndex) return;

      const reorderedSteps = moveItem(previousSteps, currentIndex, targetIndex);
      setSteps(reorderedSteps);

      try {
        const { steps } = await reorderStepsRequest(
          recording.id,
          reorderedSteps.map((step) => step.id),
        );
        setSteps(steps);
      } catch (error) {
        setSteps(previousSteps);
        onError(
          error instanceof Error
            ? error.message
            : "Could not move this step.",
        );
      }
    },
    [recording.id, recording.steps, setSteps, onError],
  );
```

Return both from the hook. `moveStep` stays — the menu's Move up/down still uses it.

- [ ] **Step 3: Rewrite the editing branch of `step-row.tsx`**

Replace the `if (isEditing)` return with a full-width row carrying the two-column editor:

```tsx
  if (isEditing) {
    return (
      <tr className="border-t-2 border-accent-500 bg-accent-50/40">
        <td colSpan={7} className="p-6">
          <div className="flex gap-7" onKeyDown={handleEditorKeyDown}>
            <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
              <div className="flex items-end gap-4">
                <div className="w-[132px] shrink-0">
                  <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase">
                    Position
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={totalSteps}
                      value={draftPosition}
                      aria-label={`Position of step ${stepNumber}`}
                      onChange={(event) => setDraftPosition(event.target.value)}
                      onBlur={commitPosition}
                      className="h-11 w-15 rounded-[var(--radius-control)] border border-ink-300 bg-white px-2.5 text-[15px] font-semibold text-ink-900"
                    />
                    <button
                      type="button"
                      aria-label="Move this step one position earlier"
                      disabled={isFirst}
                      onClick={() => void onMove(step.id, "up")}
                      className="grid h-11 w-8 place-items-center rounded-[var(--radius-control)] border border-ink-300 bg-white text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-40"
                    >
                      <ArrowUpIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move this step one position later"
                      disabled={isLast}
                      onClick={() => void onMove(step.id, "down")}
                      className="grid h-11 w-8 place-items-center rounded-[var(--radius-control)] border border-ink-300 bg-white text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-40"
                    >
                      <ArrowDownIcon className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <LabelledInput
                    label="Action"
                    autoFocus
                    value={draft.action}
                    onChange={(event) =>
                      updateDraftField("action", event.target.value)
                    }
                    placeholder="Enter the material"
                    className="border-accent-500 font-semibold"
                  />
                </div>

                <div className="w-55 shrink-0">
                  <LabelledInput
                    label="System"
                    value={draft.system}
                    onChange={(event) =>
                      updateDraftField("system", event.target.value)
                    }
                    placeholder="SAP Fiori"
                  />
                </div>
              </div>

              <LabelledInput
                label="Test data"
                value={draft.testData}
                onChange={(event) =>
                  updateDraftField("testData", event.target.value)
                }
                placeholder="Material: STEEL-PLATE-10MM"
                className="font-mono text-sm"
              />

              <AutoGrowingTextarea
                label="Description"
                value={draft.description}
                onChange={(event) =>
                  updateDraftField("description", event.target.value)
                }
                placeholder="What exactly the user does, naming the fields and values on screen."
              />

              <AutoGrowingTextarea
                label="Expected result"
                value={draft.expectedResult}
                onChange={(event) =>
                  updateDraftField("expectedResult", event.target.value)
                }
                placeholder="What the user should see once this step is done."
              />

              {saveError ? (
                <p role="alert" className="text-sm text-danger-600">
                  {saveError}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <Button isLoading={isSaving} onClick={saveDraft}>
                  Save step
                </Button>
                <Button
                  variant="secondary"
                  onClick={cancelEditing}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <span className="text-[13px] text-ink-500">
                  ⌘/Ctrl + Enter to save · Escape to cancel
                </span>
                <span className="flex-1" />
                <Button
                  variant="danger"
                  onClick={() => void onDelete(step.id)}
                >
                  <TrashIcon className="size-4" />
                  Delete step
                </Button>
              </div>
            </div>

            <div className="flex w-[420px] shrink-0 flex-col gap-2.5">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase">
                Evidence
              </span>
              <StepScreenshot
                screenshotUrl={step.screenshotUrl}
                timestampSeconds={step.evidenceTimestampSeconds}
                stepNumber={stepNumber}
                size="panel"
                onOpen={() => onOpenScreenshot(step)}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => onChangeEvidence(step)}
                >
                  <FrameIcon className="size-4" />
                  Choose another frame
                </Button>
                <Button
                  variant="secondary"
                  aria-label="Open this frame full size"
                  onClick={() => onOpenScreenshot(step)}
                  className="w-11 px-0"
                >
                  <ExpandIcon className="size-4" />
                </Button>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-500">
                Taken from the recording at{" "}
                {formatTimestampWithTenths(step.evidenceTimestampSeconds)}.
                Choosing another frame does not change the step&rsquo;s
                timestamp in the export.
              </p>
            </div>
          </div>
        </td>
      </tr>
    );
  }
```

Note this row spans all seven columns — unlike the current code, which leaves the step number in its own cell. The artboard shows the editor starting at the left edge of the table, so `colSpan={7}` on a single cell is correct.

Add the position state near the other state:

```tsx
  const [draftPosition, setDraftPosition] = useState(String(stepNumber));

  function commitPosition() {
    const parsedPosition = Number.parseInt(draftPosition, 10);

    if (!Number.isFinite(parsedPosition) || parsedPosition === stepNumber) {
      setDraftPosition(String(stepNumber));
      return;
    }

    void onMoveToPosition(step.id, parsedPosition);
  }
```

and add `totalSteps: number` and `onMoveToPosition: (stepId: string, position: number) => Promise<void>` to `StepRowProps`, passed down from `StepTable` (`totalSteps={steps.length}`). Because `moveStepToPosition` clamps, an out-of-range number is corrected rather than rejected; after the move the row re-renders with the new `stepNumber`, so reset `draftPosition` from it with:

```tsx
  // The number input mirrors the row's live position, which changes under it
  // whenever a move succeeds.
  useEffect(() => {
    setDraftPosition(String(stepNumber));
  }, [stepNumber]);
```

- [ ] **Step 4: Verify in the browser**

```bash
npm run check
```

Open a ready recording, choose "Edit this step" on step 3, and compare with `EditStep.dc.html`: the editor spans the full table width, the evidence panel is 420×252, every one of the six fields is editable, typing 1 into Position and blurring moves the step to the top, and the rows above and below stay in read mode. Confirm Escape cancels and ⌘+Enter saves.

- [ ] **Step 5: Commit**

```bash
git add src/components/steps/step-row.tsx src/components/steps/step-table.tsx src/hooks/use-step-editing.ts src/components/ui/field.tsx
git commit -m "feat: edit every field of a step, including its position

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: The frame picker dialog

`FramePicker.dc.html`: a modal over the page with the candidate frame at 1032×420, a scrubber, a filmstrip of nearby frames, and Cancel / Use this frame.

**Files:**
- Create: `src/components/steps/frame-picker-dialog.tsx`
- Create: `src/hooks/use-frame-picker.ts`
- Modify: `src/components/recordings/recording-detail.tsx`
- Modify: `src/hooks/use-step-editing.ts`

**Interfaces:**
- Consumes: `fetchStepFrames`, `changeStepEvidenceRequest` (Task 4), `buildFrameWindow` shapes.
- Produces: `useFramePicker({ step, onClose, onEvidenceChanged })` returning `{ frames, selectedSeconds, setSelectedSeconds, durationSeconds, isLoadingFrames, isSaving, loadError, saveFrame }`; `useStepEditing` gains `applyChangedStep(step: SerializedStep): void` so the dialog can write its result into the page state.

- [ ] **Step 1: Let the hook accept a server-updated step**

In `src/hooks/use-step-editing.ts`:

```tsx
  /** Writes a step the server has already saved back into the page. */
  const applyChangedStep = useCallback(
    (changedStep: SerializedStep) => {
      setSteps(
        recording.steps.map((step) =>
          step.id === changedStep.id ? changedStep : step,
        ),
      );
    },
    [recording.steps, setSteps],
  );
```

Return it from the hook.

- [ ] **Step 2: Write the picker hook**

Create `src/hooks/use-frame-picker.ts`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { changeStepEvidenceRequest, fetchStepFrames } from "@/lib/api/client";
import type { SerializedStep } from "@/lib/api/serialize-recording";
import type { FramePreview } from "@/lib/types/frame-preview";

type UseFramePickerParams = {
  step: SerializedStep;
  onEvidenceChanged: (step: SerializedStep) => void;
  onError: (message: string) => void;
};

/**
 * Owns one frame-picking session: the strip around the current position, the
 * frame the consultant has settled on, and the save that replaces the evidence.
 */
export function useFramePicker({
  step,
  onEvidenceChanged,
  onError,
}: UseFramePickerParams) {
  const [frames, setFrames] = useState<FramePreview[]>([]);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [selectedSeconds, setSelectedSeconds] = useState(
    step.evidenceTimestampSeconds,
  );
  const [isLoadingFrames, setIsLoadingFrames] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFramesAround = useCallback(
    async (atSeconds: number, signal?: AbortSignal) => {
      setIsLoadingFrames(true);
      setLoadError(null);

      try {
        const response = await fetchStepFrames(step.id, atSeconds, signal);
        setFrames(response.frames);
        setDurationSeconds(response.durationSeconds);
      } catch (error) {
        if (signal?.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not read frames from this recording.",
        );
      } finally {
        setIsLoadingFrames(false);
      }
    },
    [step.id],
  );

  useEffect(() => {
    const abortController = new AbortController();
    void loadFramesAround(step.evidenceTimestampSeconds, abortController.signal);
    return () => abortController.abort();
  }, [loadFramesAround, step.evidenceTimestampSeconds]);

  const saveFrame = useCallback(async () => {
    setIsSaving(true);

    try {
      const { step: savedStep } = await changeStepEvidenceRequest(
        step.id,
        selectedSeconds,
      );
      onEvidenceChanged(savedStep);
      return true;
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Could not capture that frame.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [step.id, selectedSeconds, onEvidenceChanged, onError]);

  return {
    frames,
    durationSeconds,
    selectedSeconds,
    setSelectedSeconds,
    loadFramesAround,
    isLoadingFrames,
    isSaving,
    loadError,
    saveFrame,
  };
}
```

- [ ] **Step 3: Write the dialog**

Create `src/components/steps/frame-picker-dialog.tsx`. Structure it exactly as the artboard: header (title + description + 44px close), the large frame, the scrubber row, the filmstrip, the footer. Key parts:

```tsx
"use client";

import Image from "next/image";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { classNames } from "@/components/ui/class-names";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ImageIcon,
} from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { useFramePicker } from "@/hooks/use-frame-picker";
import type { SerializedStep } from "@/lib/api/serialize-recording";
import { formatTimestamp, formatTimestampWithTenths } from "@/lib/format/timestamp";

const FRAME_NUDGE_SECONDS = 0.2;

type FramePickerDialogProps = {
  step: SerializedStep;
  stepNumber: number;
  onClose: () => void;
  onEvidenceChanged: (step: SerializedStep) => void;
  onError: (message: string) => void;
};

/** Picks the frame that best shows one step, without touching its timestamp. */
export function FramePickerDialog({
  step,
  stepNumber,
  onClose,
  onEvidenceChanged,
  onError,
}: FramePickerDialogProps) {
  const picker = useFramePicker({ step, onEvidenceChanged, onError });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const selectedFrame = picker.frames.find(
    (frame) => frame.timestampSeconds === picker.selectedSeconds,
  );

  async function handleUseFrame() {
    const didSave = await picker.saveFrame();
    if (didSave) onClose();
  }

  function nudge(deltaSeconds: number) {
    const next = Math.max(0, picker.selectedSeconds + deltaSeconds);
    picker.setSelectedSeconds(next);
    void picker.loadFramesAround(next);
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`Choose the evidence for step ${stepNumber}`}
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/55 p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[840px] w-[1080px] max-w-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-2xl">
        {/* header, body, footer per the artboard */}
      </div>
    </div>
  );
}
```

Fill in the three sections against `FramePicker.dc.html`:
- **Header:** `h2` "Choose the evidence for step {stepNumber}" at `text-lg`, the sentence "Scrub the recording, then pick the frame that shows the action most clearly." at `text-sm text-ink-500`, and a `size-11` bordered close button carrying `aria-label="Close without changing the evidence"` and `<CloseIcon className="size-4.5" />`.
- **Large frame:** a `h-[420px] w-full` bordered box. When `picker.isLoadingFrames` render a centred `<Spinner />`; when `picker.loadError` render the message plus a Button "Try again" calling `picker.loadFramesAround(picker.selectedSeconds)`; when `selectedFrame?.dataUrl` render `<Image src={selectedFrame.dataUrl} alt={...} fill unoptimized sizes="1032px" className="object-contain" />`; otherwise the `ImageIcon` placeholder with "This frame could not be read". The timecode chip sits bottom-right: `absolute right-3 bottom-3 rounded bg-ink-950/80 px-2.5 py-1 font-mono text-[13px] text-white`.
- **Scrubber:** the two `size-11` nudge buttons calling `nudge(-FRAME_NUDGE_SECONDS)` / `nudge(+FRAME_NUDGE_SECONDS)` with `aria-label="Step back one frame"` / `"Step forward one frame"`, a labelled `<input type="range" min={0} max={picker.durationSeconds ?? 0} step={0.1} value={picker.selectedSeconds} className="w-full accent-accent-500" onChange={…setSelectedSeconds} onMouseUp={…loadFramesAround} onKeyUp={…loadFramesAround} />` (load on release, not on every drag tick — one FFmpeg run per pixel would melt the dev server), and `{formatTimestampWithTenths(picker.selectedSeconds)} / {formatTimestamp(picker.durationSeconds ?? 0)}` in `font-mono`.
- **Filmstrip:** `picker.frames.map(…)` into `h-24 w-[158px]` buttons; the selected one gets `border-2 border-accent-500 shadow-[0_0_0_3px_rgba(231,75,46,0.18)]` and `aria-current="true"`, and its chip uses `bg-accent-500`. A frame whose `dataUrl` is null renders the `ImageIcon` placeholder and is `disabled`.
- **Footer:** `border-t border-ink-200 bg-ink-50 px-6 py-4`, the sentence "The chosen frame replaces the evidence for this step only." at `text-[13px] text-ink-500`, then Cancel (secondary) and `<Button isLoading={picker.isSaving} onClick={handleUseFrame}>Use this frame</Button>`.

- [ ] **Step 4: Mount it on the page**

In `src/components/recordings/recording-detail.tsx`, below the lightbox:

```tsx
      {stepChangingEvidence ? (
        <FramePickerDialog
          step={stepChangingEvidence}
          stepNumber={
            recording.steps.findIndex(
              (step) => step.id === stepChangingEvidence.id,
            ) + 1
          }
          onClose={() => setStepChangingEvidence(null)}
          onEvidenceChanged={(savedStep) => {
            stepEditing.applyChangedStep(savedStep);
            showToast("success", "Evidence updated");
          }}
          onError={(message) => showToast("error", message)}
        />
      ) : null}
```

- [ ] **Step 5: Verify in the browser**

```bash
npm run check
```

Open a ready recording, use "Change evidence frame" on a step, and check against `FramePicker.dc.html`: the strip loads with the current frame marked in orange, clicking another frame selects it, the scrubber moves the position and reloads the strip on release, "Use this frame" closes the dialog and the row's thumbnail changes, and the step's `timestampSeconds` in the script is untouched. Confirm Escape and the backdrop both close without saving, and that the step whose evidence failed to capture (`No frame captured`) can get one this way.

- [ ] **Step 6: Commit**

```bash
git add src/components/steps/frame-picker-dialog.tsx src/hooks/use-frame-picker.ts src/hooks/use-step-editing.ts src/components/recordings/recording-detail.tsx
git commit -m "feat: choose a step's evidence frame from the recording

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Renaming the script in place

`RenameScript.dc.html`: the title reads as a heading, reveals a 44px pencil on hover or keyboard focus, and becomes a full-size input on activation.

**Files:**
- Create: `src/components/recordings/recording-title.tsx`
- Modify: `src/components/recordings/recording-detail.tsx`

**Interfaces:**
- Consumes: `renameRecordingRequest` (Task 5).
- Produces: `RecordingTitle({ title, onRename })` where `onRename(title: string): Promise<void>` throws on failure so the component can stay in edit mode.

- [ ] **Step 1: Write the component**

Create `src/components/recordings/recording-title.tsx`:

```tsx
"use client";

import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { PencilIcon } from "@/components/ui/icons";

type RecordingTitleProps = {
  title: string;
  onRename: (title: string) => Promise<void>;
};

/** The script's name, edited where it is read rather than in a dialog. */
export function RecordingTitle({ title, onRename }: RecordingTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEditing() {
    setDraftTitle(title);
    setSaveError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(title);
    setSaveError(null);
    setIsEditing(false);
  }

  async function saveTitle() {
    const nextTitle = draftTitle.trim();

    if (nextTitle.length === 0) {
      setSaveError("A script needs a name so it can be found again.");
      return;
    }

    if (nextTitle === title) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onRename(nextTitle);
      setIsEditing(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save the new name.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void saveTitle();
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2.5">
        <input
          autoFocus
          value={draftTitle}
          aria-label="Script name"
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={handleKeyDown}
          className="h-14 w-full rounded-[var(--radius-control)] border border-accent-500 bg-white px-3.5 text-[28px] font-medium tracking-[-0.03em] text-ink-900"
        />

        {saveError ? (
          <p role="alert" className="text-sm text-danger-600">
            {saveError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button isLoading={isSaving} onClick={saveTitle}>
            Save name
          </Button>
          <Button variant="secondary" onClick={cancelEditing} disabled={isSaving}>
            Cancel
          </Button>
          <span className="text-[13px] text-ink-500">
            Enter to save · Escape to cancel
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2.5">
      <h1 className="-mx-2 rounded-[var(--radius-control)] px-2 text-2xl leading-tight text-ink-900 transition-colors group-hover:bg-ink-100 sm:text-3xl">
        {title}
      </h1>
      <button
        type="button"
        aria-label="Rename this script"
        onClick={startEditing}
        className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-ink-200 bg-white text-ink-700 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <PencilIcon className="size-4.5" />
      </button>
    </div>
  );
}
```

The pencil is `opacity-0` until hover or focus, but never `hidden` — a hidden button is not tabbable, and the artboard's second state is explicitly "or focused by keyboard".

- [ ] **Step 2: Wire it into the header**

In `src/components/recordings/recording-detail.tsx`, replace the `<h1>` with:

```tsx
          <RecordingTitle
            title={recording.title}
            onRename={async (nextTitle) => {
              const previousTitle = recording.title;
              setRecording((current) => ({ ...current, title: nextTitle }));

              try {
                await renameRecordingRequest(recording.id, nextTitle);
                showToast("success", "Name saved");
              } catch (error) {
                setRecording((current) => ({
                  ...current,
                  title: previousTitle,
                }));
                throw error;
              }
            }}
          />
```

Import `RecordingTitle` and `renameRecordingRequest`. The rollback before the rethrow is what keeps the optimistic update honest.

- [ ] **Step 3: Verify in the browser**

```bash
npm run check
```

Compare with `RenameScript.dc.html`: the pencil appears on hover and on Tab, the input is 28px and full width, Enter saves, Escape reverts, the browser tab title and the list page both show the new name after a reload, and an empty name shows the message rather than saving.

- [ ] **Step 4: Commit**

```bash
git add src/components/recordings/recording-title.tsx src/components/recordings/recording-detail.tsx
git commit -m "feat: rename a script in place from its heading

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Dragging a row to a new position

The grip from Task 8 becomes functional, using native HTML5 drag events — no new dependency.

**Files:**
- Modify: `src/components/steps/step-table.tsx`
- Modify: `src/components/steps/step-row.tsx`

**Interfaces:**
- Consumes: `moveStepToPosition` (Task 9).
- Produces: `StepRow` props `onDragStart`, `onDragOver`, `onDrop`, `isDropTarget`; `StepTable` owns `draggedStepId` and `dropTargetStepId` state.

- [ ] **Step 1: Hold the drag state in the table**

In `src/components/steps/step-table.tsx`:

```tsx
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dropTargetStepId, setDropTargetStepId] = useState<string | null>(null);

  function handleDrop(targetStepId: string) {
    const draggedIndex = steps.findIndex((step) => step.id === draggedStepId);
    const targetIndex = steps.findIndex((step) => step.id === targetStepId);

    setDraggedStepId(null);
    setDropTargetStepId(null);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
      return;
    }

    void onMoveStepToPosition(steps[draggedIndex].id, targetIndex + 1);
  }
```

Pass to each row: `isDropTarget={dropTargetStepId === step.id}`, `onDragStart={() => setDraggedStepId(step.id)}`, `onDragOver={() => setDropTargetStepId(step.id)}`, `onDrop={() => handleDrop(step.id)}`.

- [ ] **Step 2: Make the row draggable**

In `src/components/steps/step-row.tsx`, on the read-mode `<tr>`:

```tsx
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={classNames(
        "group border-t align-top transition-colors hover:bg-ink-50",
        isDropTarget ? "border-t-2 border-accent-500" : "border-ink-200",
      )}
    >
```

`draggable` on the row (rather than only the grip) is what makes the whole row a drag source; the grip stays as the visual affordance, with `cursor-grab` on it.

- [ ] **Step 3: Verify in the browser**

Drag step 4 above step 2 and confirm: the accent line marks the target row while dragging, the order changes on drop, the numbers renumber, and a reload shows the same order (the reorder request persisted). Then drag a row onto itself and confirm nothing happens.

- [ ] **Step 4: Commit**

```bash
git add src/components/steps/step-table.tsx src/components/steps/step-row.tsx
git commit -m "feat: reorder steps by dragging a row

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Page chrome and the section heading

The remaining header differences between `Main.dc.html` and the current page: the status line, the step counter, the section heading and its sentence, and the 44px header buttons.

**Files:**
- Modify: `src/components/recordings/recording-detail.tsx`
- Modify: `src/components/steps/step-list.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: no new exports.

- [ ] **Step 1: Match the header**

In `recording-detail.tsx`, the status row becomes badge + step count + a middot + relative edit time, and the two action buttons get `className="h-11"` so they match the artboard's 44px (the `md` Button is 40px). Do **not** add an Export button.

- [ ] **Step 2: Match the section heading**

In `step-list.tsx`:

```tsx
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[19px] text-ink-900">Process steps</h2>
          <p className="text-sm text-ink-500">
            Every action a colleague repeats to reproduce this process. Drag a
            row, or use its menu, to change the order.
          </p>
        </div>
        <span className="text-[13px] text-ink-500">{stepCountLabel}</span>
      </div>
```

where `stepCountLabel` is `${steps.length} steps` (or `1 step`). The artboard's "Showing steps 1–4 of 12" describes a cropped artboard, not pagination — the real page renders every step, so the counter states the total.

- [ ] **Step 3: Verify and commit**

```bash
npm run check
```

Compare the header and heading with `Main.dc.html` at 1440px.

```bash
git add src/components/recordings/recording-detail.tsx src/components/steps/step-list.tsx
git commit -m "feat: align the recording header and section heading with the design

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Pixel audit and the full manual flow

The gate. Nothing here writes new features; it proves the built page matches the canvas and that the pipeline still works end to end.

**Files:**
- Modify: whichever files the audit finds wrong.

- [ ] **Step 1: Re-read the artboards**

Read `project/Main.dc.html`, `project/EditStep.dc.html`, `project/FramePicker.dc.html` and `project/RenameScript.dc.html` from the canvas with the Artifact `read` action — the user may have edited them since this plan was written. Work from what comes back, not from this document.

- [ ] **Step 2: Audit each surface at 1440px**

Open the app at a 1440×900 viewport. For each artboard, walk this checklist and write down every difference before fixing anything:

- column widths 76 / 180 / 108 / auto / 272 / 248 / 76
- header cells 11px, 600 weight, 0.08em tracking, uppercase, `ink-500`
- cell padding 16px, rows separated by a 1px `ink-200` line
- step badge 28px, `ink-100` at rest, `ink-900` + white text on row hover
- evidence 240×144 in the table, 420×252 in the editor, timecode chip bottom-right
- menu trigger 44×44 with an `ink-200` border; menu 236px wide, items 44px, separators before "Move up" and "Delete step"
- editor: position field 60px wide with two 32×44 arrow buttons, Action bordered in `accent-500`, System 220px, test data in mono
- dialog: 1080×840, frame area 420px tall, filmstrip frames 158×96, selected frame ringed in accent
- title: 44px pencil revealed on hover and focus; editing input 56px tall at 28px type

- [ ] **Step 3: Check contrast and keyboard reach**

Confirm no body or caption text uses `ink-400` on white (it fails 4.5:1 — `ink-500` is the lightest text that passes). Tab through the page: the rename pencil, every menu trigger, every menu item, all editor fields, and all dialog controls must be reachable and must show the shared focus ring.

- [ ] **Step 4: Run the real flow**

```bash
npm run check
```

Then, in the browser: upload a video, watch the statuses advance through analyzing → capturing → ready, rename the script, edit a step's every field, change a step's position with the number field, drag a row, insert a step below another, change one step's evidence frame, delete a step, and upload a bad file (a `.txt` renamed to `.mp4`) to confirm the failure message still reads like advice. Confirm no `console.error` in the browser and no unhandled rejection in the server log.

- [ ] **Step 5: Commit the fixes**

```bash
git add -A
git commit -m "fix: close the gaps found in the design audit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Notes for whoever executes this

- **Port 3000 may be held by another session's dev server.** Next refuses a second `next dev` in the same directory. Attach the browser to the running one rather than starting another.
- **The evidence timestamp is not the step timestamp.** Every time you are tempted to show `step.timestampSeconds` beside a screenshot, it should be `step.evidenceTimestampSeconds`. The export and the script text keep using `timestampSeconds`.
- **Preview frames are data URLs and must never be persisted.** Only `PUT /api/steps/[stepId]/evidence` writes to the screenshots bucket.
- **The artboards are the spec.** Where this plan's Tailwind differs from the artboard's px, the artboard wins.
