import type { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api/responses";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import {
  createShareForOwner,
  findRecording,
  findShareForOwner,
  revokeShareForOwner,
} from "@/lib/db/recordings-repository";

export const runtime = "nodejs";

async function ownedRecording(recordingId: string): Promise<
  | { ownerUserId: string; error: null }
  | { ownerUserId: null; error: ReturnType<typeof apiError> }
> {
  const ownerUserId = await getAuthenticatedUserId();
  if (!ownerUserId) return { ownerUserId: null, error: apiError("Sign in to manage sharing.", 401) };
  if (!(await findRecording(recordingId, ownerUserId))) {
    return { ownerUserId: null, error: apiError("This recording does not exist.", 404) };
  }
  return { ownerUserId, error: null };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]/share">,
) {
  const { recordingId } = await context.params;
  try {
    const owned = await ownedRecording(recordingId);
    if (owned.error) return owned.error;
    const share = await findShareForOwner(recordingId, owned.ownerUserId);
    return apiOk({ url: share ? `/share/${share.token}` : null });
  } catch (error) {
    console.error(`[api] loading share for ${recordingId} failed`, error);
    return apiError("Could not load this sharing link.", 500);
  }
}

export async function POST(
  _request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]/share">,
) {
  const { recordingId } = await context.params;
  try {
    const owned = await ownedRecording(recordingId);
    if (owned.error) return owned.error;
    const share = await createShareForOwner(recordingId, owned.ownerUserId);
    if (!share) return apiError("This recording does not exist.", 404);
    return apiOk({ url: `/share/${share.token}` });
  } catch (error) {
    console.error(`[api] sharing recording ${recordingId} failed`, error);
    return apiError("Could not create a sharing link.", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/recordings/[recordingId]/share">,
) {
  const { recordingId } = await context.params;
  try {
    const owned = await ownedRecording(recordingId);
    if (owned.error) return owned.error;
    await revokeShareForOwner(recordingId, owned.ownerUserId);
    return apiOk({ revoked: true });
  } catch (error) {
    console.error(`[api] revoking share for ${recordingId} failed`, error);
    return apiError("Could not revoke this sharing link.", 500);
  }
}
