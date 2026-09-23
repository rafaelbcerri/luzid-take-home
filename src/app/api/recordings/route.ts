import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api/responses";
import { STORAGE_BUCKETS } from "@/lib/config/env";
import { createRecording, listRecordings } from "@/lib/db/recordings-repository";
import { processRecording } from "@/lib/pipeline/process-recording";
import {
  buildRecordingVideoPath,
  storage,
} from "@/lib/storage/supabase-storage";
import {
  validateVideoDuration,
  validateVideoFile,
} from "@/lib/validation/video-file";
import { FfmpegNotInstalledError } from "@/lib/video/ffmpeg";
import { probeVideo } from "@/lib/video/probe-video";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    return apiOk({ recordings: await listRecordings() });
  } catch (error) {
    console.error("[api] listing recordings failed", error);
    return apiError("Could not load your recordings.", 500);
  }
}

/**
 * Accepts the upload, rejects bad videos before spending a Gemini call, then
 * starts the pipeline in the background and answers immediately so the browser
 * can navigate to the progress screen.
 */
export async function POST(request: NextRequest) {
  let workingDirectory: string | null = null;

  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("video");

    if (!(uploadedFile instanceof File)) {
      return apiError("No video was included in this upload.", 400);
    }

    const fileValidation = validateVideoFile({
      name: uploadedFile.name,
      size: uploadedFile.size,
      type: uploadedFile.type,
    });

    if (!fileValidation.ok) {
      return apiError(fileValidation.reason, 415);
    }

    const videoBytes = Buffer.from(await uploadedFile.arrayBuffer());

    workingDirectory = await mkdtemp(join(tmpdir(), "recording-upload-"));
    const localVideoPath = join(workingDirectory, "upload");
    await writeFile(localVideoPath, videoBytes);

    const metadata = await readVideoMetadata(localVideoPath);

    if (!metadata.ok) {
      return apiError(metadata.reason, 422);
    }

    const durationValidation = validateVideoDuration(metadata.durationSeconds);

    if (!durationValidation.ok) {
      return apiError(durationValidation.reason, 422);
    }

    // The storage key is decided before the row exists, so the recording is
    // never persisted pointing at a video that failed to upload.
    const videoPath = buildRecordingVideoPath(randomUUID(), uploadedFile.name);

    await storage.upload({
      bucket: STORAGE_BUCKETS.recordings,
      path: videoPath,
      body: videoBytes,
      contentType: uploadedFile.type || "video/mp4",
    });

    const recording = await createRecording({
      title: uploadedFile.name.replace(/\.[^.]+$/, ""),
      originalFileName: uploadedFile.name,
      videoPath,
      durationSeconds: metadata.durationSeconds,
    });

    // Deliberately not awaited: the client tracks progress by polling status.
    void processRecording(recording);

    return apiOk({ recording }, 201);
  } catch (error) {
    console.error("[api] upload failed", error);
    return apiError(
      error instanceof Error
        ? error.message
        : "We could not process this upload.",
      500,
    );
  } finally {
    if (workingDirectory) {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  }
}

type VideoMetadataResult =
  | { ok: true; durationSeconds: number }
  | { ok: false; reason: string };

/**
 * FFmpeg's stderr is useful in the server log but meaningless to a consultant,
 * so an unreadable file becomes one clear sentence instead.
 */
async function readVideoMetadata(
  localVideoPath: string,
): Promise<VideoMetadataResult> {
  try {
    const { durationSeconds } = await probeVideo(localVideoPath);
    return { ok: true, durationSeconds };
  } catch (error) {
    if (error instanceof FfmpegNotInstalledError) throw error;

    console.error("[api] ffprobe could not read the upload", error);
    return {
      ok: false,
      reason:
        "We could not read this video. It may be incomplete, corrupted, or use a codec we cannot open.",
    };
  }
}
