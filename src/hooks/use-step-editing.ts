"use client";

import { useCallback, useState } from "react";

import type { StepDraft } from "@/components/steps/step-card";
import {
  addStep,
  deleteStepRequest,
  reorderStepsRequest,
  updateStepRequest,
} from "@/lib/api/client";
import type {
  SerializedRecording,
  SerializedStep,
} from "@/lib/api/serialize-recording";

type UseStepEditingParams = {
  recording: SerializedRecording;
  setRecording: (updater: (current: SerializedRecording) => SerializedRecording) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

function moveItem<TItem>(
  items: TItem[],
  fromIndex: number,
  toIndex: number,
): TItem[] {
  const reordered = [...items];
  const [movedItem] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, movedItem);
  return reordered;
}

/**
 * All step mutations in one place. Each one updates the UI first and rolls back
 * to the previous steps if the request fails, so editing always feels instant
 * without the list ever drifting from the database.
 */
export function useStepEditing({
  recording,
  setRecording,
  onSuccess,
  onError,
}: UseStepEditingParams) {
  const [isAddingStep, setIsAddingStep] = useState(false);

  const setSteps = useCallback(
    (steps: SerializedStep[]) => {
      setRecording((current) => ({ ...current, steps }));
    },
    [setRecording],
  );

  const saveStep = useCallback(
    async (stepId: string, draft: StepDraft) => {
      const previousSteps = recording.steps;

      setSteps(
        previousSteps.map((step) =>
          step.id === stepId ? { ...step, ...draft } : step,
        ),
      );

      try {
        const { step: savedStep } = await updateStepRequest(stepId, draft);
        setSteps(
          previousSteps.map((step) => (step.id === stepId ? savedStep : step)),
        );
        onSuccess("Step saved");
      } catch (error) {
        setSteps(previousSteps);
        onError(
          error instanceof Error ? error.message : "Could not save this step.",
        );
        throw error;
      }
    },
    [recording.steps, setSteps, onSuccess, onError],
  );

  const removeStep = useCallback(
    async (stepId: string) => {
      const previousSteps = recording.steps;
      setSteps(previousSteps.filter((step) => step.id !== stepId));

      try {
        await deleteStepRequest(stepId);
        onSuccess("Step deleted");
      } catch (error) {
        setSteps(previousSteps);
        onError(
          error instanceof Error ? error.message : "Could not delete this step.",
        );
      }
    },
    [recording.steps, setSteps, onSuccess, onError],
  );

  const moveStep = useCallback(
    async (stepId: string, direction: "up" | "down") => {
      const previousSteps = recording.steps;
      const currentIndex = previousSteps.findIndex((step) => step.id === stepId);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= previousSteps.length) {
        return;
      }

      const reorderedSteps = moveItem(previousSteps, currentIndex, targetIndex);
      setSteps(reorderedSteps);

      try {
        const { steps } = await reorderStepsRequest(
          recording.id,
          reorderedSteps.map((step) => step.id),
        );
        setSteps(steps);
      } catch (error) {
        setSteps(previousSteps);
        onError(
          error instanceof Error ? error.message : "Could not reorder the steps.",
        );
      }
    },
    [recording.id, recording.steps, setSteps, onError],
  );

  const appendEmptyStep = useCallback(async () => {
    setIsAddingStep(true);

    try {
      const { step } = await addStep(recording.id);
      setSteps([...recording.steps, step]);
      onSuccess("Step added — fill it in");
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not add a step.",
      );
    } finally {
      setIsAddingStep(false);
    }
  }, [recording.id, recording.steps, setSteps, onSuccess, onError]);

  return { saveStep, removeStep, moveStep, appendEmptyStep, isAddingStep };
}
