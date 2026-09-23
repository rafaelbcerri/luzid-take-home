import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it.each([
    ["invalid_credentials", "Check your email and password, then try again."],
    ["email_not_confirmed", "Check your inbox and verify your email before signing in."],
    ["weak_password", "Choose a password with at least 8 characters."],
    ["unexpected_failure", "We could not complete that account action. Please try again."],
  ])("gives a next step for %s", (code, expected) => {
    expect(authErrorMessage(code)).toBe(expected);
  });
});
