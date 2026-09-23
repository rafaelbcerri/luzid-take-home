import { spawn } from "node:child_process";

export class FfmpegNotInstalledError extends Error {
  constructor(binary: string) {
    super(
      `"${binary}" was not found on this machine. Install FFmpeg (macOS: brew install ffmpeg) and restart the dev server.`,
    );
    this.name = "FfmpegNotInstalledError";
  }
}

export class FfmpegCommandError extends Error {
  constructor(binary: string, stderr: string) {
    super(`${binary} failed: ${stderr.trim().split("\n").slice(-3).join(" ")}`);
    this.name = "FfmpegCommandError";
  }
}

/**
 * Thin wrapper around the FFmpeg binaries. Returns stdout as a Buffer so the
 * same helper can capture PNG frames and JSON probe output.
 */
export function runFfmpegBinary(
  binary: "ffmpeg" | "ffprobe",
  args: string[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args);
    const stdoutChunks: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new FfmpegNotInstalledError(binary)
          : error,
      );
    });

    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve(Buffer.concat(stdoutChunks));
        return;
      }
      reject(new FfmpegCommandError(binary, stderr));
    });
  });
}
