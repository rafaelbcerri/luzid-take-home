"use client";

import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { classNames } from "@/components/ui/class-names";
import { AutoGrowingTextarea } from "@/components/ui/field";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { StepScreenshot } from "@/components/steps/step-screenshot";
import type { SerializedStep } from "@/lib/api/serialize-recording";

export type StepDraft = {
  action: string;
  description: string;
  expectedResult: string;
};

type StepCardProps = {
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
    description: step.description,
    expectedResult: step.expectedResult,
  };
}

/**
 * One step of the test script: read-only by default, editable in place.
 * Keyboard: Cmd/Ctrl+Enter saves, Escape cancels.
 */
export function StepCard({
  step,
  stepNumber,
  isFirst,
  isLast,
  onSave,
  onDelete,
  onMove,
  onOpenScreenshot,
}: StepCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<StepDraft>(() => toDraft(step));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The read-only view renders `step` directly, and entering edit mode seeds the
  // draft from it, so there is nothing to synchronize while the card sits idle.
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
        description: draft.description.trim(),
        expectedResult: draft.expectedResult.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save this step.",
      );
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

  return (
    <li
      className={classNames(
        "surface-card p-5 transition-shadow",
        isEditing ? "border-accent-500 shadow-md" : "hover:shadow-sm",
      )}
    >
      <div className="flex gap-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-900 text-[13px] font-semibold text-white">
          {stepNumber}
        </span>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-3" onKeyDown={handleEditorKeyDown}>
              <AutoGrowingTextarea
                label="Action"
                autoFocus
                value={draft.action}
                onChange={(event) =>
                  setDraft({ ...draft, action: event.target.value })
                }
                placeholder="Open the Manage Purchase Orders app"
              />
              <AutoGrowingTextarea
                label="Description"
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                placeholder="What exactly the user does, naming the fields and values on screen."
              />
              <AutoGrowingTextarea
                label="Expected result"
                value={draft.expectedResult}
                onChange={(event) =>
                  setDraft({ ...draft, expectedResult: event.target.value })
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
          ) : (
            <div className="space-y-2.5">
              <h3 className="text-[15px] leading-snug text-ink-900">
                {step.action}
              </h3>

              {step.description ? (
                <p className="text-sm leading-relaxed text-ink-500">
                  {step.description}
                </p>
              ) : null}

              {step.expectedResult ? (
                <p className="rounded-[var(--radius-control)] border-l-2 border-success-600/40 bg-success-50/60 px-3 py-2 text-sm leading-relaxed text-ink-700">
                  <span className="mr-1.5 text-[11px] font-semibold tracking-[0.06em] text-success-600 uppercase">
                    Expected
                  </span>
                  {step.expectedResult}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-1 pt-1">
                <Button size="sm" variant="secondary" onClick={startEditing}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move step ${stepNumber} up`}
                  disabled={isFirst}
                  onClick={() => void onMove(step.id, "up")}
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move step ${stepNumber} down`}
                  disabled={isLast}
                  onClick={() => void onMove(step.id, "down")}
                >
                  <ArrowDownIcon className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  aria-label={`Delete step ${stepNumber}`}
                  onClick={() => void onDelete(step.id)}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:block">
          <StepScreenshot
            screenshotUrl={step.screenshotUrl}
            timestampSeconds={step.timestampSeconds}
            stepNumber={stepNumber}
            onOpen={() => onOpenScreenshot(step)}
          />
        </div>
      </div>

      <div className="mt-4 sm:hidden">
        <StepScreenshot
          screenshotUrl={step.screenshotUrl}
          timestampSeconds={step.timestampSeconds}
          stepNumber={stepNumber}
          onOpen={() => onOpenScreenshot(step)}
        />
      </div>
    </li>
  );
}
