import { describe, expect, it } from "vitest";

import { formatTimestamp, formatTimestampWithTenths } from "@/lib/format/timestamp";

describe("formatTimestamp", () => {
  it("formats whole seconds as M:SS", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(14.6)).toBe("0:14");
    expect(formatTimestamp(107)).toBe("1:47");
  });
});

describe("formatTimestampWithTenths", () => {
  it("keeps one decimal so neighbouring frames are distinguishable", () => {
    expect(formatTimestampWithTenths(14.62)).toBe("0:14.6");
    expect(formatTimestampWithTenths(0)).toBe("0:00.0");
    expect(formatTimestampWithTenths(59.98)).toBe("1:00.0");
  });

  it("never renders a negative time", () => {
    expect(formatTimestampWithTenths(-3)).toBe("0:00.0");
  });
});
