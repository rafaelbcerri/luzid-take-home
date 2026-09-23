import { classNames } from "@/components/ui/class-names";
import { Spinner } from "@/components/ui/spinner";
import type { RecordingStatus } from "@/lib/types/process-step";

const STATUS_PRESENTATION: Record<
  RecordingStatus,
  { label: string; className: string; showSpinner: boolean }
> = {
  uploading: {
    label: "Uploading",
    className: "bg-ink-100 text-ink-500",
    showSpinner: true,
  },
  analyzing: {
    label: "Analyzing video",
    className: "bg-accent-50 text-accent-600",
    showSpinner: true,
  },
  capturing: {
    label: "Capturing screenshots",
    className: "bg-accent-50 text-accent-600",
    showSpinner: true,
  },
  ready: {
    label: "Ready",
    className: "bg-success-50 text-success-600",
    showSpinner: false,
  },
  failed: {
    label: "Failed",
    className: "bg-danger-50 text-danger-600",
    showSpinner: false,
  },
};

export function StatusBadge({ status }: { status: RecordingStatus }) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-medium",
        presentation.className,
      )}
    >
      {presentation.showSpinner ? <Spinner className="size-3" /> : null}
      {presentation.label}
    </span>
  );
}
