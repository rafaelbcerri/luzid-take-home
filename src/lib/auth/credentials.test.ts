import { describe, expect, it } from "vitest";

import { credentialsSchema, newPasswordSchema } from "./credentials";

describe("account input", () => {
  it("trims and validates email", () => {
    expect(credentialsSchema.parse({ email: "  jane@company.com  ", password: "secret123" }).email)
      .toBe("jane@company.com");
    expect(credentialsSchema.safeParse({ email: "not-an-email", password: "secret123" }).success)
      .toBe(false);
  });

  it("requires at least eight characters for a new password", () => {
    expect(newPasswordSchema.safeParse("short").success).toBe(false);
    expect(newPasswordSchema.safeParse("long-enough").success).toBe(true);
  });
});
