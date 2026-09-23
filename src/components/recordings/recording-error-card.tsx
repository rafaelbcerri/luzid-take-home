import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";

type RecordingErrorCardProps = {
  errorMessage: string | null;
  isRetrying: boolean;
  onRetry: () => void;
};

/** Shown when the pipeline failed, with the one action that can fix it. */
export function RecordingErrorCard({
  errorMessage,
  isRetrying,
  onRetry,
}: RecordingErrorCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-danger-600/25 bg-danger-50 p-6">
      <div className="flex gap-3.5">
        <AlertIcon className="mt-0.5 size-5 shrink-0 text-danger-600" />
        <div>
          <h2 className="text-base text-ink-900">
            We could not build this script
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-700">
            {errorMessage ??
              "Something went wrong while processing this recording."}
          </p>
          <p className="mt-2 text-sm text-ink-500">
            The video is still stored, so a retry does not need a new upload. If
            it fails again, try a recording that shows the process from start to
            finish with the screen clearly visible.
          </p>

          <Button
            className="mt-4"
            isLoading={isRetrying}
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
