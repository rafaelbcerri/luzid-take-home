import Image from "next/image";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { signOutAction } from "@/lib/auth/actions";
import { createAuthServerClient } from "@/lib/auth/server-client";

/** Dark header with the accent CTA, mirroring the luzid.io navigation bar. */
export async function SiteHeader({ isWide = false }: { isWide?: boolean }) {
  const { data } = await (await createAuthServerClient()).auth.getUser();
  const email = data.user?.email;
  return (
    <header className="bg-ink-900">
      <div
        className={`mx-auto flex h-16 items-center justify-between px-6 ${isWide ? "max-w-[1440px] lg:px-12" : "max-w-6xl"}`}
      >
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

        <nav className="flex items-center gap-3 sm:gap-5">
          {email ? <span className="hidden max-w-48 truncate text-xs text-ink-300 sm:inline" title={email}>{email}</span> : null}
          <Link
            href="/#upload"
            className="inline-flex h-8 items-center rounded-[var(--radius-control)] bg-accent-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-accent-600"
          >
            New script
          </Link>
          <form action={signOutAction}>
            <SignOutButton />
          </form>
        </nav>
      </div>
    </header>
  );
}
