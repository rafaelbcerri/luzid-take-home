import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { createServerClient } from "@supabase/ssr";

import { env, STORAGE_BUCKETS } from "../src/lib/config/env";
import {
  deleteRecording,
  listStepsForRecording,
} from "../src/lib/db/recordings-repository";
import { storage } from "../src/lib/storage/supabase-storage";
import type { RecordingWithSteps } from "../src/lib/types/process-step";

async function main() {
  const workingDirectory = await mkdtemp(join(tmpdir(), "luzid-upload-check-"));
  const syntheticVideoPath = join(workingDirectory, "consultant-flow.mp4");
  await promisify(execFile)("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
    "-i", "color=c=white:s=960x540:r=2:d=8",
    "-vf", "drawtext=text='Step 1 Open purchase order':fontcolor=black:fontsize=42:x=40:y=120:enable='lt(t,4)',drawtext=text='Step 2 Approve purchase order':fontcolor=black:fontsize=42:x=40:y=120:enable='gte(t,4)'",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", syntheticVideoPath,
  ]);
  const email = `upload-check-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}`;
  const created = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert.equal(created.status, 200);
  const { id: ownerUserId } = (await created.json()) as { id: string };
  let recordingId: string | null = null;
  let videoPath: string | null = null;
  try {
    let cookies: { name: string; value: string }[] = [];
    const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => cookies,
        setAll: (items) => {
          cookies = items.map(({ name, value }) => ({ name, value }));
        },
      },
    });
    assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
    const cookie = cookies.map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join("; ");
    const video = await readFile(syntheticVideoPath);
    const formData = new FormData();
    formData.set("video", new Blob([new Uint8Array(video)], { type: "video/mp4" }), "consultant-flow.mp4");
    const upload = await fetch(new URL("/api/recordings", env.APP_ORIGIN), {
      method: "POST",
      headers: { Cookie: cookie },
      body: formData,
    });
    if (upload.status !== 201) {
      throw new Error(`Upload failed (${upload.status}): ${await upload.text()}`);
    }
    const uploadBody = (await upload.json()) as { recording: { id: string; videoPath: string } };
    recordingId = uploadBody.recording.id;
    videoPath = uploadBody.recording.videoPath;

    const statuses: string[] = [];
    let recording: RecordingWithSteps | null = null;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const response: Response = await fetch(new URL(`/api/recordings/${recordingId}`, env.APP_ORIGIN), {
        headers: { Cookie: cookie },
        cache: "no-store",
      });
      assert.equal(response.status, 200);
      recording = ((await response.json()) as { recording: RecordingWithSteps }).recording;
      if (!statuses.includes(recording.status)) statuses.push(recording.status);
      if (recording.status === "ready" || recording.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert(recording, "upload status did not load");
    assert(["ready", "failed"].includes(recording.status), "upload did not finish within 90 seconds");
    if (recording.status === "failed") {
      throw new Error(`Pipeline failed after ${statuses.join(" → ")}: ${recording.errorMessage}`);
    }
    assert(recording.steps.length > 0, "ready script had no steps");

    const firstStep = recording.steps[0];
    const edited = await fetch(new URL(`/api/steps/${firstStep.id}`, env.APP_ORIGIN), {
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "Confirm the purchase order is approved" }),
    });
    assert.equal(edited.status, 200);
    const updated = (await edited.json()) as { step: { action: string } };
    assert.equal(updated.step.action, "Confirm the purchase order is approved");
    console.log(`Upload flow passed: ${statuses.join(" → ")}, ${recording.steps.length} steps, edit saved.`);
  } finally {
    if (recordingId) {
      const steps = await listStepsForRecording(recordingId);
      await storage.remove({
        bucket: STORAGE_BUCKETS.screenshots,
        paths: steps.map((step) => step.screenshotPath).filter((path): path is string => !!path),
      });
      if (videoPath) await storage.remove({ bucket: STORAGE_BUCKETS.recordings, paths: [videoPath] });
      await deleteRecording(recordingId, ownerUserId);
    }
    await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${ownerUserId}`, {
      method: "DELETE",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
