import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

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
    vi.mocked(redirect).mockReset();
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: { signInWithPassword, signUp },
    } as never);
  });

  it("rejects invalid signup input before calling Supabase", async () => {
    const result = await signUpAction(emptyState, credentials("bad-email", "short"));
    expect(result.error).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("explains a Supabase confirmation mismatch on sign in", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed" } });
    const result = await signInAction(emptyState, credentials("jane@company.com", "secret123"));
    expect(result.error).toMatch(/contact your workspace administrator/i);
  });

  it("opens the workspace when signup creates a session", async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
    await signUpAction(emptyState, credentials("jane@company.com", "secret123"));
    expect(signUp).toHaveBeenCalledWith({ email: "jane@company.com", password: "secret123" });
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("explains an existing account during signup", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: { code: "user_already_exists" } });
    const result = await signUpAction(emptyState, credentials("jane@company.com", "secret123"));
    expect(result.error).toMatch(/sign in/i);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not claim signup succeeded without a session", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await signUpAction(emptyState, credentials("jane@company.com", "secret123"));
    expect(result.error).toMatch(/try signing in/i);
    expect(redirect).not.toHaveBeenCalled();
  });
});
