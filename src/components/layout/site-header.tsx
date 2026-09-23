import Link from "next/link";

/** Dark header with the accent CTA, mirroring the luzid.io navigation bar. */
export function SiteHeader() {
  return (
    <header className="bg-ink-900">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-[var(--radius-control)] text-white"
        >
          <span className="grid size-7 place-items-center rounded-[var(--radius-control)] bg-accent-500 text-[13px] font-semibold">
            L
          </span>
          <span className="text-[15px] font-medium tracking-[-0.02em]">
            Luzid
          </span>
          <span className="ml-1 hidden rounded-[var(--radius-control)] bg-white/10 px-2 py-0.5 text-[11px] font-medium text-ink-300 sm:inline">
            Test Scripts
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="hidden text-sm font-medium text-ink-300 transition-colors hover:text-white sm:block"
          >
            Recordings
          </Link>
          <Link
            href="/#upload"
            className="inline-flex h-8 items-center rounded-[var(--radius-control)] bg-accent-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-accent-600"
          >
            New script
          </Link>
        </nav>
      </div>
    </header>
  );
}
