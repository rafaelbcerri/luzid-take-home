import { NextResponse } from "next/server";

export type ApiErrorBody = { error: string };

/** One helper for errors so every route answers in the same shape. */
export function apiError(
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status });
}

export function apiOk<TBody>(body: TBody, status = 200): NextResponse<TBody> {
  return NextResponse.json(body, { status });
}
