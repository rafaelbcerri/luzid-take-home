import type { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api/responses";
import { serializeStep } from "@/lib/api/serialize-recording";
import {
  findStepWithRecording,
  setStepEvidenceAnnotations,
} from "@/lib/db/recordings-repository";
import { evidenceAnnotationsSchema } from "@/lib/evidence/annotation-schema";
import { z } from "zod";

const saveAnnotationsSchema = z.object({
  evidenceTimestampSeconds: z.number().finite().min(0),
  annotations: evidenceAnnotationsSchema,
});

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/steps/[stepId]/annotations">,
) {
  const { stepId } = await context.params;

  try {
    const parsed = saveAnnotationsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("The highlights are not valid. Adjust them and try again.", 400);
    }

    const found = await findStepWithRecording(stepId);
    if (!found) return apiError("This step does not exist.", 404);
    if (!found.step.screenshotPath) {
      return apiError("Choose an evidence frame before adding highlights.", 400);
    }

    const step = await setStepEvidenceAnnotations({
      stepId,
      expectedEvidenceTimestampSeconds: parsed.data.evidenceTimestampSeconds,
      evidenceAnnotations: parsed.data.annotations,
    });
    if (!step) return apiError("The evidence frame changed. Reopen the highlights and try again.", 409);
    return apiOk({ step: await serializeStep(step) });
  } catch (error) {
    console.error(`[api] saving highlights for step ${stepId} failed`, error);
    return apiError("Could not save the highlights. Please try again.", 500);
  }
}
