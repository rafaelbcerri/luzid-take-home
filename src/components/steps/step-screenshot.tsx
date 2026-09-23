"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EvidenceAnnotationOverlay } from "@/components/steps/evidence-annotation-overlay";
import { classNames } from "@/components/ui/class-names";
import { FrameIcon, ImageIcon } from "@/components/ui/icons";
import { formatTimestampWithTenths } from "@/lib/format/timestamp";
import type { EvidenceAnnotation } from "@/lib/evidence/annotation-geometry";

type StepScreenshotSize = "thumbnail" | "panel";

type StepScreenshotProps = {
  screenshotUrl: string | null;
  annotations: EvidenceAnnotation[];
  timestampSeconds: number;
  stepNumber: number;
  onOpen: () => void;
  size?: StepScreenshotSize;
  /** When given, a missing frame can be replaced from here. */
  onChangeFrame?: () => void;
};

const FRAME_CLASS_NAMES: Record<StepScreenshotSize, string> = {
  thumbnail: "h-36 w-60",
  panel: "h-[252px] w-[420px]",
};

const IMAGE_SIZES: Record<StepScreenshotSize, string> = {
  thumbnail: "240px",
  panel: "420px",
};

/** The evidence for one step, with a graceful placeholder when a frame is missing. */
export function StepScreenshot({
  screenshotUrl,
  annotations,
  timestampSeconds,
  stepNumber,
  onOpen,
  size = "thumbnail",
  onChangeFrame,
}: StepScreenshotProps) {
  const [hasLoadError, setHasLoadError] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 1280, height: 720 });
  const timecode = formatTimestampWithTenths(timestampSeconds);

  if (!screenshotUrl || hasLoadError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <div
          className={classNames(
            "grid shrink-0 place-items-center rounded-[var(--radius-control)] border border-dashed border-ink-300 bg-ink-50 text-center",
            FRAME_CLASS_NAMES[size],
          )}
        >
          <span className="px-3 text-[13px] text-ink-500">
            <ImageIcon className="mx-auto mb-1 size-5" />
            No frame captured at {timecode}
          </span>
        </div>
        {onChangeFrame ? (
          <Button size="sm" variant="secondary" onClick={onChangeFrame}>
            <FrameIcon className="size-4" />
            Pick a frame
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the evidence frame for step ${stepNumber}, captured at ${timecode}`}
      className={classNames(
        "group relative shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-ink-200 bg-white transition-colors hover:border-ink-300",
        FRAME_CLASS_NAMES[size],
      )}
    >
      <Image
        src={screenshotUrl}
        alt={`Screen at ${timecode} during step ${stepNumber}`}
        fill
        sizes={IMAGE_SIZES[size]}
        unoptimized
        onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        onError={() => setHasLoadError(true)}
        className="object-contain"
      />
      <EvidenceAnnotationOverlay annotations={annotations} imageWidth={imageSize.width} imageHeight={imageSize.height} />
      <span className="absolute right-1.5 bottom-1.5 rounded bg-ink-950/80 px-1.5 py-0.5 font-mono text-[11px] text-white">
        {timecode}
      </span>
    </button>
  );
}
