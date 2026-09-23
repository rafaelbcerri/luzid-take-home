import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/responses";
import { serializeStep } from "@/lib/api/serialize-recording";
import {
  appendStep,
  findRecording,
  insertStepAfter,
  reorderSteps,
} from "@/lib/db/recordings-repository";

export const runtime = "nodejs";

const reorderRequestSchema = z.object({
  orderedStepIds: z.array(z.string().uuid()).min(1),
});

const addStepRequestSchema = z.object({
  afterStepId: z.string().uuid().nullish(),
});

/** Adds an empty step the consultant can fill in by hand. */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]/steps">,
) {
  const { recordingId } = await context.params;

  try {
    if (!(await findRecording(recordingId))) {
      return apiError("This recording does not exist.", 404);
    }

    // A POST with no body still means "add one at the end".
    const body = await request.json().catch(() => ({}));
    const parsed = addStepRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Could not tell where to add this step.", 400);
    }

    const step = parsed.data.afterStepId
      ? await insertStepAfter({
          recordingId,
          afterStepId: parsed.data.afterStepId,
        })
      : await appendStep({ recordingId });

    return apiOk({ step: await serializeStep(step) }, 201);
  } catch (error) {
    console.error(`[api] adding a step to ${recordingId} failed`, error);
    return apiError("Could not add a step.", 500);
  }
}

/** Persists a new step order sent as the full list of ids, top to bottom. */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]/steps">,
) {
  const { recordingId } = await context.params;

  try {
    const parsed = reorderRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiError("The new step order is not valid.", 400);
    }

    const steps = await reorderSteps({
      recordingId,
      orderedStepIds: parsed.data.orderedStepIds,
    });

    return apiOk({ steps: await Promise.all(steps.map(serializeStep)) });
  } catch (error) {
    console.error(`[api] reordering steps of ${recordingId} failed`, error);
    return apiError("Could not save the new order.", 500);
  }
}
