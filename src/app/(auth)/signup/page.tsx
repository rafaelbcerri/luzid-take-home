import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAuthenticatedUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getAuthenticatedUserId()) redirect("/");

  return (
    <AuthShell title="Create your account" description="Keep your recordings and test scripts together in one private workspace.">
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
