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

    // Same path as the original capture: the upload overwrites it, so no orphan.
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
