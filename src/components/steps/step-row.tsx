"use client";

import { useState, type KeyboardEvent } from "react";

import { StepScreenshot } from "@/components/steps/step-screenshot";
import { Button } from "@/components/ui/button";
import { classNames } from "@/components/ui/class-names";
import { AutoGrowingTextarea, LabelledInput } from "@/components/ui/field";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ExpandIcon,
  FrameIcon,
  GripIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { RowMenu } from "@/components/ui/row-menu";
import type { SerializedStep } from "@/lib/api/serialize-recording";
import { formatTimestampWithTenths } from "@/lib/format/timestamp";
import type { StepFieldUpdates } from "@/lib/types/process-step";

export type StepDraft = Required<StepFieldUpdates>;

type StepRowProps = {
  step: SerializedStep;
  stepNumber: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  isDropTarget: boolean;
  onSave: (stepId: string, draft: StepDraft) => Promise<void>;
  onDelete: (stepId: string) => Promise<void>;
  onMove: (stepId: string, direction: "up" | "down") => Promise<void>;
  onMoveToPosition: (stepId: string, position: number) => Promise<void>;
  onInsertBelow: (stepId: string) => Promise<void>;
  onChangeEvidence: (step: SerializedStep) => void;
  onOpenScreenshot: (step: SerializedStep) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
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

function EmptyCell() {
  return <span className="text-sm text-ink-300">—</span>;
}

/**
 * One row of the test script table: read-only by default, expanding in place
 * into a full-width editor. Keyboard: Cmd/Ctrl+Enter saves, Escape cancels.
 */
export function StepRow({
  step,
  stepNumber,
  totalSteps,
  isFirst,
  isLast,
  isDropTarget,
  onSave,
  onDelete,
  onMove,
  onMoveToPosition,
  onInsertBelow,
  onChangeEvidence,
  onOpenScreenshot,
  onDragStart,
  onDragOver,
  onDrop,
}: StepRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<StepDraft>(() => toDraft(step));
  // null means "untouched": the input then shows the row's live position, which
  // changes under it whenever a move succeeds, so nothing needs syncing.
  const [typedPosition, setTypedPosition] = useState<string | null>(null);
  const draftPosition = typedPosition ?? String(stepNumber);
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

  function commitPosition() {
    const parsedPosition = Number.parseInt(draftPosition, 10);

    setTypedPosition(null);

    if (!Number.isFinite(parsedPosition) || parsedPosition === stepNumber) {
      return;
    }

    void onMoveToPosition(step.id, parsedPosition);
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
      <tr className="border-t-2 border-accent-500 bg-accent-50/40">
        <td colSpan={7} className="p-6">
          <div className="flex gap-7" onKeyDown={handleEditorKeyDown}>
            <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
              <div className="flex items-end gap-4">
                <div className="w-[132px] shrink-0">
                  <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase">
                    Position
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={totalSteps}
                      value={draftPosition}
                      aria-label={`Position of step ${stepNumber}`}
                      onChange={(event) => setTypedPosition(event.target.value)}
                      onBlur={commitPosition}
                      className="h-11 w-[60px] rounded-[var(--radius-control)] border border-ink-300 bg-white px-2.5 text-[15px] font-semibold text-ink-900"
                    />
                    <button
                      type="button"
                      aria-label="Move this step one position earlier"
                      disabled={isFirst}
                      onClick={() => void onMove(step.id, "up")}
                      className="grid h-11 w-8 place-items-center rounded-[var(--radius-control)] border border-ink-300 bg-white text-ink-700 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowUpIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move this step one position later"
                      disabled={isLast}
                      onClick={() => void onMove(step.id, "down")}
                      className="grid h-11 w-8 place-items-center rounded-[var(--radius-control)] border border-ink-300 bg-white text-ink-700 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowDownIcon className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <LabelledInput
                    label="Action"
                    autoFocus
                    value={draft.action}
                    onChange={(event) =>
                      updateDraftField("action", event.target.value)
                    }
                    placeholder="Enter the material"
                    className="border-accent-500 font-semibold"
                  />
                </div>

                <div className="w-[220px] shrink-0">
                  <LabelledInput
                    label="System"
                    value={draft.system}
                    onChange={(event) =>
                      updateDraftField("system", event.target.value)
                    }
                    placeholder="SAP Fiori"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <LabelledInput
                  label="Test data"
                  value={draft.testData}
                  onChange={(event) =>
                    updateDraftField("testData", event.target.value)
                  }
                  placeholder="Material: STEEL-PLATE-10MM"
                  className="font-mono"
                />
                <LabelledInput
                  label="Responsible"
                  value={draft.responsible}
                  onChange={(event) =>
                    updateDraftField("responsible", event.target.value)
                  }
                  placeholder="Buyer"
                />
              </div>

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
              />

              {saveError ? (
                <p role="alert" className="text-sm text-danger-600">
                  {saveError}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <Button isLoading={isSaving} onClick={saveDraft}>
                  Save step
                </Button>
                <Button
                  variant="secondary"
                  onClick={cancelEditing}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <span className="text-[13px] text-ink-500">
                  ⌘/Ctrl + Enter to save · Escape to cancel
                </span>
                <span className="flex-1" />
                <Button variant="danger" onClick={() => void onDelete(step.id)}>
                  <TrashIcon className="size-4" />
                  Delete step
                </Button>
              </div>
            </div>

            <div className="flex w-[420px] shrink-0 flex-col gap-2.5">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase">
                Evidence
              </span>
              <StepScreenshot
                screenshotUrl={step.screenshotUrl}
                timestampSeconds={step.evidenceTimestampSeconds}
                stepNumber={stepNumber}
                size="panel"
                onOpen={() => onOpenScreenshot(step)}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="h-11 flex-1"
                  onClick={() => onChangeEvidence(step)}
                >
                  <FrameIcon className="size-4" />
                  Choose another frame
                </Button>
                <Button
                  variant="secondary"
                  aria-label="Open this frame full size"
                  disabled={step.screenshotUrl === null}
                  onClick={() => onOpenScreenshot(step)}
                  className="size-11 px-0"
                >
                  <ExpandIcon className="size-4" />
                </Button>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-500">
                Taken from the recording at{" "}
                {formatTimestampWithTenths(step.evidenceTimestampSeconds)}.
                Choosing another frame does not change the step&rsquo;s
                timestamp in the export.
              </p>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={classNames(
        "group border-t align-top transition-colors hover:bg-ink-50",
        isDropTarget ? "border-t-2 border-accent-500" : "border-ink-200",
      )}
    >
      <td className="p-4">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="cursor-grab text-ink-400 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <GripIcon className="size-3.5" />
          </span>
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-100 text-[13px] font-semibold text-ink-900 group-hover:bg-ink-900 group-hover:text-white">
            {stepNumber}
          </span>
        </span>
      </td>

      <td className="p-4 text-sm leading-snug font-semibold text-ink-900">
        {step.action}
      </td>

      <td className="p-4">
        {step.system.trim().length > 0 ? (
          <span className="inline-flex min-h-[22px] max-w-full items-center rounded border border-ink-200 px-2 py-0.5 text-xs leading-snug break-words text-ink-700">
            {step.system}
          </span>
        ) : (
          <EmptyCell />
        )}
      </td>

      <td className="p-4 text-sm leading-relaxed text-ink-700">
        {step.description.trim().length > 0 ? (
          <p>{step.description}</p>
        ) : (
          <EmptyCell />
        )}
        {step.testData.trim().length > 0 ? (
          <span className="mt-2 inline-flex items-center rounded bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-700">
            {step.testData}
          </span>
        ) : null}
      </td>

      <td className="p-4">
        <div className="flex flex-col items-start gap-2">
          <StepScreenshot
            screenshotUrl={step.screenshotUrl}
            timestampSeconds={step.evidenceTimestampSeconds}
            stepNumber={stepNumber}
            onOpen={() => onOpenScreenshot(step)}
            onChangeFrame={() => onChangeEvidence(step)}
          />
        </div>
      </td>

      <td className="p-4">
        {step.expectedResult.trim().length > 0 ? (
          <span className="block rounded-[var(--radius-control)] border-l-2 border-success-600/40 bg-success-50/60 px-3 py-2.5 text-[13px] leading-relaxed text-ink-700">
            {step.expectedResult}
          </span>
        ) : (
          <EmptyCell />
        )}
      </td>

      <td className="py-4 pr-4">
        <div className="flex justify-end">
          <RowMenu
            label={`Actions for step ${stepNumber}`}
            items={[
              {
                label: "Edit this step",
                icon: <PencilIcon className="size-4" />,
                onSelect: startEditing,
              },
              {
                label: "Change evidence frame",
                icon: <FrameIcon className="size-4" />,
                onSelect: () => onChangeEvidence(step),
              },
              {
                label: "Move up",
                icon: <ArrowUpIcon className="size-4" />,
                hasSeparatorAbove: true,
                isDisabled: isFirst,
                onSelect: () => void onMove(step.id, "up"),
              },
              {
                label: "Move down",
                icon: <ArrowDownIcon className="size-4" />,
                isDisabled: isLast,
                onSelect: () => void onMove(step.id, "down"),
              },
              {
                label: "Insert step below",
                icon: <PlusIcon className="size-4" />,
                onSelect: () => void onInsertBelow(step.id),
              },
              {
                label: "Delete step",
                icon: <TrashIcon className="size-4" />,
                hasSeparatorAbove: true,
                isDestructive: true,
                onSelect: () => void onDelete(step.id),
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}
