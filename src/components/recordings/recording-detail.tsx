"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { ProcessingTimeline } from "@/components/processing/processing-timeline";
import { StepSkeletonList } from "@/components/processing/step-skeleton-list";
import { RecordingErrorCard } from "@/components/recordings/recording-error-card";
import { RecordingTitle } from "@/components/recordings/recording-title";
import { FramePickerDialog } from "@/components/steps/frame-picker-dialog";
import { ScreenshotLightbox } from "@/components/steps/screenshot-lightbox";
import { StepList } from "@/components/steps/step-list";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toast } from "@/components/ui/toast";
import {
  deleteRecording as deleteRecordingRequest,
  renameRecordingRequest,
  retryRecording,
} from "@/lib/api/client";
import type {
  SerializedRecording,
  SerializedStep,
} from "@/lib/api/serialize-recording";
import { formatRelativeDate, formatTimestamp } from "@/lib/format/timestamp";
import { useRecording } from "@/hooks/use-recording";
import { useStepEditing } from "@/hooks/use-step-editing";
import { useToast } from "@/hooks/use-toast";

/**
 * Owns the recording view: polls while the pipeline runs, then hands the steps
 * over to the editor. Everything the user can do to a script starts here.
 */
export function RecordingDetail({
  initialRecording,
}: {
  initialRecording: SerializedRecording;
}) {
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();
  const { recording, setRecording, refresh, isPolling, pollError } =
    useRecording(initialRecording);

  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [screenshotInFocus, setScreenshotInFocus] =
    useState<SerializedStep | null>(null);

  const [stepChangingEvidence, setStepChangingEvidence] =
    useState<SerializedStep | null>(null);

  const stepEditing = useStepEditing({
    recording,
    setRecording,
    onSuccess: (message) => showToast("success", message),
    onError: (message) => showToast("error", message),
  });

  async function handleRetry() {
    setIsRetrying(true);

    try {
      await retryRecording(recording.id);
      setRecording((current) => ({
        ...current,
        status: "analyzing",
        errorMessage: null,
      }));
      await refresh();
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Could not restart processing.",
      );
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleDelete() {
    const isConfirmed = window.confirm(
      `Delete "${recording.title}"? The video, steps and screenshots will be removed.`,
    );
    if (!isConfirmed) return;

    setIsDeleting(true);

    try {
      await deleteRecordingRequest(recording.id);
      router.push("/");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Could not delete this script.",
      );
      setIsDeleting(false);
    }
  }

  const stepCountLabel =
    recording.steps.length === 1 ? "1 step" : `${recording.steps.length} steps`;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-block rounded-[var(--radius-control)] text-sm font-medium text-ink-500 transition-colors hover:text-accent-500"
      >
        ← All scripts
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2.5">
            <StatusBadge status={recording.status} />
            {recording.status === "ready" ? (
              <span className="text-xs text-ink-400">{stepCountLabel}</span>
            ) : null}
          </div>

          <RecordingTitle
            title={recording.title}
            onRename={async (nextTitle) => {
              const previousTitle = recording.title;
              setRecording((current) => ({ ...current, title: nextTitle }));

              try {
                await renameRecordingRequest(recording.id, nextTitle);
                showToast("success", "Name saved");
              } catch (error) {
                setRecording((current) => ({
                  ...current,
                  title: previousTitle,
                }));
                throw error;
              }
            }}
          />

          <p className="mt-1.5 text-sm text-ink-400">
            {recording.originalFileName}
            {recording.durationSeconds
              ? ` · ${formatTimestamp(recording.durationSeconds)}`
              : ""}
            {` · uploaded ${formatRelativeDate(recording.createdAt)}`}
          </p>
        </div>

        <div className="flex gap-2">
          {recording.status === "ready" ? (
            <Button
              variant="secondary"
              isLoading={isRetrying}
              onClick={handleRetry}
              className="h-11"
            >
              Re-analyze
            </Button>
          ) : null}
          <Button
            variant="secondary"
            isLoading={isDeleting}
            onClick={handleDelete}
            className="h-11 text-danger-600"
          >
            Delete
          </Button>
        </div>
      </header>

      {pollError ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] bg-warning-50 px-3 py-2.5 text-sm text-warning-600"
        >
          {pollError} We will keep trying.
        </p>
      ) : null}

      {recording.status === "failed" ? (
        <RecordingErrorCard
          errorMessage={recording.errorMessage}
          isRetrying={isRetrying}
          onRetry={handleRetry}
        />
      ) : null}

      {isPolling ? (
        <section className="space-y-5">
          <div className="surface-card p-5">
            <ProcessingTimeline status={recording.status} />
          </div>
          <StepSkeletonList count={recording.steps.length || 3} />
        </section>
      ) : null}

      {recording.status === "ready" ? (
        <StepList
          steps={recording.steps}
          onSaveStep={stepEditing.saveStep}
          onDeleteStep={stepEditing.removeStep}
          onMoveStep={stepEditing.moveStep}
          onMoveStepToPosition={stepEditing.moveStepToPosition}
          onInsertStep={stepEditing.insertStepBelow}
          onChangeEvidence={setStepChangingEvidence}
          onAddStep={stepEditing.appendEmptyStep}
          isAddingStep={stepEditing.isAddingStep}
          onOpenScreenshot={setScreenshotInFocus}
        />
      ) : null}

      {screenshotInFocus?.screenshotUrl ? (
        <ScreenshotLightbox
          screenshotUrl={screenshotInFocus.screenshotUrl}
          caption={screenshotInFocus.action}
          timestampSeconds={screenshotInFocus.timestampSeconds}
          onClose={() => setScreenshotInFocus(null)}
        />
      ) : null}

      {stepChangingEvidence ? (
        <FramePickerDialog
          step={stepChangingEvidence}
          stepNumber={
            recording.steps.findIndex(
              (step) => step.id === stepChangingEvidence.id,
            ) + 1
          }
          onClose={() => setStepChangingEvidence(null)}
          onEvidenceChanged={(savedStep) => {
            stepEditing.applyChangedStep(savedStep);
            showToast("success", "Evidence updated");
          }}
          onError={(message) => showToast("error", message)}
        />
      ) : null}

      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
    </div>
  );
}
