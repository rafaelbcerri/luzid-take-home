import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiOk } from "@/lib/api/responses";
import { serializeStep } from "@/lib/api/serialize-recording";
import { deleteStep, updateStep } from "@/lib/db/recordings-repository";

export const runtime = "nodejs";

const MAX_ACTION_LENGTH = 300;
const MAX_SHORT_FIELD_LENGTH = 200;
const MAX_TEXT_LENGTH = 2_000;

const shortField = (label: string) =>
  z
    .string()
    .trim()
    .max(MAX_SHORT_FIELD_LENGTH, `Keep the ${label} under 200 characters.`)
    .optional();

const updateStepRequestSchema = z
  .object({
    action: z
      .string()
      .trim()
      .min(1, "An action is required — it is the line a reader follows.")
      .max(MAX_ACTION_LENGTH, "Keep the action under 300 characters.")
      .optional(),
    system: shortField("system"),
    testData: z
      .string()
      .trim()
      .max(MAX_TEXT_LENGTH, "Keep the test data under 2000 characters.")
      .optional(),
    responsible: shortField("responsible role"),
    description: z
      .string()
      .trim()
      .max(MAX_TEXT_LENGTH, "Keep the description under 2000 characters.")
      .optional(),
    expectedResult: z
      .string()
      .trim()
      .max(MAX_TEXT_LENGTH, "Keep the expected result under 2000 characters.")
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Nothing to update.",
  });

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/steps/[stepId]">,
) {
  const { stepId } = await context.params;

  try {
    const parsed = updateStepRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "This change is not valid.",
        400,
      );
    }

    const step = await updateStep({ stepId, ...parsed.data });

    if (!step) {
      return apiError("This step does not exist.", 404);
    }

    return apiOk({ step: await serializeStep(step) });
  } catch (error) {
    console.error(`[api] updating step ${stepId} failed`, error);
    return apiError("Could not save this step.", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/steps/[stepId]">,
) {
  const { stepId } = await context.params;

  try {
    const step = await deleteStep(stepId);

    if (!step) {
      return apiError("This step does not exist.", 404);
    }

    return apiOk({ deleted: true });
  } catch (error) {
    console.error(`[api] deleting step ${stepId} failed`, error);
    return apiError("Could not delete this step.", 500);
  }
}
