import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthServerClient } from "./server-client";
import { getAuthenticatedUserId } from "./session";

vi.mock("./server-client", () => ({ createAuthServerClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const getClaims = vi.fn();

describe("getAuthenticatedUserId", () => {
  beforeEach(() => {
    getClaims.mockReset();
    vi.mocked(createAuthServerClient).mockResolvedValue({
      auth: { getClaims },
    } as never);
  });

  it("returns the verified subject", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "owner-1" } }, error: null });
    expect(await getAuthenticatedUserId()).toBe("owner-1");
  });

  it("rejects an invalid session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: new Error("invalid") });
    expect(await getAuthenticatedUserId()).toBeNull();
  });

  it("rejects an empty Auth response", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect(await getAuthenticatedUserId()).toBeNull();
  });
});
