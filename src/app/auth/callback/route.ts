import { NextResponse, type NextRequest } from "next/server";

import { safeReturnPath } from "@/lib/auth/return-path";
import { createAuthServerClient } from "@/lib/auth/server-client";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=expired-link", request.url));
  }

  const client = await createAuthServerClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=expired-link", request.url));
  }

  const next = safeReturnPath(request.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(next, request.url));
}
