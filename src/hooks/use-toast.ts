"use client";

import { useCallback, useState } from "react";

import type { ToastMessage } from "@/components/ui/toast";

/** Minimal single-slot toast queue: a newer message replaces the previous one. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback(
    (tone: ToastMessage["tone"], text: string) => {
      setToast({ id: Date.now(), tone, text });
    },
    [],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
