"use client";

import type { StepDraft } from "@/components/steps/step-row";
import { StepTable } from "@/components/steps/step-table";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import type { SerializedStep } from "@/lib/api/serialize-recording";

type StepListProps = {
  steps: SerializedStep[];
  onSaveStep: (stepId: string, draft: StepDraft) => Promise<void>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onMoveStep: (stepId: string, direction: "up" | "down") => Promise<void>;
  onMoveStepToPosition: (stepId: string, position: number) => Promise<void>;
  onInsertStep: (afterStepId: string) => Promise<void>;
  onChangeEvidence: (step: SerializedStep) => void;
  onAddStep: () => Promise<void>;
  isAddingStep: boolean;
  onOpenScreenshot: (step: SerializedStep) => void;
};

export function StepList({
  steps,
  onSaveStep,
  onDeleteStep,
  onMoveStep,
  onMoveStepToPosition,
  onInsertStep,
  onChangeEvidence,
  onAddStep,
  isAddingStep,
  onOpenScreenshot,
}: StepListProps) {
  if (steps.length === 0) {
    return (
      <div className="surface-card border-dashed px-6 py-10 text-center">
        <h3 className="text-base text-ink-900">This script has no steps</h3>
        <p className="mx-auto mt-1 mb-5 max-w-sm text-sm text-ink-500">
          Every step was deleted. Add one by hand, or re-run the analysis to
          extract them from the recording again.
        </p>
        <Button isLoading={isAddingStep} onClick={() => void onAddStep()}>
          <PlusIcon className="size-4" />
          Add the first step
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[19px] text-ink-900">Process steps</h2>
          <p className="text-sm text-ink-500">
            Every action a colleague repeats to reproduce this process. Drag a
            row, or use its menu, to change the order.
          </p>
        </div>
        <span className="text-[13px] text-ink-500">
          {steps.length === 1 ? "1 step" : `${steps.length} steps`}
        </span>
      </div>

      <StepTable
        steps={steps}
        onSaveStep={onSaveStep}
        onDeleteStep={onDeleteStep}
        onMoveStep={onMoveStep}
        onMoveStepToPosition={onMoveStepToPosition}
        onInsertStep={onInsertStep}
        onChangeEvidence={onChangeEvidence}
        onOpenScreenshot={onOpenScreenshot}
      />

      <Button
        variant="secondary"
        isLoading={isAddingStep}
        onClick={() => void onAddStep()}
        className="w-full border-dashed"
      >
        <PlusIcon className="size-4" />
        Add a step
      </Button>
    </section>
  );
}
