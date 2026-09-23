"use client";

import Image from "next/image";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { classNames } from "@/components/ui/class-names";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ImageIcon,
} from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { useFramePicker } from "@/hooks/use-frame-picker";
import type { SerializedStep } from "@/lib/api/serialize-recording";
import {
  formatTimestamp,
  formatTimestampWithTenths,
} from "@/lib/format/timestamp";

const FRAME_NUDGE_SECONDS = 0.2;

type FramePickerDialogProps = {
  step: SerializedStep;
  stepNumber: number;
  onClose: () => void;
  onEvidenceChanged: (step: SerializedStep) => void;
  onError: (message: string) => void;
};

/** Picks the frame that best shows one step, without touching its timestamp. */
export function FramePickerDialog({
  step,
  stepNumber,
  onClose,
  onEvidenceChanged,
  onError,
}: FramePickerDialogProps) {
  const picker = useFramePicker({ step, onEvidenceChanged, onError });

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

  const selectedFrame = picker.frames.find(
    (frame) => frame.timestampSeconds === picker.selectedSeconds,
  );

  async function handleUseFrame() {
    const didSave = await picker.saveFrame();
    if (didSave) onClose();
  }

  function moveTo(seconds: number) {
    const clamped = Math.min(
      Math.max(0, seconds),
      picker.durationSeconds ?? seconds,
    );
    picker.setSelectedSeconds(clamped);
    void picker.loadFramesAround(clamped);
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`Choose the evidence for step ${stepNumber}`}
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/55 p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-[1080px] max-w-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-6 border-b border-ink-200 px-6 py-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[19px] text-ink-900">
              Choose the evidence for step {stepNumber}
            </h2>
            <p className="text-sm text-ink-500">
              Scrub the recording, then pick the frame that shows the action most
              clearly.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close without changing the evidence"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-ink-200 bg-white text-ink-700 transition-colors hover:bg-ink-50"
          >
            <CloseIcon className="size-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="relative grid h-[420px] w-full place-items-center overflow-hidden rounded-[var(--radius-control)] border border-ink-300 bg-ink-50">
            {picker.isLoadingFrames && picker.frames.length === 0 ? (
              <Spinner />
            ) : picker.loadError ? (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <p role="alert" className="text-sm text-danger-600">
                  {picker.loadError}
                </p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void picker.loadFramesAround(picker.selectedSeconds)
                  }
                >
                  Try again
                </Button>
              </div>
            ) : selectedFrame?.dataUrl ? (
              <Image
                src={selectedFrame.dataUrl}
                alt={`Frame at ${formatTimestampWithTenths(picker.selectedSeconds)}`}
                fill
                unoptimized
                sizes="1032px"
                className="object-contain"
              />
            ) : (
              <span className="text-[13px] text-ink-500">
                <ImageIcon className="mx-auto mb-1 size-5" />
                This frame could not be read
              </span>
            )}
            <span className="absolute right-3 bottom-3 rounded bg-ink-950/80 px-2.5 py-1 font-mono text-[13px] text-white">
              {formatTimestampWithTenths(picker.selectedSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <button
              type="button"
              aria-label="Step back one frame"
              onClick={() => moveTo(picker.selectedSeconds - FRAME_NUDGE_SECONDS)}
              className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-ink-300 bg-white text-ink-700 transition-colors hover:bg-ink-50"
            >
              <ChevronLeftIcon className="size-[17px]" />
            </button>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase">
                Position in the recording
              </span>
              {/* Frames load on release, not per drag tick: one FFmpeg run per pixel would swamp the server. */}
              <input
                type="range"
                min={0}
                max={picker.durationSeconds ?? 0}
                step={0.1}
                value={picker.selectedSeconds}
                onChange={(event) =>
                  picker.setSelectedSeconds(Number(event.target.value))
                }
                onMouseUp={() =>
                  void picker.loadFramesAround(picker.selectedSeconds)
                }
                onKeyUp={() =>
                  void picker.loadFramesAround(picker.selectedSeconds)
                }
                className="w-full accent-accent-500"
              />
            </label>
            <button
              type="button"
              aria-label="Step forward one frame"
              onClick={() => moveTo(picker.selectedSeconds + FRAME_NUDGE_SECONDS)}
              className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-ink-300 bg-white text-ink-700 transition-colors hover:bg-ink-50"
            >
              <ChevronRightIcon className="size-[17px]" />
            </button>
            <span className="w-28 shrink-0 text-right font-mono text-sm text-ink-700">
              {formatTimestampWithTenths(picker.selectedSeconds)} /{" "}
              {formatTimestamp(picker.durationSeconds ?? 0)}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase">
              Nearby frames
            </span>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {picker.frames.map((frame) => {
                const isSelected =
                  frame.timestampSeconds === picker.selectedSeconds;

                return (
                  <button
                    key={frame.timestampSeconds}
                    type="button"
                    disabled={frame.dataUrl === null}
                    aria-current={isSelected ? "true" : undefined}
                    aria-label={`Use the frame at ${formatTimestampWithTenths(frame.timestampSeconds)}`}
                    onClick={() =>
                      picker.setSelectedSeconds(frame.timestampSeconds)
                    }
                    className={classNames(
                      "relative h-24 w-[158px] shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-ink-100 disabled:cursor-not-allowed",
                      isSelected
                        ? "border-2 border-accent-500 shadow-[0_0_0_3px_rgba(231,75,46,0.18)]"
                        : "border border-ink-200 hover:border-ink-300",
                    )}
                  >
                    {frame.dataUrl ? (
                      <Image
                        src={frame.dataUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="158px"
                        className="object-cover object-top"
                      />
                    ) : (
                      <ImageIcon className="mx-auto size-4 text-ink-400" />
                    )}
                    <span
                      className={classNames(
                        "absolute right-1 bottom-1 rounded-sm px-1.5 py-px font-mono text-[11px] text-white",
                        isSelected ? "bg-accent-500" : "bg-ink-950/80",
                      )}
                    >
                      {formatTimestampWithTenths(frame.timestampSeconds)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 border-t border-ink-200 bg-ink-50 px-6 py-4">
          <span className="text-[13px] text-ink-500">
            The chosen frame replaces the evidence for this step only.
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-11" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="h-11"
              isLoading={picker.isSaving}
              disabled={selectedFrame?.dataUrl === undefined && !picker.isSaving}
              onClick={handleUseFrame}
            >
              Use this frame
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
