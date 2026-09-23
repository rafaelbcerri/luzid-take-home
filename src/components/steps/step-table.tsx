"use client";

import { useState } from "react";

import { StepRow, type StepDraft } from "@/components/steps/step-row";
import { classNames } from "@/components/ui/class-names";
import type { SerializedStep } from "@/lib/api/serialize-recording";

const COLUMN_HEADINGS = [
  "Step",
  "Action",
  "System",
  "Description",
  "Evidence",
  "Expected result",
  "Edit",
] as const;

type StepTableProps = {
  steps: SerializedStep[];
  onSaveStep: (stepId: string, draft: StepDraft) => Promise<void>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onMoveStep: (stepId: string, direction: "up" | "down") => Promise<void>;
  onMoveStepToPosition: (stepId: string, position: number) => Promise<void>;
  onInsertStep: (afterStepId: string) => Promise<void>;
  onChangeEvidence: (step: SerializedStep) => void;
  onAnnotateEvidence: (step: SerializedStep) => void;
  onOpenScreenshot: (step: SerializedStep) => void;
};

/** The test script itself: one row per step, scrolling sideways when narrow. */
export function StepTable({
  steps,
  onSaveStep,
  onDeleteStep,
  onMoveStep,
  onMoveStepToPosition,
  onInsertStep,
  onChangeEvidence,
  onAnnotateEvidence,
  onOpenScreenshot,
}: StepTableProps) {
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dropTargetStepId, setDropTargetStepId] = useState<string | null>(null);

  function handleDrop(targetStepId: string) {
    const draggedIndex = steps.findIndex((step) => step.id === draggedStepId);
    const targetIndex = steps.findIndex((step) => step.id === targetStepId);

    setDraggedStepId(null);
    setDropTargetStepId(null);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
      return;
    }

    void onMoveStepToPosition(steps[draggedIndex].id, targetIndex + 1);
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[76px]" />
            <col className="w-[180px]" />
            <col className="w-[108px]" />
            <col />
            <col className="w-[272px]" />
            <col className="w-[248px]" />
            <col className="w-[76px]" />
          </colgroup>
          <thead>
            <tr className="bg-ink-50">
              {COLUMN_HEADINGS.map((heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={classNames(
                    "px-4 py-3 text-[11px] font-semibold tracking-[0.08em] text-ink-500 uppercase",
                    index === COLUMN_HEADINGS.length - 1 && "text-right",
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                stepNumber={index + 1}
                totalSteps={steps.length}
                isFirst={index === 0}
                isLast={index === steps.length - 1}
                isDropTarget={
                  dropTargetStepId === step.id && draggedStepId !== step.id
                }
                onSave={onSaveStep}
                onDelete={onDeleteStep}
                onMove={onMoveStep}
                onMoveToPosition={onMoveStepToPosition}
                onInsertBelow={onInsertStep}
                onChangeEvidence={onChangeEvidence}
                onAnnotateEvidence={onAnnotateEvidence}
                onOpenScreenshot={onOpenScreenshot}
                onDragStart={() => setDraggedStepId(step.id)}
                onDragOver={() => setDropTargetStepId(step.id)}
                onDrop={() => handleDrop(step.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
