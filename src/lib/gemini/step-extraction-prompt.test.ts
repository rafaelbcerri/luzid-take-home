import { describe, expect, it } from "vitest";

import {
  STEP_EXTRACTION_INSTRUCTIONS,
  STEP_EXTRACTION_SCHEMA,
} from "@/lib/gemini/step-extraction-prompt";

describe("step extraction contract", () => {
  it("puts visible test values in the description without separate step fields", () => {
    const steps = STEP_EXTRACTION_SCHEMA.properties?.steps;
    const step = steps?.items;

    expect(step?.required).toEqual([
      "action",
      "system",
      "description",
      "expectedResult",
      "timestampSeconds",
    ]);
    expect(Object.keys(step?.properties ?? {})).toEqual(step?.required);
    expect(STEP_EXTRACTION_INSTRUCTIONS).toMatch(
      /description[^\n]*field names[^\n]*values/i,
    );
    expect(STEP_EXTRACTION_INSTRUCTIONS).toMatch(
      /never invent[^\n]*values/i,
    );
  });
});
