"use client";

import Image from "next/image";
import { useState } from "react";

export function PublicScreenshot({
  screenshotUrl,
  stepNumber,
  action,
}: {
  screenshotUrl: string | null;
  stepNumber: number;
  action: string;
}) {
  const [hasLoadError, setHasLoadError] = useState(false);

  if (!screenshotUrl || hasLoadError) {
    return (
      <div className="grid min-h-48 place-items-center rounded-[var(--radius-control)] border border-dashed border-ink-300 bg-ink-50 px-4 text-center text-sm text-ink-500">
        No screenshot available for this step.
      </div>
    );
  }

  return (
    <a href={screenshotUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--radius-control)] border border-ink-200 hover:border-accent-500">
      <Image
        src={screenshotUrl}
        alt={`Screenshot for step ${stepNumber}: ${action}`}
        width={840}
        height={525}
        unoptimized
        onError={() => setHasLoadError(true)}
        className="h-auto w-full"
      />
    </a>
  );
}
