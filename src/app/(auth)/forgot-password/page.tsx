import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" description="Enter your work email and we’ll send a link if it has an account.">
      <AuthForm mode="forgot-password" />
    </AuthShell>
  );
}
