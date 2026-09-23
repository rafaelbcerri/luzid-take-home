/**
 * The pipeline only ever talks to this interface, so swapping Supabase Storage
 * for S3/R2 later means adding one file — not editing the pipeline.
 */
export type StoredObject = {
  bucket: string;
  path: string;
};

export interface StorageAdapter {
  /** Creates the buckets the app needs, if they are not there yet. */
  ensureBuckets(): Promise<void>;
  upload(params: {
    bucket: string;
    path: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject>;
  download(params: { bucket: string; path: string }): Promise<Buffer>;
  /** A URL the browser can render for a short while. */
  createSignedUrl(params: {
    bucket: string;
    path: string;
    expiresInSeconds?: number;
  }): Promise<string>;
  remove(params: { bucket: string; paths: string[] }): Promise<void>;
}
