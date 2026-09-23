"use client";

import Image from "next/image";
import { useState } from "react";

import { classNames } from "@/components/ui/class-names";
import { ImageIcon } from "@/components/ui/icons";
import { formatTimestamp } from "@/lib/format/timestamp";

type StepScreenshotProps = {
  screenshotUrl: string | null;
  timestampSeconds: number;
  stepNumber: number;
  onOpen: () => void;
  /** Sizing for the frame, so the same thumbnail fits a table cell or a card. */
  frameClassName?: string;
};

/** Screenshot thumbnail, with a graceful placeholder when a frame is missing. */
export function StepScreenshot({
  screenshotUrl,
  timestampSeconds,
  stepNumber,
  onOpen,
  frameClassName = "h-32 w-full sm:w-60",
}: StepScreenshotProps) {
  const [hasLoadError, setHasLoadError] = useState(false);

  if (!screenshotUrl || hasLoadError) {
    return (
      <div
        className={classNames(
          "grid shrink-0 place-items-center rounded-[var(--radius-control)] border border-dashed border-ink-200 bg-ink-50 text-center",
          frameClassName,
        )}
      >
        <span className="px-2 text-[11px] text-ink-400">
          <ImageIcon className="mx-auto mb-1 size-4" />
          No screenshot
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the screenshot for step ${stepNumber} full size`}
      className={classNames(
        "group relative shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-ink-200 bg-ink-100",
        frameClassName,
      )}
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
