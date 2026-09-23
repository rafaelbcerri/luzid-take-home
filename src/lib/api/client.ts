/**
 * Browser-side wrapper around the API routes. Every call funnels through
 * `requestJson`, so error handling is identical everywhere in the UI.
 */
import type { SerializedRecording, SerializedStep } from "@/lib/api/serialize-recording";
import type { Recording, StepFieldUpdates } from "@/lib/types/process-step";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function requestJson<TResponse>(
  url: string,
  init?: RequestInit,
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiRequestError(
      "We could not reach the server. Check your connection and try again.",
      0,
    );
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "Something went wrong.";
    throw new ApiRequestError(message, response.status);
  }

  return body as TResponse;
}

export function uploadRecording(file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append("video", file);

  return requestJson<{ recording: Recording }>("/api/recordings", {
    method: "POST",
    body: formData,
    signal,
  });
}

export function fetchRecordings() {
  return requestJson<{ recordings: Recording[] }>("/api/recordings");
}

export function fetchRecording(recordingId: string, signal?: AbortSignal) {
  return requestJson<{ recording: SerializedRecording }>(
    `/api/recordings/${recordingId}`,
    { signal, cache: "no-store" },
  );
}

export function retryRecording(recordingId: string) {
  return requestJson<{ recording: Recording }>(
    `/api/recordings/${recordingId}/retry`,
    { method: "POST" },
  );
}

export function deleteRecording(recordingId: string) {
  return requestJson<{ deleted: true }>(`/api/recordings/${recordingId}`, {
    method: "DELETE",
  });
}

export function addStep(recordingId: string) {
  return requestJson<{ step: SerializedStep }>(
    `/api/recordings/${recordingId}/steps`,
    { method: "POST" },
  );
}

export function reorderStepsRequest(
  recordingId: string,
  orderedStepIds: string[],
) {
  return requestJson<{ steps: SerializedStep[] }>(
    `/api/recordings/${recordingId}/steps`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedStepIds }),
    },
  );
}

export function updateStepRequest(
  stepId: string,
  changes: StepFieldUpdates,
) {
  return requestJson<{ step: SerializedStep }>(`/api/steps/${stepId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}

export function deleteStepRequest(stepId: string) {
  return requestJson<{ deleted: true }>(`/api/steps/${stepId}`, {
    method: "DELETE",
  });
}
