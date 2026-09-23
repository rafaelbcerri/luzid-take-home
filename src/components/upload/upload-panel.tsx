"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";
import { VideoDropzone } from "@/components/upload/video-dropzone";
import { uploadRecording } from "@/lib/api/client";

/**
 * Owns the upload interaction: sends the file, then hands the user over to the
 * recording page where the pipeline progress is shown.
 */
export function UploadPanel() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileAccepted(file: File) {
    setIsUploading(true);
    setUploadError(null);

    try {
      const { recording } = await uploadRecording(file);
      router.push(`/recordings/${recording.id}`);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "We could not upload this recording.",
      );
      setIsUploading(false);
    }
  }

  return (
    <section id="upload" className="surface-card p-6 shadow-sm">
      <h2 className="text-lg text-ink-900">Upload a recording</h2>
      <p className="mt-1 mb-5 text-sm text-ink-500">
        We watch the video, write the steps, and capture a screenshot for each
        one. This usually takes under a minute.
      </p>

      <VideoDropzone
        onFileAccepted={handleFileAccepted}
        isBusy={isUploading}
        busyLabel="Uploading and checking your video…"
      />

      {uploadError ? (
        <div
          role="alert"
          className="mt-3 flex items-start justify-between gap-3 rounded-[var(--radius-control)] border border-danger-600/20 bg-danger-50 px-3 py-2.5"
        >
          <p className="flex items-start gap-2 text-sm text-danger-600">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {uploadError}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUploadError(null)}
            className="text-danger-600 hover:bg-white"
          >
            Dismiss
          </Button>
        </div>
      ) : null}
    </section>
  );
}
