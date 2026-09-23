"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { EvidenceAnnotationOverlay } from "@/components/steps/evidence-annotation-overlay";
import type { EvidenceAnnotation } from "@/lib/evidence/annotation-geometry";
import { formatTimestamp } from "@/lib/format/timestamp";

type ScreenshotLightboxProps = {
  screenshotUrl: string;
  annotations: EvidenceAnnotation[];
  caption: string;
  timestampSeconds: number;
  onClose: () => void;
};

/** Full-size screenshot overlay, dismissed with Escape or a click outside. */
export function ScreenshotLightbox({
  screenshotUrl,
  annotations,
  caption,
  timestampSeconds,
  onClose,
}: ScreenshotLightboxProps) {
  const [imageSize, setImageSize] = useState({ width: 1280, height: 720 });
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
          onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          className="h-auto max-h-[80vh] w-full object-contain"
        />
        <EvidenceAnnotationOverlay annotations={annotations} imageWidth={imageSize.width} imageHeight={imageSize.height} />
      </div>

      <p className="text-center text-sm text-ink-300">
        {caption} · {formatTimestamp(timestampSeconds)} — press Escape to close
      </p>
    </div>
  );
}
