import type { NextRequest } from "next/server";

import { STORAGE_BUCKETS } from "@/lib/config/env";
import { findPublicScreenshotByToken } from "@/lib/db/recordings-repository";
import { storage } from "@/lib/storage/supabase-storage";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/share/[token]/screenshots/[stepId]">,
) {
  const { token, stepId } = await context.params;
  try {
    const found = await findPublicScreenshotByToken(token, stepId);
    if (!found?.screenshotPath) {
      return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const body = await storage.download({
      bucket: STORAGE_BUCKETS.screenshots,
      path: found.screenshotPath,
    });
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[share] loading screenshot failed", error);
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
