"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { StepCard, type StepDraft } from "@/components/steps/step-card";
import type { SerializedStep } from "@/lib/api/serialize-recording";

type StepListProps = {
  steps: SerializedStep[];
  onSaveStep: (stepId: string, draft: StepDraft) => Promise<void>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onMoveStep: (stepId: string, direction: "up" | "down") => Promise<void>;
  onAddStep: () => Promise<void>;
  isAddingStep: boolean;
  onOpenScreenshot: (step: SerializedStep) => void;
};

export function StepList({
  steps,
  onSaveStep,
  onDeleteStep,
  onMoveStep,
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
    <div className="space-y-3">
      <ul className="space-y-3">
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            stepNumber={index + 1}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
            onSave={onSaveStep}
            onDelete={onDeleteStep}
            onMove={onMoveStep}
            onOpenScreenshot={onOpenScreenshot}
          />
        ))}
      </ul>

      <Button
        variant="secondary"
        isLoading={isAddingStep}
        onClick={() => void onAddStep()}
        className="w-full border-dashed"
      >
        <PlusIcon className="size-4" />
        Add a step
      </Button>
    </div>
  );
}
