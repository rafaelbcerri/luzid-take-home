"use client";

import { useFormStatus } from "react-dom";

export function AuthSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-accent-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Working…" : label}
    </button>
  );
}
