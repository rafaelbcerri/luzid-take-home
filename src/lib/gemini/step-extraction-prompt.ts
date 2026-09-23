import { Type, type Schema } from "@google/genai";

/**
 * Asking for a strict JSON schema is what keeps the pipeline free of brittle
 * text parsing: Gemini can only answer in the shape we persist.
 */
export const STEP_EXTRACTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["title", "steps"],
  properties: {
    title: {
      type: Type.STRING,
      description:
        'Short name of the business process, e.g. "Create a purchase order".',
    },
    steps: {
      type: Type.ARRAY,
      minItems: "1",
      items: {
        type: Type.OBJECT,
        required: [
          "action",
          "description",
          "expectedResult",
          "timestampSeconds",
        ],
        properties: {
          action: {
            type: Type.STRING,
            description:
              'Imperative one-line instruction, e.g. "Open the Manage Purchase Orders app".',
          },
          description: {
            type: Type.STRING,
            description:
              "One or two sentences on exactly what the user did, naming the fields, values and buttons visible on screen.",
          },
          expectedResult: {
            type: Type.STRING,
            description:
              "What the user should see after doing this step, so a reader can verify it worked.",
          },
          timestampSeconds: {
            type: Type.NUMBER,
            description:
              "Seconds from the start of the video where this step is best illustrated — the moment the screen clearly shows the action.",
          },
        },
      },
    },
  },
};

export const STEP_EXTRACTION_INSTRUCTIONS = `You are a senior ERP consultant writing a test script from a screen recording.

Break the recording into the sequence of steps a colleague would need to reproduce the process. Follow these rules:

1. One step per meaningful user action (open an app, fill a field group, click a button, confirm a dialog). Merge trivial mouse movements and typing into the step they belong to.
2. Produce between 3 and 20 steps. Never invent steps that are not visible in the recording.
3. Quote real on-screen labels, field names and values exactly as they appear. Prefer "Enter 1000 in the Quantity field" over "Enter the quantity".
4. "expectedResult" must be observable — a message, a new screen, a saved record, a changed value.
5. "timestampSeconds" must point at a frame where the relevant screen is clearly visible. Prefer a moment shortly after the action completes, and never pick a frame during a page transition.
6. Write in English, in a neutral professional tone.`;
