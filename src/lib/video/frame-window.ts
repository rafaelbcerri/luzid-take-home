import { clampTimestampToVideo } from "@/lib/video/capture-frame";

const DEFAULT_FRAME_COUNT = 6;
const DEFAULT_STEP_SECONDS = 0.8;

/** Rounds to tenths so two window entries never differ below what the UI shows. */
function roundToTenth(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}

/**
 * The timestamps offered beside a chosen frame. The centre is always in the
 * result — a consultant must be able to see which frame is the current one —
 * and everything is clamped into the video so FFmpeg is never asked for a
 * frame that does not exist.
 */
export function buildFrameWindow(params: {
  centerSeconds: number;
  durationSeconds: number | null;
  count?: number;
  stepSeconds?: number;
}): number[] {
  const count = params.count ?? DEFAULT_FRAME_COUNT;
  const stepSeconds = params.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const center = roundToTenth(
    clampTimestampToVideo(params.centerSeconds, params.durationSeconds),
  );

  const stepsBefore = Math.floor((count - 1) / 2);
  const offsets = Array.from(
    { length: count },
    (_unused, index) => (index - stepsBefore) * stepSeconds,
  );

  const timestamps = offsets.map((offset) =>
    roundToTenth(clampTimestampToVideo(center + offset, params.durationSeconds)),
  );

  return [...new Set([center, ...timestamps])]
    .sort((left, right) => left - right)
    .slice(0, count);
}
