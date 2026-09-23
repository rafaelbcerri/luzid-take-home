import { describe, expect, it } from "vitest";

import { safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it.each([
    ["/", "/"],
    ["/recordings/abc", "/recordings/abc"],
    ["//evil.example", "/"],
    ["https://evil.example", "/"],
    ["\\evil.example", "/"],
    [null, "/"],
  ])("keeps %s on this site", (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });
});
