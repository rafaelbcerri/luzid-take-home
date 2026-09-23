import { STORAGE_BUCKETS } from "@/lib/config/env";
import { storage } from "@/lib/storage/supabase-storage";
import type { ProcessStep, RecordingWithSteps } from "@/lib/types/process-step";

/** A step as the browser receives it: the stored path resolved to a URL. */
export type SerializedStep = ProcessStep & { screenshotUrl: string | null };

export type SerializedRecording = Omit<RecordingWithSteps, "steps"> & {
  steps: SerializedStep[];
};

async function toSignedScreenshotUrl(
  screenshotPath: string | null,
): Promise<string | null> {
  if (!screenshotPath) return null;

  try {
    return await storage.createSignedUrl({
      bucket: STORAGE_BUCKETS.screenshots,
      path: screenshotPath,
    });
  } catch {
    // A missing screenshot degrades to a placeholder rather than a broken page.
    return null;
  }
}

export async function serializeStep(
  step: ProcessStep,
): Promise<SerializedStep> {
  return {
    ...step,
    screenshotUrl: await toSignedScreenshotUrl(step.screenshotPath),
  };
}

export async function serializeRecording(
  recording: RecordingWithSteps,
): Promise<SerializedRecording> {
  return {
    ...recording,
    steps: await Promise.all(recording.steps.map(serializeStep)),
  };
}
