"use client";

import { useRef, useState, type DragEvent } from "react";

import { classNames } from "@/components/ui/class-names";
import { AlertIcon, UploadIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import {
  ACCEPTED_VIDEO_EXTENSIONS,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  formatMegabytes,
  validateVideoFile,
} from "@/lib/validation/video-file";

type VideoDropzoneProps = {
  onFileAccepted: (file: File) => void;
  isBusy: boolean;
  busyLabel?: string;
};

/**
 * Drag-and-drop target that also works as a plain button for keyboard users.
 * Rejections are shown inline so an unsupported file never reaches the server.
 */
export function VideoDropzone({
  onFileAccepted,
  isBusy,
  busyLabel,
}: VideoDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const validation = validateVideoFile(file);

    if (!validation.ok) {
      setRejectionReason(validation.reason);
      return;
    }

    setRejectionReason(null);
    onFileAccepted(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    if (isBusy) return;
    handleFiles(event.dataTransfer.files);
  }

  function openFilePicker() {
    if (isBusy) return;
    fileInputRef.current?.click();
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!isBusy) setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={classNames(
          "rounded-[var(--radius-card)] border-2 border-dashed p-8 text-center transition-colors",
          isDraggingOver
            ? "border-accent-500 bg-accent-50"
            : "border-ink-200 bg-ink-50",
          isBusy && "opacity-70",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_VIDEO_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          tabIndex={-1}
        />

        <div className="mx-auto grid size-11 place-items-center rounded-full bg-white text-accent-500 shadow-sm">
          {isBusy ? <Spinner className="size-5" /> : <UploadIcon className="size-5" />}
        </div>

        <p className="mt-4 text-[15px] font-medium text-ink-900">
          {isBusy
            ? (busyLabel ?? "Uploading your recording…")
            : "Drop a screen recording here"}
        </p>
        <p className="mt-1 text-sm text-ink-500">
          {isBusy
            ? "Keep this tab open while we read the video."
            : `MP4, MOV, WebM or MKV · up to ${MAX_VIDEO_DURATION_SECONDS / 60} minutes · max ${formatMegabytes(MAX_VIDEO_BYTES)}`}
        </p>

        <button
          type="button"
          onClick={openFilePicker}
          disabled={isBusy}
          className="mt-5 inline-flex h-10 items-center rounded-[var(--radius-control)] bg-accent-500 px-5 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Choose a video
        </button>
      </div>

      {rejectionReason ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-danger-50 px-3 py-2.5 text-sm text-danger-600"
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {rejectionReason}
        </p>
      ) : null}
    </div>
  );
}
