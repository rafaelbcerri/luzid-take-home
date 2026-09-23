import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return (
    <AuthShell title="Choose a new password" description="Set a password you’ll use to sign in to your workspace.">
      <AuthForm mode="update-password" />
    </AuthShell>
  );
}
