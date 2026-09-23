import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
      <section className="ink-gradient flex min-h-64 flex-col justify-between px-6 py-8 text-white sm:px-12 lg:min-h-screen lg:px-16 lg:py-12">
        <Link href="/" className="w-fit rounded-[var(--radius-control)]" aria-label="Luzid home">
          <Image src="/luzid-logo.svg" alt="Luzid" width={102} height={32} priority />
        </Link>
        <div className="max-w-xl pb-2 lg:pb-16">
          <p className="mb-4 text-xs font-semibold tracking-[0.12em] text-accent-500 uppercase">
            Consultant workspace
          </p>
          <h2 className="text-3xl leading-tight sm:text-4xl">
            From screen recording to a script your team can follow.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-300">
            Keep your test scripts organized, review every generated step, and share the result when it is ready.
          </p>
        </div>
        <p className="hidden text-xs text-ink-400 lg:block">Luzid · SAP transformation, made clearer.</p>
      </section>

      <section className="flex items-center justify-center bg-ink-50 px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl text-ink-900">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p>
          <div className="surface-card mt-7 p-6 sm:p-7">{children}</div>
        </div>
      </section>
    </main>
  );
}
