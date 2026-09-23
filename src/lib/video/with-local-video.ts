import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STORAGE_BUCKETS } from "@/lib/config/env";
import { storage } from "@/lib/storage/supabase-storage";

/**
 * Materialises a stored recording on local disk for the duration of one
 * operation. FFmpeg needs a seekable file, and the temp directory is removed
 * even when the work throws.
 */
export async function withLocalVideo<TResult>(
  videoPath: string,
  runWithVideo: (localVideoPath: string, videoBytes: Buffer) => Promise<TResult>,
): Promise<TResult> {
  const workingDirectory = await mkdtemp(join(tmpdir(), "luzid-video-"));

  try {
    const localVideoPath = join(workingDirectory, "source-video");
    const videoBytes = await downloadStoredVideo(videoPath);
    await writeFile(localVideoPath, videoBytes);

    return await runWithVideo(localVideoPath, videoBytes);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

/** Storage failures are reported in terms the user can act on. */
async function downloadStoredVideo(videoPath: string): Promise<Buffer> {
  try {
    return await storage.download({
      bucket: STORAGE_BUCKETS.recordings,
      path: videoPath,
    });
  } catch (error) {
    console.error(`[video] could not download ${videoPath}`, error);
    throw new Error(
      "We could not retrieve the stored video for this recording. Please upload it again.",
    );
  }
}
