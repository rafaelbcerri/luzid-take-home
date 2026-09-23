import type { FramePreview } from "@/lib/types/frame-preview";
import { captureFrameAtTimestamp } from "@/lib/video/capture-frame";

/**
 * Grabs several small frames for the picker. A frame that fails is returned as
 * null rather than failing the whole strip — the same rule the pipeline uses.
 */
export async function capturePreviewFrames(params: {
  localVideoPath: string;
  timestamps: number[];
}): Promise<FramePreview[]> {
  return Promise.all(
    params.timestamps.map(async (timestampSeconds) => {
      try {
        const pngBytes = await captureFrameAtTimestamp({
          videoPath: params.localVideoPath,
          timestampSeconds,
        });

        return {
          timestampSeconds,
          dataUrl: `data:image/png;base64,${pngBytes.toString("base64")}`,
        };
      } catch (error) {
        console.error(
          `[video] preview frame at ${timestampSeconds}s failed`,
          error,
        );
        return { timestampSeconds, dataUrl: null };
      }
    }),
  );
}
