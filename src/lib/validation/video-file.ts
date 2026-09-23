/**
 * Upload guard rails. Kept free of Next.js and database imports so the rules can
 * be reused by the API route, the client dropzone and tests alike.
 */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 5 * 60;

export const ACCEPTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
] as const;

export const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv"];

export type VideoValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

function hasAcceptedExtension(fileName: string): boolean {
  const lowerCaseName = fileName.toLowerCase();
  return ACCEPTED_VIDEO_EXTENSIONS.some((extension) =>
    lowerCaseName.endsWith(extension),
  );
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateVideoFile(file: {
  name: string;
  size: number;
  type: string;
}): VideoValidationResult {
  const hasAcceptedMimeType = (
    ACCEPTED_VIDEO_MIME_TYPES as readonly string[]
  ).includes(file.type);

  if (!hasAcceptedMimeType && !hasAcceptedExtension(file.name)) {
    return {
      ok: false,
      reason: `"${file.name}" is not a supported video. Use MP4, MOV, WebM or MKV.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, reason: "That file is empty — nothing to analyze." };
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      reason: `That video is ${formatMegabytes(file.size)}. The limit is ${formatMegabytes(MAX_VIDEO_BYTES)}.`,
    };
  }

  return { ok: true };
}

export function validateVideoDuration(
  durationSeconds: number,
): VideoValidationResult {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return {
      ok: false,
      reason:
        "We could not read this video. It may be corrupted or use an unsupported codec.",
    };
  }

  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    const minutes = Math.round(durationSeconds / 60);
    return {
      ok: false,
      reason: `This recording is about ${minutes} minutes long. Keep it under ${MAX_VIDEO_DURATION_SECONDS / 60} minutes.`,
    };
  }

  return { ok: true };
}
