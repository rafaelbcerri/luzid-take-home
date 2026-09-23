import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it.each([
    ["invalid_credentials", "Check your email and password, then try again."],
    ["email_not_confirmed", "Sign-in is blocked by the authentication settings. Contact your workspace administrator."],
    ["weak_password", "Choose a password with at least 8 characters."],
    ["user_already_exists", "This email already has an account. Sign in or reset your password."],
    ["unexpected_failure", "We could not complete that account action. Please try again."],
  ])("gives a next step for %s", (code, expected) => {
    expect(authErrorMessage(code)).toBe(expected);
  });
});
