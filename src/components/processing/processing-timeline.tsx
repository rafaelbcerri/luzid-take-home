import { classNames } from "@/components/ui/class-names";
import { CheckIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import type { RecordingStatus } from "@/lib/types/process-step";

type PipelineStage = {
  status: RecordingStatus;
  title: string;
  detail: string;
};

const PIPELINE_STAGES: PipelineStage[] = [
  {
    status: "uploading",
    title: "Uploading the recording",
    detail: "Storing the video and reading its metadata.",
  },
  {
    status: "analyzing",
    title: "Watching the video",
    detail: "Gemini is identifying each action and its timestamp.",
  },
  {
    status: "capturing",
    title: "Capturing screenshots",
    detail: "Extracting one frame per step at the exact moment it happens.",
  },
];

type StageState = "done" | "active" | "upcoming";

function resolveStageState(
  stage: PipelineStage,
  currentStatus: RecordingStatus,
): StageState {
  const stageIndex = PIPELINE_STAGES.findIndex(
    (candidate) => candidate.status === stage.status,
  );
  const currentIndex = PIPELINE_STAGES.findIndex(
    (candidate) => candidate.status === currentStatus,
  );

  if (currentStatus === "ready") return "done";
  if (currentIndex === -1) return "upcoming";
  if (stageIndex < currentIndex) return "done";
  if (stageIndex === currentIndex) return "active";
  return "upcoming";
}

/** Shows which pipeline stage a recording is in while it is being processed. */
export function ProcessingTimeline({ status }: { status: RecordingStatus }) {
  return (
    <ol className="space-y-1" aria-live="polite">
      {PIPELINE_STAGES.map((stage) => {
        const state = resolveStageState(stage, status);

        return (
          <li
            key={stage.status}
            className={classNames(
              "flex gap-3.5 rounded-[var(--radius-control)] px-3 py-3 transition-colors",
              state === "active" && "bg-accent-50",
            )}
          >
            <span
              className={classNames(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                state === "done" && "bg-success-50 text-success-600",
                state === "active" && "bg-accent-500 text-white",
                state === "upcoming" && "bg-ink-100 text-ink-400",
              )}
            >
              {state === "done" ? (
                <CheckIcon className="size-3.5" />
              ) : state === "active" ? (
                <Spinner className="size-3" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>

            <span>
              <span
                className={classNames(
                  "block text-sm font-medium",
                  state === "upcoming" ? "text-ink-400" : "text-ink-900",
                )}
              >
                {stage.title}
              </span>
              <span className="block text-xs text-ink-500">{stage.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
