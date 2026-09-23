/** One scrub preview. `dataUrl` is null when FFmpeg could not read that frame. */
export type FramePreview = {
  timestampSeconds: number;
  dataUrl: string | null;
};
