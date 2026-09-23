import Link from "next/link";

export function SharedScriptUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center px-6">
      <p className="text-xs font-semibold tracking-[0.1em] text-accent-500 uppercase">Shared script</p>
      <h1 className="mt-3 text-3xl">This link is no longer available.</h1>
      <p className="mt-3 text-sm text-ink-500">Ask the consultant for a new sharing link.</p>
      <Link href="/login" className="mt-6 text-sm font-medium text-accent-600 hover:underline">
        Go to Luzid
      </Link>
    </main>
  );
}
