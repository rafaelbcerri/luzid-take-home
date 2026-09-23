import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthServerClient } from "./server-client";
import { signInAction, signUpAction } from "./actions";

vi.mock("./server-client", () => ({ createAuthServerClient: vi.fn() }));
vi.mock("../config/env", () => ({ env: { APP_ORIGIN: "http://127.0.0.1:3000" } }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const emptyState = { error: null, success: null };

function credentials(email: string, password: string) {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return form;
}

describe("account actions", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    signUp.mockReset();
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: { signInWithPassword, signUp },
    } as never);
  });

  it("rejects invalid signup input before calling Supabase", async () => {
    const result = await signUpAction(emptyState, credentials("bad-email", "short"));
    expect(result.error).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("explains an unverified email on sign in", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed" } });
    const result = await signInAction(emptyState, credentials("jane@company.com", "secret123"));
    expect(result.error).toMatch(/verify your email/i);
  });

  it("shows the confirmation next step after signup", async () => {
    signUp.mockResolvedValue({ error: null });
    const result = await signUpAction(emptyState, credentials("jane@company.com", "secret123"));
    expect(result.success).toMatch(/check your inbox/i);
  });
});
