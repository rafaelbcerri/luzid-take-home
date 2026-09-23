import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";

/** Header + centred content column shared by every page. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
      <footer className="border-t border-ink-200 py-6">
        <p className="mx-auto max-w-6xl px-6 text-xs text-ink-400">
          Steps and screenshots are generated with Gemini video understanding.
          Always review them before sharing a script.
        </p>
      </footer>
    </>
  );
}
