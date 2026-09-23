import { runFfmpegBinary } from "@/lib/video/ffmpeg";

export type VideoMetadata = {
  durationSeconds: number;
  width: number | null;
  height: number | null;
};

type FfprobeOutput = {
  format?: { duration?: string };
  streams?: { width?: number; height?: number }[];
};

/** Reads duration and dimensions so bad uploads are rejected before Gemini. */
export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  const stdout = await runFfmpegBinary("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "format=duration",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    filePath,
  ]);

  const probe = JSON.parse(stdout.toString()) as FfprobeOutput;
  const videoStream = probe.streams?.[0];

  return {
    durationSeconds: Number(probe.format?.duration ?? Number.NaN),
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
  };
}
