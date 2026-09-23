import type { RecordingWithSteps } from "@/lib/types/process-step";

export function toPublicRecording(recording: RecordingWithSteps, token: string) {
  return {
    title: recording.title,
    status: recording.status,
    steps: recording.steps.map((step) => ({
      id: step.id,
      position: step.position,
      action: step.action,
      system: step.system,
      testData: step.testData,
      description: step.description,
      responsible: step.responsible,
      expectedResult: step.expectedResult,
      screenshotUrl: step.screenshotPath
        ? `/share/${encodeURIComponent(token)}/screenshots/${step.id}`
        : null,
    })),
  };
}

export type PublicRecording = ReturnType<typeof toPublicRecording>;
