import { redirect } from "next/navigation";

import { safeReturnPath } from "./return-path";
import { createAuthServerClient } from "./server-client";

/** Only verified JWT claims may identify an owner in a database query. */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const { data, error } = await (await createAuthServerClient()).auth.getClaims();
  return error ? null : (data?.claims?.sub ?? null);
}

export async function requirePageUserId(returnPath: string): Promise<string> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  }

  return userId;
}
