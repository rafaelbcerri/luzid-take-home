import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/config/env";

/** A request-scoped Auth client; the storage service role never enters sessions. */
export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; Proxy refreshes them.
        }
      },
    },
  });
}
