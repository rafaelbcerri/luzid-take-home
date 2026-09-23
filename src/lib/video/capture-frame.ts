import { runFfmpegBinary } from "@/lib/video/ffmpeg";

const SCREENSHOT_MAX_WIDTH = 1280;

/**
 * Grabs a single PNG frame at the given timestamp. Seeking before `-i` is the
 * fast path in FFmpeg, which matters when we capture one frame per step.
 */
export async function captureFrameAtTimestamp(params: {
  videoPath: string;
  timestampSeconds: number;
}): Promise<Buffer> {
  const safeTimestamp = Math.max(0, params.timestampSeconds);

  return runFfmpegBinary("ffmpeg", [
    "-ss",
    safeTimestamp.toFixed(3),
    "-i",
    params.videoPath,
    "-frames:v",
    "1",
    "-vf",
    `scale='min(${SCREENSHOT_MAX_WIDTH},iw)':-2`,
    "-f",
    "image2",
    "-c:v",
    "png",
    "pipe:1",
  ]);
}

/**
 * Keeps a requested timestamp inside the video, leaving a small margin so the
 * very last frame (often a black fade) is not picked.
 */
export function clampTimestampToVideo(
  timestampSeconds: number,
  durationSeconds: number | null,
): number {
  if (!durationSeconds || !Number.isFinite(durationSeconds)) {
    return Math.max(0, timestampSeconds);
  }
  const latestUsableTimestamp = Math.max(0, durationSeconds - 0.2);
  return Math.min(Math.max(0, timestampSeconds), latestUsableTimestamp);
}
