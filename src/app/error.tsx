"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";

/**
 * Last line of defence: a readable screen instead of a blank page when a server
 * component throws — most often a missing environment variable.
 */
export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <AlertIcon className="size-6 text-danger-600" />
      <h1 className="mt-4 text-xl text-ink-900">Something broke</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        {error.message ||
          "An unexpected error stopped this page from rendering."}
      </p>
      <p className="mt-3 text-sm text-ink-400">
        If this mentions the database, Supabase Storage or an environment
        variable, run <code className="font-mono">npx supabase start</code> and
        check that <code className="font-mono">.env.local</code> is filled in.
      </p>

      <div className="mt-6">
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
