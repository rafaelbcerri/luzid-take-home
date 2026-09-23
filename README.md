# Luzid Test Scripts

Upload a screen recording, get an editable test script: an ordered list of
steps, each with an action, a description, an expected result and a screenshot
of the exact moment it happens.

Gemini watches the video and returns the steps with timestamps; FFmpeg captures
one frame per timestamp. Everything is stored in Postgres and Supabase Storage.

## Requirements

| Tool | Why | Install |
| --- | --- | --- |
| Node 20+ | Runs Next.js | `brew install node` |
| Docker Desktop | Hosts local Supabase | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Supabase CLI | Local Postgres + Storage | `brew install supabase/tap/supabase` |
| FFmpeg | Probes videos, captures frames | `brew install ffmpeg` |
| Gemini API key | Video understanding | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

## Setup

```bash
npm install
npm run supabase:start     # prints the database URL and API keys
cp .env.example .env.local # then paste those values in
npm run db:migrate         # creates the tables
npm run dev                # http://localhost:3000
```

`npm run supabase:start` prints everything `.env.local` needs: the database URL
(port 54322), the API URL (port 54321) and the secret key, which goes into
`SUPABASE_SERVICE_ROLE_KEY`. The `recordings` and `screenshots` buckets are
created automatically on the first upload.

## How a recording becomes a script

```
POST /api/recordings
  ├─ validate       type, size, and duration via ffprobe — bad videos never reach Gemini
  ├─ store          the video goes to Supabase Storage
  ├─ persist        a recordings row, status "analyzing"
  └─ respond 201    the browser navigates to /recordings/<id>

processRecording()  (background, status written to the database at every stage)
  ├─ analyzing      Gemini Files API + a strict responseSchema → steps with timestamps
  ├─ capturing      ffmpeg grabs one PNG per timestamp → Supabase Storage
  └─ ready | failed with a message the user can act on
```

The browser polls `GET /api/recordings/<id>` every 1.5s while the status is not
terminal, so progress survives a page reload and there is no in-memory job
state to lose when the server restarts.

## Project layout

```
src/
├─ app/
│  ├─ page.tsx                     upload + list of scripts
│  ├─ recordings/[recordingId]/    one script
│  └─ api/                         recordings, retry, steps
├─ components/
│  ├─ layout/    header and page shell
│  ├─ upload/    hero, dropzone, upload panel
│  ├─ processing/ pipeline timeline and skeletons
│  ├─ recordings/ list, detail, error card
│  ├─ steps/     step card, list, screenshot, lightbox
│  └─ ui/        button, field, badge, toast, icons
├─ hooks/        use-recording (polling), use-step-editing, use-toast
└─ lib/
   ├─ api/       response helpers, serializers, browser client
   ├─ config/    env parsing (the only place process.env is read)
   ├─ db/        schema, client, repository
   ├─ gemini/    client, prompt + response schema, extraction
   ├─ video/     ffmpeg wrapper, probe, frame capture
   ├─ pipeline/  processRecording — the one orchestrator
   ├─ storage/   StorageAdapter interface + Supabase implementation
   ├─ validation/ upload rules
   └─ types/     domain types
```

## Editing a script

Steps are editable in place: action, description and expected result. `⌘/Ctrl +
Enter` saves, `Escape` cancels. Steps can be reordered, deleted, and added by
hand. Every change is optimistic and rolls back if the request fails.

`Re-analyze` runs the pipeline again on the stored video — no re-upload needed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run check` | Types + lint |
| `npm run db:generate` | New migration from the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse the data |
| `npm run supabase:start` / `:stop` | Local Postgres + Storage |

## Limits

Videos up to 200 MB and 5 minutes, in MP4, MOV, WebM or MKV. Longer or
unreadable files are rejected before any Gemini call is made.

## Deploying

Two things are assumed by the local setup and need attention in production:

1. **FFmpeg must exist on the host.** A container image is the simplest route;
   `next start` on a plain serverless runtime has no FFmpeg binary.
2. **The pipeline runs in the request process.** For real traffic, move
   `processRecording` behind a queue so a restart cannot leave a recording stuck
   in `analyzing`. The status column already makes such rows easy to find.
