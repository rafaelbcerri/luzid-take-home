import { describe, expect, it } from "vitest";

import { evidenceAnnotationsSchema } from "@/lib/evidence/annotation-schema";

describe("evidence annotations", () => {
  it("accepts normalized rectangles and squares", () => {
    expect(evidenceAnnotationsSchema.safeParse([
      { kind: "rectangle", x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      { kind: "square", x: 0.5, y: 0.5, width: 0.1, height: 0.2 },
    ]).success).toBe(true);
  });

  it("rejects shapes that extend beyond the evidence", () => {
    expect(evidenceAnnotationsSchema.safeParse([
      { kind: "rectangle", x: 0.8, y: 0.1, width: 0.3, height: 0.2 },
    ]).success).toBe(false);
  });

  it("limits the number of highlights", () => {
    const shape = { kind: "rectangle", x: 0, y: 0, width: 0.1, height: 0.1 };
    expect(evidenceAnnotationsSchema.safeParse(Array(21).fill(shape)).success).toBe(false);
  });
});
