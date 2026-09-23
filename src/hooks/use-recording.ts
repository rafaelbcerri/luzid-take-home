"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchRecording } from "@/lib/api/client";
import type { SerializedRecording } from "@/lib/api/serialize-recording";
import { isTerminalStatus } from "@/lib/types/process-step";

const POLL_INTERVAL_MS = 1_500;

/**
 * Keeps a recording in sync with the server while its pipeline is running, and
 * stops polling as soon as it reaches a terminal status. The component using
 * this owns the recording afterwards, which is what makes optimistic step edits
 * possible without the poller overwriting them.
 */
export function useRecording(initialRecording: SerializedRecording) {
  const [recording, setRecording] = useState(initialRecording);
  const [pollError, setPollError] = useState<string | null>(null);
  const isPolling = !isTerminalStatus(recording.status);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetchRecording(
        initialRecording.id,
        abortController.signal,
      );
      setRecording(response.recording);
      setPollError(null);
    } catch (error) {
      if (abortController.signal.aborted) return;
      setPollError(
        error instanceof Error
          ? error.message
          : "Lost contact with the server.",
      );
    }
  }, [initialRecording.id]);

  useEffect(() => {
    if (!isPolling) return;

    const intervalId = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isPolling, refresh]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  return { recording, setRecording, refresh, isPolling, pollError };
}
