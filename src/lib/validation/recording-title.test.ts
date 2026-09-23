import { describe, expect, it } from "vitest";

import { recordingTitleSchema } from "@/lib/validation/recording-title";

describe("recordingTitleSchema", () => {
  it("trims the title", () => {
    expect(recordingTitleSchema.parse("  Create a Purchase Order  ")).toBe(
      "Create a Purchase Order",
    );
  });

  it("rejects an empty title with a message a consultant can act on", () => {
    const result = recordingTitleSchema.safeParse("   ");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "A script needs a name so it can be found again.",
    );
  });

  it("rejects a title longer than 200 characters", () => {
    const result = recordingTitleSchema.safeParse("x".repeat(201));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Keep the name under 200 characters.",
    );
  });
});
