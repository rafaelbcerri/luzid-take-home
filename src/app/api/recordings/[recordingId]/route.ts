import type { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api/responses";
import { serializeRecording } from "@/lib/api/serialize-recording";
import { STORAGE_BUCKETS } from "@/lib/config/env";
import {
  deleteRecording,
  findRecording,
  findRecordingWithSteps,
  listStepsForRecording,
} from "@/lib/db/recordings-repository";
import { storage } from "@/lib/storage/supabase-storage";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]">,
) {
  const { recordingId } = await context.params;

  try {
    const recording = await findRecordingWithSteps(recordingId);

    if (!recording) {
      return apiError("This recording does not exist.", 404);
    }

    return apiOk({ recording: await serializeRecording(recording) });
  } catch (error) {
    console.error(`[api] loading recording ${recordingId} failed`, error);
    return apiError("Could not load this recording.", 500);
  }
}

/** Removes the row (steps cascade) plus the video and screenshots in storage. */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]">,
) {
  const { recordingId } = await context.params;

  try {
    const recording = await findRecording(recordingId);

    if (!recording) {
      return apiError("This recording does not exist.", 404);
    }

    const steps = await listStepsForRecording(recordingId);

    await Promise.all([
      storage.remove({
        bucket: STORAGE_BUCKETS.recordings,
        paths: [recording.videoPath],
      }),
      storage.remove({
        bucket: STORAGE_BUCKETS.screenshots,
        paths: steps
          .map((step) => step.screenshotPath)
          .filter((path): path is string => path !== null),
      }),
    ]);

    await deleteRecording(recordingId);

    return apiOk({ deleted: true });
  } catch (error) {
    console.error(`[api] deleting recording ${recordingId} failed`, error);
    return apiError("Could not delete this recording.", 500);
  }
}
