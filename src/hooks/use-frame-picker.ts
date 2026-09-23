"use client";

import { useCallback, useEffect, useState } from "react";

import { changeStepEvidenceRequest, fetchStepFrames } from "@/lib/api/client";
import type { SerializedStep } from "@/lib/api/serialize-recording";
import type { FramePreview } from "@/lib/types/frame-preview";

type UseFramePickerParams = {
  step: SerializedStep;
  onEvidenceChanged: (step: SerializedStep) => void;
  onError: (message: string) => void;
};

/**
 * Owns one frame-picking session: the strip around the current position, the
 * frame the consultant has settled on, and the save that replaces the evidence.
 */
export function useFramePicker({
  step,
  onEvidenceChanged,
  onError,
}: UseFramePickerParams) {
  const [frames, setFrames] = useState<FramePreview[]>([]);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [selectedSeconds, setSelectedSeconds] = useState(
    step.evidenceTimestampSeconds,
  );
  const [isLoadingFrames, setIsLoadingFrames] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFramesAround = useCallback(
    async (atSeconds: number, signal?: AbortSignal) => {
      setIsLoadingFrames(true);
      setLoadError(null);

      try {
        const response = await fetchStepFrames(step.id, atSeconds, signal);
        setFrames(response.frames);
        setDurationSeconds(response.durationSeconds);
      } catch (error) {
        if (signal?.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not read frames from this recording.",
        );
      } finally {
        if (!signal?.aborted) setIsLoadingFrames(false);
      }
    },
    [step.id],
  );

  // Initial load lives here rather than in `loadFramesAround` so the effect
  // itself never sets state synchronously; `isLoadingFrames` starts true.
  useEffect(() => {
    const abortController = new AbortController();

    fetchStepFrames(step.id, step.evidenceTimestampSeconds, abortController.signal)
      .then((response) => {
        setFrames(response.frames);
        setDurationSeconds(response.durationSeconds);
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not read frames from this recording.",
        );
      })
      .finally(() => {
        if (!abortController.signal.aborted) setIsLoadingFrames(false);
      });

    return () => abortController.abort();
  }, [step.id, step.evidenceTimestampSeconds]);

  const saveFrame = useCallback(async () => {
    setIsSaving(true);

    try {
      const { step: savedStep } = await changeStepEvidenceRequest(
        step.id,
        selectedSeconds,
      );
      onEvidenceChanged(savedStep);
      return true;
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not capture that frame.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [step.id, selectedSeconds, onEvidenceChanged, onError]);

  return {
    frames,
    durationSeconds,
    selectedSeconds,
    setSelectedSeconds,
    loadFramesAround,
    isLoadingFrames,
    isSaving,
    loadError,
    saveFrame,
  };
}
