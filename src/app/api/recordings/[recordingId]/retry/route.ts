import type { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api/responses";
import {
  findRecording,
  updateRecordingStatus,
} from "@/lib/db/recordings-repository";
import { reprocessRecording } from "@/lib/pipeline/process-recording";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Re-runs extraction on a recording whose video is already stored. */
export async function POST(
  _request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]/retry">,
) {
  const { recordingId } = await context.params;

  try {
    const recording = await findRecording(recordingId);

    if (!recording) {
      return apiError("This recording does not exist.", 404);
    }

    if (recording.status === "analyzing" || recording.status === "capturing") {
      return apiError("This recording is already being processed.", 409);
    }

    await updateRecordingStatus({ recordingId, status: "analyzing" });
    void reprocessRecording(recording);

    return apiOk({ recording: { ...recording, status: "analyzing" as const } });
  } catch (error) {
    console.error(`[api] retrying recording ${recordingId} failed`, error);
    return apiError("Could not restart processing.", 500);
  }
}
