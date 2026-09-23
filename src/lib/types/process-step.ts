/** Processing lifecycle of an uploaded recording, in the order the stages happen. */
export const RECORDING_STATUSES = [
  "uploading",
  "analyzing",
  "capturing",
  "ready",
  "failed",
] as const;

export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

export const TERMINAL_RECORDING_STATUSES: readonly RecordingStatus[] = [
  "ready",
  "failed",
];

export function isTerminalStatus(status: RecordingStatus): boolean {
  return TERMINAL_RECORDING_STATUSES.includes(status);
}

/** A single documented action inside a process, as shown in a test script. */
export type ProcessStep = {
  id: string;
  recordingId: string;
  position: number;
  action: string;
  description: string;
  expectedResult: string;
  timestampSeconds: number;
  screenshotPath: string | null;
};

export type Recording = {
  id: string;
  title: string;
  status: RecordingStatus;
  errorMessage: string | null;
  originalFileName: string;
  videoPath: string;
  durationSeconds: number | null;
  createdAt: string;
};

export type RecordingWithSteps = Recording & {
  steps: ProcessStep[];
};

/** The shape Gemini is asked to return, before we persist or capture frames. */
export type ExtractedStep = {
  action: string;
  description: string;
  expectedResult: string;
  timestampSeconds: number;
};

export type ExtractedProcess = {
  title: string;
  steps: ExtractedStep[];
};
