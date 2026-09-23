import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";

export default function NotFoundPage() {
  return (
    <PageShell>
      <div className="surface-card border-dashed px-6 py-16 text-center">
        <h1 className="text-xl text-ink-900">We could not find that page</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
          The script may have been deleted, or the link may be incomplete.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-[var(--radius-control)] bg-accent-500 px-5 text-sm font-medium text-white transition-colors hover:bg-accent-600"
        >
          Back to your scripts
        </Link>
      </div>
    </PageShell>
  );
}
