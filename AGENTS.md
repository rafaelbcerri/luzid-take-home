<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Luzid Test Scripts — working agreements

A screen recording goes in, an editable test script comes out. Read `README.md`
for setup and the pipeline overview; this file is about how to change the code.

## Non-negotiables

- **`src/lib/config/env.ts` is the only place `process.env` is read.** Add a new
  variable to that schema and to `.env.example`, then import `env`.
- **The pipeline never throws.** `processRecording` catches everything and
  records `status: "failed"` with a message written for a consultant, not a
  stack trace. Technical detail goes to `console.error`.
- **Status lives in the database, not in memory.** The UI polls it. Never hold
  job state in a module-level variable — a dev-server restart would lose it.
- **Storage goes through `StorageAdapter`.** Nothing outside
  `src/lib/storage/` may import `@supabase/supabase-js`.
- **Gemini answers with a schema.** `STEP_EXTRACTION_SCHEMA` is the contract;
  never parse free-form model text.
- **Routes stay thin.** Validate, call one function from `lib/`, map the result
  to a response. Business logic belongs in `lib/`.
- **Database access goes through `src/lib/db/recordings-repository.ts`.** Route
  handlers and components do not build Drizzle queries.

## Naming

Names are spelled out. `recordingId`, not `id` when there is more than one kind
of id in scope; `captureFrameAtTimestamp`, not `getFrame`; `isAddingStep`, not
`loading`. Booleans read as questions (`isPolling`, `hasLoadError`). Functions
that hit the network or the disk are verbs that say so (`fetchRecording`,
`downloadStoredVideo`).

Comments explain *why*, never *what*. If a comment restates the code, delete it.

## UI conventions

- Design tokens live in `src/app/globals.css`: `ink-*` for surfaces and text,
  `accent-*` for the single orange, `--radius-card` / `--radius-control`.
  **Never hardcode a hex value in a component.**
- Light mode only. Do not add `dark:` variants.
- Every async action needs a loading state, every list an empty state, every
  failure a message that says what to do next.
- Interactive elements keep the shared focus ring; do not remove outlines.
- Destructive or slow actions get optimistic UI with rollback — see
  `src/hooks/use-step-editing.ts` for the pattern to copy.

## File boundaries

One component per file, named after the file. A file doing two jobs gets split.
Components under `components/ui/` know nothing about recordings or steps; feature
components compose them.

## Before you say it works

```bash
npm run check        # types + lint + unit tests, all three must be clean
```

Then exercise the real flow: upload a video, watch the statuses advance, edit a
step, and try a bad file. `npm run check` passing is not evidence that the
pipeline works.

## Things that will bite you

- FFmpeg must be on `PATH`; `FfmpegNotInstalledError` exists to say so clearly.
- Gemini rejects a file still in `PROCESSING`; `extractProcessSteps` waits for
  `ACTIVE` before generating.
- Screenshot URLs are signed and short-lived — always send fresh ones from the
  server rather than caching them in the client.
- A frame that fails to capture must not fail the recording; the step renders
  with a placeholder.
