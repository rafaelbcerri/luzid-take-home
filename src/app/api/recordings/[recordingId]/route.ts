import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/responses";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { serializeRecording } from "@/lib/api/serialize-recording";
import { STORAGE_BUCKETS } from "@/lib/config/env";
import {
  deleteRecording,
  findRecording,
  findRecordingWithSteps,
  listStepsForRecording,
  renameRecording,
} from "@/lib/db/recordings-repository";
import { storage } from "@/lib/storage/supabase-storage";
import { recordingTitleSchema } from "@/lib/validation/recording-title";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]">,
) {
  const { recordingId } = await context.params;

  try {
    const ownerUserId = await getAuthenticatedUserId();
    if (!ownerUserId) return apiError("Sign in to view this recording.", 401);
    const recording = await findRecordingWithSteps(recordingId, ownerUserId);

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
    const ownerUserId = await getAuthenticatedUserId();
    if (!ownerUserId) return apiError("Sign in to delete this recording.", 401);
    const recording = await findRecording(recordingId, ownerUserId);

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

    await deleteRecording(recordingId, ownerUserId);

    return apiOk({ deleted: true });
  } catch (error) {
    console.error(`[api] deleting recording ${recordingId} failed`, error);
    return apiError("Could not delete this recording.", 500);
  }
}

const renameRequestSchema = z.object({ title: recordingTitleSchema });

/** Renames a script. The name is the only recording field a user edits by hand. */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]">,
) {
  const { recordingId } = await context.params;

  try {
    const ownerUserId = await getAuthenticatedUserId();
    if (!ownerUserId) return apiError("Sign in to rename this recording.", 401);
    const parsed = renameRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "This name is not valid.",
        400,
      );
    }

    const recording = await renameRecording({
      recordingId,
      ownerUserId,
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
