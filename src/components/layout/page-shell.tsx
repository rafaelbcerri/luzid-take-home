import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";

/** Header + centred content column shared by every page. */
export function PageShell({
  children,
  isWide = false,
}: {
  children: ReactNode;
  /** The script table needs the room; every other page keeps the narrow column. */
  isWide?: boolean;
}) {
  const widthClassName = isWide ? "max-w-[1440px] lg:px-12" : "max-w-6xl";

  return (
    <>
      <SiteHeader isWide={isWide} />
      <main className={`mx-auto w-full flex-1 px-6 py-10 ${widthClassName}`}>
        {children}
      </main>
      <footer className="border-t border-ink-200 py-6">
        <p className={`mx-auto px-6 text-xs text-ink-500 ${widthClassName}`}>
          Steps and screenshots are generated with Gemini video understanding.
          Always review them before sharing a script.
        </p>
      </footer>
    </>
  );
}
