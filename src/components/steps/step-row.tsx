"use client";

import { useState, type KeyboardEvent } from "react";

import { StepScreenshot } from "@/components/steps/step-screenshot";
import { Button } from "@/components/ui/button";
import { AutoGrowingTextarea } from "@/components/ui/field";
import { RowMenu } from "@/components/ui/row-menu";
import type { SerializedStep } from "@/lib/api/serialize-recording";
import type { StepFieldUpdates } from "@/lib/types/process-step";

export type StepDraft = Required<StepFieldUpdates>;

type StepRowProps = {
  step: SerializedStep;
  stepNumber: number;
  isFirst: boolean;
  isLast: boolean;
  onSave: (stepId: string, draft: StepDraft) => Promise<void>;
  onDelete: (stepId: string) => Promise<void>;
  onMove: (stepId: string, direction: "up" | "down") => Promise<void>;
  onOpenScreenshot: (step: SerializedStep) => void;
};

function toDraft(step: SerializedStep): StepDraft {
  return {
    action: step.action,
    system: step.system,
    testData: step.testData,
    description: step.description,
    responsible: step.responsible,
    expectedResult: step.expectedResult,
  };
}

/** An em dash reads as "deliberately empty" where a blank cell reads as broken. */
function CellValue({ value }: { value: string }) {
  if (value.trim().length === 0) {
    return <span className="text-ink-300">—</span>;
  }

  return <>{value}</>;
}

/**
 * One row of the test script table: read-only by default, and expanding into a
 * full-width editor in place. Keyboard: Cmd/Ctrl+Enter saves, Escape cancels.
 */
export function StepRow({
  step,
  stepNumber,
  isFirst,
  isLast,
  onSave,
  onDelete,
  onMove,
  onOpenScreenshot,
}: StepRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<StepDraft>(() => toDraft(step));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The read-only row renders `step` directly, and entering edit mode seeds the
  // draft from it, so there is nothing to synchronize while the row sits idle.
  function startEditing() {
    setDraft(toDraft(step));
    setSaveError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraft(toDraft(step));
    setSaveError(null);
    setIsEditing(false);
  }

  function updateDraftField(field: keyof StepDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveDraft() {
    if (draft.action.trim().length === 0) {
      setSaveError("An action is required — it is the line a reader follows.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(step.id, {
        action: draft.action.trim(),
        system: draft.system.trim(),
        testData: draft.testData.trim(),
        description: draft.description.trim(),
        responsible: draft.responsible.trim(),
        expectedResult: draft.expectedResult.trim(),
      });
      setIsEditing(false);
    } catch {
      // useStepEditing already surfaced the reason in a toast; the row only has
      // to stay in edit mode so the typed text is not lost.
      setSaveError("Could not save this step. Your changes are still here.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
      return;
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void saveDraft();
    }
  }

  if (isEditing) {
    return (
      <tr className="border-t border-ink-200 bg-accent-50/40">
        <td className="px-4 py-4 align-top text-sm font-semibold text-ink-900">
          {stepNumber}
        </td>
        <td colSpan={7} className="px-4 py-4 align-top">
          <div className="space-y-3" onKeyDown={handleEditorKeyDown}>
            <div className="grid gap-3 sm:grid-cols-3">
              <AutoGrowingTextarea
                label="Action"
                autoFocus
                value={draft.action}
                onChange={(event) =>
                  updateDraftField("action", event.target.value)
                }
                placeholder="Open Workflow Diagram"
              />
              <AutoGrowingTextarea
                label="System"
                value={draft.system}
                onChange={(event) =>
                  updateDraftField("system", event.target.value)
                }
                placeholder="Luzid"
              />
              <AutoGrowingTextarea
                label="Responsible"
                value={draft.responsible}
                onChange={(event) =>
                  updateDraftField("responsible", event.target.value)
                }
                placeholder="Process Analyst"
              />
            </div>

            <AutoGrowingTextarea
              label="Test data"
              value={draft.testData}
              onChange={(event) =>
                updateDraftField("testData", event.target.value)
              }
              placeholder="Quantity: 1000; Plant: 1010"
            />
            <AutoGrowingTextarea
              label="Description"
              value={draft.description}
              onChange={(event) =>
                updateDraftField("description", event.target.value)
              }
              placeholder="What exactly the user does, naming the fields and values on screen."
            />
            <AutoGrowingTextarea
              label="Expected result"
              value={draft.expectedResult}
              onChange={(event) =>
                updateDraftField("expectedResult", event.target.value)
              }
              placeholder="What the user should see once this step is done."
              hint="⌘/Ctrl + Enter to save · Escape to cancel"
            />

            {saveError ? (
              <p role="alert" className="text-sm text-danger-600">
                {saveError}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button size="sm" isLoading={isSaving} onClick={saveDraft}>
                Save step
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-ink-200 align-top transition-colors hover:bg-ink-50/70">
      <td className="px-4 py-4 text-sm font-semibold text-ink-900">
        {stepNumber}
      </td>

      <td className="w-40 px-4 py-4 text-sm leading-snug font-medium text-ink-900">
        {step.action}
      </td>

      <td className="w-28 px-4 py-4 text-sm text-ink-700">
        <CellValue value={step.system} />
      </td>

      <td className="w-40 px-4 py-4 text-sm text-ink-700">
        <CellValue value={step.testData} />
      </td>

      <td className="px-4 py-4 text-sm leading-relaxed text-ink-500">
        <p>
          <CellValue value={step.description} />
        </p>
        {step.expectedResult ? (
          <p className="mt-2 rounded-[var(--radius-control)] border-l-2 border-success-600/40 bg-success-50/60 px-2.5 py-1.5 text-[13px] text-ink-700">
            <span className="mr-1.5 text-[11px] font-semibold tracking-[0.06em] text-success-600 uppercase">
              Expected
            </span>
            {step.expectedResult}
          </p>
        ) : null}
      </td>

      <td className="w-36 px-4 py-4 text-sm text-ink-700">
        <CellValue value={step.responsible} />
      </td>

      <td className="w-32 px-4 py-4">
        <StepScreenshot
          screenshotUrl={step.screenshotUrl}
          timestampSeconds={step.timestampSeconds}
          stepNumber={stepNumber}
          onOpen={() => onOpenScreenshot(step)}
          frameClassName="h-16 w-28"
        />
      </td>

      <td className="w-12 px-2 py-4">
        <RowMenu
          label={`Actions for step ${stepNumber}`}
          items={[
            { label: "Edit step", onSelect: startEditing },
            {
              label: "Move up",
              isDisabled: isFirst,
              onSelect: () => void onMove(step.id, "up"),
            },
            {
              label: "Move down",
              isDisabled: isLast,
              onSelect: () => void onMove(step.id, "down"),
            },
            {
              label: "Delete step",
              isDestructive: true,
              onSelect: () => void onDelete(step.id),
            },
          ]}
        />
      </td>
    </tr>
  );
}
