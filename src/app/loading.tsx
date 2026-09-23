import { PageShell } from "@/components/layout/page-shell";
import { StepSkeletonList } from "@/components/processing/step-skeleton-list";

export default function LoadingPage() {
  return (
    <PageShell>
      <div className="space-y-8">
        <div className="skeleton h-56 rounded-[var(--radius-card)]" />
        <StepSkeletonList count={2} />
      </div>
    </PageShell>
  );
}
