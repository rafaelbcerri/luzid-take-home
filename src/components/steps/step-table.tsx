"use client";

import { StepRow, type StepDraft } from "@/components/steps/step-row";
import type { SerializedStep } from "@/lib/api/serialize-recording";

const COLUMN_HEADINGS = [
  "Step",
  "Action",
  "System",
  "Test data",
  "Description",
  "Responsible",
  "Evidence",
] as const;

type StepTableProps = {
  steps: SerializedStep[];
  onSaveStep: (stepId: string, draft: StepDraft) => Promise<void>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onMoveStep: (stepId: string, direction: "up" | "down") => Promise<void>;
  onOpenScreenshot: (step: SerializedStep) => void;
};

/** The test script itself: one row per step, scrolling sideways when narrow. */
export function StepTable({
  steps,
  onSaveStep,
  onDeleteStep,
  onMoveStep,
  onOpenScreenshot,
}: StepTableProps) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="bg-ink-50">
              {COLUMN_HEADINGS.map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-3 text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase"
                >
                  {heading}
                </th>
              ))}
              <th scope="col" className="w-12 px-2 py-3">
                <span className="sr-only">Step actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {steps.map((step, index) => (
              <StepRow
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
