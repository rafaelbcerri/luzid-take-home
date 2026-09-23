"use server";

import { redirect } from "next/navigation";

import { env } from "../config/env";
import { authErrorMessage } from "./auth-errors";
import { credentialsSchema, newPasswordSchema } from "./credentials";
import { safeReturnPath } from "./return-path";
import { createAuthServerClient } from "./server-client";
import { getAuthenticatedUserId } from "./session";

export type AuthActionState = {
  error: string | null;
  success: string | null;
};

const EMPTY_STATE: AuthActionState = { error: null, success: null };

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details.", success: null };
  }

  const client = await createAuthServerClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error.code), success: null };

  redirect(safeReturnPath(formString(formData, "next")));
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details.", success: null };
  }

  const password = newPasswordSchema.safeParse(parsed.data.password);
  if (!password.success) {
    return { error: password.error.issues[0]?.message ?? "Choose a longer password.", success: null };
  }

  const client = await createAuthServerClient();
  const { data, error } = await client.auth.signUp(parsed.data);

  if (error) {
    return { error: authErrorMessage(error.code), success: null };
  }

  if (!data.session) {
    return {
      error: "Your account was created, but you are not signed in. Try signing in.",
      success: null,
    };
  }

  redirect("/");
}

export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = credentialsSchema.shape.email.safeParse(formString(formData, "email"));
  if (!email.success) {
    return { error: "Enter a valid email address.", success: null };
  }

  const client = await createAuthServerClient();
  const { error } = await client.auth.resetPasswordForEmail(email.data, {
    redirectTo: new URL("/auth/callback?next=/update-password", env.APP_ORIGIN).toString(),
  });

  if (error && error.code !== "user_not_found") {
    return { error: "We could not send the reset email. Please try again.", success: null };
  }

  return {
    ...EMPTY_STATE,
    success: "If that email has an account, a reset link is on its way. Check your inbox.",
  };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = newPasswordSchema.safeParse(formString(formData, "password"));
  if (!password.success) {
    return { error: password.error.issues[0]?.message ?? "Choose a longer password.", success: null };
  }

  if (password.data !== formString(formData, "confirmPassword")) {
    return { error: "The passwords do not match. Enter them again.", success: null };
  }

  if (!(await getAuthenticatedUserId())) {
    return { error: "This reset link has expired. Request a new one.", success: null };
  }

  const client = await createAuthServerClient();
  const { error } = await client.auth.updateUser({ password: password.data });
  if (error) return { error: authErrorMessage(error.code), success: null };

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const client = await createAuthServerClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Could not sign out. Please try again.");
  redirect("/login");
}
