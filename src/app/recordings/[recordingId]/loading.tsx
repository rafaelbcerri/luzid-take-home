import { PageShell } from "@/components/layout/page-shell";
import { StepSkeletonList } from "@/components/processing/step-skeleton-list";

export default function RecordingLoadingPage() {
  return (
    <PageShell isWide>
      <div className="space-y-8">
        <div className="skeleton h-40 rounded-[var(--radius-card)]" />
        <StepSkeletonList count={2} />
      </div>
    </PageShell>
  );
}
