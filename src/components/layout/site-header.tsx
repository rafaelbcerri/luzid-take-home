import Image from "next/image";
import Link from "next/link";

/** Dark header with the accent CTA, mirroring the luzid.io navigation bar. */
export function SiteHeader() {
  return (
    <header className="bg-ink-900">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center rounded-[var(--radius-control)]"
        >
          <Image
            src="/luzid-logo.svg"
            alt="Luzid"
            width={102}
            height={32}
            priority
          />
        </Link>

        <nav>
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
