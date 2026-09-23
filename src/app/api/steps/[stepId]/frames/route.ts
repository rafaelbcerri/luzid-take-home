import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/responses";
import { getAuthenticatedUserId } from "@/lib/auth/session";
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
    const ownerUserId = await getAuthenticatedUserId();
    if (!ownerUserId) return apiError("Sign in to view these frames.", 401);
    const found = await findStepWithRecording(stepId, ownerUserId);

    if (!found) {
      return apiError("This step does not exist.", 404);
    }

    const requestedAt = request.nextUrl.searchParams.get("at");
    const parsedAt =
      requestedAt === null ? null : atSecondsSchema.safeParse(requestedAt);

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
