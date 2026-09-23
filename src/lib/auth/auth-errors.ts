/** Keeps Supabase error codes out of consultant-facing account screens. */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Check your email and password, then try again.";
    case "email_not_confirmed":
      return "Check your inbox and verify your email before signing in.";
    case "weak_password":
      return "Choose a password with at least 8 characters.";
    default:
      return "We could not complete that account action. Please try again.";
  }
}
