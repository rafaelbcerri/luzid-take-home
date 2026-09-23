import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/config/env";

/** Keeps the browser and Server Components on the same refreshed Auth session. */
export async function updateAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
