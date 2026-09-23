import Image from "next/image";
import Link from "next/link";

import type { PublicRecording } from "@/lib/sharing/public-recording";
import { PublicScriptField } from "@/components/sharing/public-script-field";
import { PublicScreenshot } from "@/components/sharing/public-screenshot";

export function PublicScript({ recording }: { recording: PublicRecording }) {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-ink-900">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/login" aria-label="Luzid home" className="rounded-[var(--radius-control)]">
            <Image src="/luzid-logo.svg" alt="Luzid" width={102} height={32} priority />
          </Link>
          <span className="rounded-[var(--radius-control)] bg-white/10 px-3 py-1 text-xs font-medium text-white">
            Shared test script
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div className="mb-9 max-w-3xl">
          <p className="mb-3 text-xs font-semibold tracking-[0.1em] text-accent-600 uppercase">
            Read only · Shared by a consultant
          </p>
          <h1 className="text-3xl leading-tight sm:text-4xl">{recording.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            Follow the actions and expected results below. Ask the consultant for any changes.
          </p>
        </div>

        {recording.steps.length === 0 ? (
          <div className="surface-card px-6 py-10 text-sm text-ink-500">
            This script has no steps yet. Check back after the consultant has reviewed it.
          </div>
        ) : (
          <ol className="space-y-5">
            {recording.steps.map((step, index) => (
              <li key={step.id} className="surface-card overflow-hidden">
                <div className="flex items-start gap-4 border-b border-ink-200 bg-white px-5 py-4 sm:px-6">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent-50 text-sm font-semibold text-accent-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg leading-snug">{step.action}</h2>
                    {step.system ? <p className="mt-1 text-xs font-medium text-ink-500">{step.system}</p> : null}
                  </div>
                </div>
                <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
                  <div className="grid content-start gap-5">
                    {step.description ? <PublicScriptField label="Description" value={step.description} /> : null}
                    {step.testData ? <PublicScriptField label="Test data" value={step.testData} /> : null}
                    {step.responsible ? <PublicScriptField label="Responsible" value={step.responsible} /> : null}
                    <PublicScriptField label="Expected result" value={step.expectedResult || "—"} />
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-ink-500 uppercase">
                      Screenshot
                    </p>
                    <PublicScreenshot
                      screenshotUrl={step.screenshotUrl}
                      stepNumber={index + 1}
                      action={step.action}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
