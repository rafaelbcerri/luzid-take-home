import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthenticatedUserId } from "@/lib/auth/session";
import { listRecordings } from "@/lib/db/recordings-repository";
import { GET, POST } from "./route";

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUserId: vi.fn() }));
vi.mock("@/lib/db/recordings-repository", () => ({ listRecordings: vi.fn(), createRecording: vi.fn() }));
vi.mock("@/lib/config/env", () => ({ STORAGE_BUCKETS: { recordings: "recordings" } }));
vi.mock("@/lib/storage/supabase-storage", () => ({
  storage: { upload: vi.fn() },
  buildRecordingVideoPath: vi.fn(),
}));
vi.mock("@/lib/pipeline/process-recording", () => ({ processRecording: vi.fn() }));

describe("recordings API authentication", () => {
  beforeEach(() => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
    vi.mocked(listRecordings).mockReset();
  });

  it("rejects a signed-out list request before reading records", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
    expect(listRecordings).not.toHaveBeenCalled();
  });

  it("rejects a signed-out upload before reading a file", async () => {
    const request = new NextRequest("http://localhost/api/recordings", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
