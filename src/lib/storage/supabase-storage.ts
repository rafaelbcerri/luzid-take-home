import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, STORAGE_BUCKETS } from "@/lib/config/env";
import type { StorageAdapter, StoredObject } from "@/lib/storage/storage-adapter";

const DEFAULT_SIGNED_URL_SECONDS = 60 * 60;

function createServiceRoleClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

class SupabaseStorageAdapter implements StorageAdapter {
  private readonly client = createServiceRoleClient();
  private bucketsReady: Promise<void> | null = null;

  ensureBuckets(): Promise<void> {
    this.bucketsReady ??= this.createMissingBuckets();
    return this.bucketsReady;
  }

  private async createMissingBuckets(): Promise<void> {
    const { data: existingBuckets, error } = await this.client.storage.listBuckets();

    if (error) {
      throw new Error(`Could not reach Supabase Storage: ${error.message}`);
    }

    const existingNames = new Set(existingBuckets.map((bucket) => bucket.name));

    for (const bucketName of Object.values(STORAGE_BUCKETS)) {
      if (existingNames.has(bucketName)) continue;

      const { error: createError } = await this.client.storage.createBucket(
        bucketName,
        { public: false },
      );

      // A parallel request may have won the race; that is not a failure.
      if (createError && !createError.message.includes("already exists")) {
        throw new Error(
          `Could not create bucket "${bucketName}": ${createError.message}`,
        );
      }
    }
  }

  async upload({
    bucket,
    path,
    body,
    contentType,
  }: {
    bucket: string;
    path: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    await this.ensureBuckets();

    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, body, { contentType, upsert: true });

    if (error) {
      throw new Error(`Upload of "${path}" failed: ${error.message}`);
    }

    return { bucket, path };
  }

  async download({
    bucket,
    path,
  }: {
    bucket: string;
    path: string;
  }): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(bucket).download(path);

    if (error || !data) {
      throw new Error(
        `Download of "${path}" failed: ${error?.message ?? "empty response"}`,
      );
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async createSignedUrl({
    bucket,
    path,
    expiresInSeconds = DEFAULT_SIGNED_URL_SECONDS,
  }: {
    bucket: string;
    path: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
      throw new Error(
        `Could not sign "${path}": ${error?.message ?? "empty response"}`,
      );
    }

    return data.signedUrl;
  }

  async remove({
    bucket,
    paths,
  }: {
    bucket: string;
    paths: string[];
  }): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.client.storage.from(bucket).remove(paths);

    if (error) {
      throw new Error(`Could not remove stored files: ${error.message}`);
    }
  }
}

export const storage: StorageAdapter = new SupabaseStorageAdapter();

export function buildRecordingVideoPath(
  recordingId: string,
  originalFileName: string,
): string {
  const extension = originalFileName.split(".").pop()?.toLowerCase() ?? "mp4";
  return `${recordingId}/source.${extension}`;
}

export function buildStepScreenshotPath(
  recordingId: string,
  stepId: string,
): string {
  return `${recordingId}/${stepId}.png`;
}
