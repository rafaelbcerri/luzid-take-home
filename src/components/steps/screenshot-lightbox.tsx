"use client";

import Image from "next/image";
import { useEffect } from "react";

import { formatTimestamp } from "@/lib/format/timestamp";

type ScreenshotLightboxProps = {
  screenshotUrl: string;
  caption: string;
  timestampSeconds: number;
  onClose: () => void;
};

/** Full-size screenshot overlay, dismissed with Escape or a click outside. */
export function ScreenshotLightbox({
  screenshotUrl,
  caption,
  timestampSeconds,
  onClose,
}: ScreenshotLightboxProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={caption}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ink-950/85 p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[80vh] w-full max-w-5xl overflow-hidden rounded-[var(--radius-card)] bg-white"
      >
        <Image
          src={screenshotUrl}
          alt={caption}
          width={1280}
          height={800}
          unoptimized
          className="h-auto max-h-[80vh] w-full object-contain"
        />
      </div>

      <p className="text-center text-sm text-ink-300">
        {caption} · {formatTimestamp(timestampSeconds)} — press Escape to close
      </p>
    </div>
  );
}
