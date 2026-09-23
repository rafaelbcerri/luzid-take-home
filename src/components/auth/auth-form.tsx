"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  type AuthActionState,
} from "@/lib/auth/actions";
import { AuthSubmitButton } from "./auth-submit-button";

type AuthMode = "login" | "signup" | "forgot-password" | "update-password";

const ACTIONS = {
  login: signInAction,
  signup: signUpAction,
  "forgot-password": requestPasswordResetAction,
  "update-password": updatePasswordAction,
} as const;

const LABELS: Record<AuthMode, string> = {
  login: "Sign in",
  signup: "Create account",
  "forgot-password": "Send reset link",
  "update-password": "Save new password",
};

const FIELD_CLASS =
  "mt-1.5 h-10 w-full rounded-[var(--radius-control)] border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 hover:border-ink-300 focus:border-accent-500";

export function AuthForm({
  mode,
  next,
  initialError,
}: {
  mode: AuthMode;
  next?: string;
  initialError?: string;
}) {
  const [state, action] = useActionState<AuthActionState, FormData>(
    ACTIONS[mode],
    { error: null, success: null },
  );
  const asksForEmail = mode !== "update-password";
  const asksForPassword = mode !== "forgot-password";

  return (
    <form action={action} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {asksForEmail ? (
        <label className="block text-sm font-medium text-ink-900">
          Work email
          <input
            className={FIELD_CLASS}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
        </label>
      ) : null}

      {asksForPassword ? (
        <label className="block text-sm font-medium text-ink-900">
          {mode === "update-password" ? "New password" : "Password"}
          <input
            className={FIELD_CLASS}
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "login" ? undefined : 8}
            required
          />
          {mode === "signup" || mode === "update-password" ? (
            <span className="mt-1.5 block text-xs text-ink-500">Use at least 8 characters.</span>
          ) : null}
        </label>
      ) : null}

      {mode === "update-password" ? (
        <label className="block text-sm font-medium text-ink-900">
          Confirm new password
          <input
            className={FIELD_CLASS}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
      ) : null}

      {mode === "login" ? (
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm font-medium text-accent-600 hover:text-accent-700">
            Forgot password?
          </Link>
        </div>
      ) : null}

      {state.error || initialError ? (
        <p role="alert" className="rounded-[var(--radius-control)] bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {state.error ?? initialError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-[var(--radius-control)] bg-success-50 px-3 py-2 text-sm text-success-600">
          {state.success}
        </p>
      ) : null}

      <AuthSubmitButton label={LABELS[mode]} />

      <p className="text-center text-sm text-ink-500">
        {mode === "login" ? (
          <>New to Luzid? <Link href="/signup" className="font-medium text-accent-600 hover:text-accent-700">Create an account</Link></>
        ) : mode === "signup" ? (
          <>Already have an account? <Link href="/login" className="font-medium text-accent-600 hover:text-accent-700">Sign in</Link></>
        ) : (
          <Link href="/login" className="font-medium text-accent-600 hover:text-accent-700">Back to sign in</Link>
        )}
      </p>
    </form>
  );
}
