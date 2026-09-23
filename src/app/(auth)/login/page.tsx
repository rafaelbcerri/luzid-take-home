import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAuthenticatedUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getAuthenticatedUserId()) redirect("/");
  const query = await searchParams;
  const next = typeof query.next === "string" ? query.next : undefined;
  const initialError = query.error === "expired-link"
    ? "This link is invalid or has expired. Sign in or request a new link."
    : undefined;

  return (
    <AuthShell title="Welcome back" description="Sign in to your private test-script workspace.">
      <AuthForm mode="login" next={next} initialError={initialError} />
    </AuthShell>
  );
}
