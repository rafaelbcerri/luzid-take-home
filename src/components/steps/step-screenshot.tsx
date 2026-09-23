"use client";

import Image from "next/image";
import { useState } from "react";

import { ImageIcon } from "@/components/ui/icons";
import { formatTimestamp } from "@/lib/format/timestamp";

type StepScreenshotProps = {
  screenshotUrl: string | null;
  timestampSeconds: number;
  stepNumber: number;
  onOpen: () => void;
};

/** Screenshot thumbnail, with a graceful placeholder when a frame is missing. */
export function StepScreenshot({
  screenshotUrl,
  timestampSeconds,
  stepNumber,
  onOpen,
}: StepScreenshotProps) {
  const [hasLoadError, setHasLoadError] = useState(false);

  if (!screenshotUrl || hasLoadError) {
    return (
      <div className="grid h-32 w-full shrink-0 place-items-center rounded-[var(--radius-control)] border border-dashed border-ink-200 bg-ink-50 text-center sm:w-60">
        <span className="px-3 text-xs text-ink-400">
          <ImageIcon className="mx-auto mb-1.5 size-4" />
          No screenshot for this step
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the screenshot for step ${stepNumber} full size`}
      className="group relative h-32 w-full shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-ink-200 bg-ink-100 sm:w-60"
    >
      <Image
        src={screenshotUrl}
        alt={`Screen at ${formatTimestamp(timestampSeconds)} during step ${stepNumber}`}
        fill
        sizes="240px"
        unoptimized
        onError={() => setHasLoadError(true)}
        className="object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
      />
      <span className="absolute right-1.5 bottom-1.5 rounded bg-ink-950/75 px-1.5 py-0.5 font-mono text-[11px] text-white">
        {formatTimestamp(timestampSeconds)}
      </span>
    </button>
  );
}
