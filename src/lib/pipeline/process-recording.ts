import { STORAGE_BUCKETS } from "@/lib/config/env";
import {
  listStepsForRecording,
  replaceSteps,
  setStepEvidence,
  updateRecordingStatus,
} from "@/lib/db/recordings-repository";
import { extractProcessSteps } from "@/lib/gemini/extract-process-steps";
import {
  buildStepScreenshotPath,
  storage,
} from "@/lib/storage/supabase-storage";
import type { ProcessStep, Recording } from "@/lib/types/process-step";
import {
  captureFrameAtTimestamp,
  clampTimestampToVideo,
} from "@/lib/video/capture-frame";
import { withLocalVideo } from "@/lib/video/with-local-video";

/**
 * Runs a recording through the whole pipeline: Gemini extracts the steps, then
 * FFmpeg captures one screenshot per step. Every stage writes its status to the
 * database, which is what the UI polls — there is no in-memory job state to
 * lose when the server restarts.
 *
 * Never throws: a failure is recorded as `status: "failed"` with a message the
 * user can act on.
 */
export async function processRecording(recording: Recording): Promise<void> {
  try {
    await withLocalVideo(
      recording.videoPath,
      async (localVideoPath, videoBytes) => {
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
      },
    );
  } catch (error) {
    console.error(`[pipeline] recording ${recording.id} failed`, error);

    await updateRecordingStatus({
      recordingId: recording.id,
      status: "failed",
      errorMessage: toUserFacingMessage(error),
    });
  }
}

/**
 * A frame that cannot be captured is not fatal: the step still renders, with a
 * placeholder instead of a screenshot.
 */
async function captureScreenshotsForSteps(params: {
  recordingId: string;
  localVideoPath: string;
  durationSeconds: number | null;
  steps: ProcessStep[];
}): Promise<void> {
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
}

/** Re-runs the pipeline for a recording that already has its video stored. */
export async function reprocessRecording(recording: Recording): Promise<void> {
  const existingSteps = await listStepsForRecording(recording.id);

  await storage.remove({
    bucket: STORAGE_BUCKETS.screenshots,
    paths: existingSteps
      .map((step) => step.screenshotPath)
      .filter((path): path is string => path !== null),
  });

  await processRecording(recording);
}

function guessMimeTypeFromPath(path: string): string {
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mkv")) return "video/x-matroska";
  return "video/mp4";
}

function toUserFacingMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong while processing this recording.";
}
