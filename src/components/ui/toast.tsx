"use client";

import { useEffect } from "react";

import { classNames } from "@/components/ui/class-names";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";

export type ToastMessage = {
  id: number;
  tone: "success" | "error";
  text: string;
};

const AUTO_DISMISS_MS = 4_000;

/** Bottom-centre toast used to confirm saves and surface failures. */
export function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timeoutId = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timeoutId);
  }, [message.id, onDismiss]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-6"
    >
      <div
        className={classNames(
          "pointer-events-auto flex items-center gap-2.5 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-medium text-white shadow-lg",
          message.tone === "success" ? "bg-ink-900" : "bg-danger-600",
        )}
      >
        {message.tone === "success" ? (
          <CheckIcon className="size-4" />
        ) : (
          <AlertIcon className="size-4" />
        )}
        {message.text}
      </div>
    </div>
  );
}
