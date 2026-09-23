"use client";

import { useFormStatus } from "react-dom";

export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-[var(--radius-control)] text-xs font-medium text-ink-300 hover:text-white disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
