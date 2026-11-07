// Uses a fake SnapTrade and fake session store, so we can force failures like a
// 401 that can't be triggered on demand against the real API.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenRequest } from "./oauth";
import { clearSession, getSession, saveSession } from "./session";
import { NotSignedInError, createClient } from "./api";

vi.mock("./session", () => ({ getSession: vi.fn(), saveSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("./oauth", () => ({ tokenRequest: vi.fn() }));

const session = {
  accessToken: "old-access",
  refreshToken: "old-refresh",
  expiresAt: Date.now() + 3_600_000,
  scope: "openid email read",
  userId: "user",
};

const newTokens = { access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 };

function respond(...statuses: number[]) {
  const fetchMock = vi.fn();
  for (const status of statuses) fetchMock.mockResolvedValueOnce(new Response("{}", { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bearerOf(call: unknown[]) {
  return (call[1] as { headers: { Authorization: string } }).headers.Authorization;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ ...session });
  vi.mocked(tokenRequest).mockResolvedValue(newTokens as never);
});

describe("createClient", () => {
  it("doesn't refresh when the token works", async () => {
    respond(200);
    const result = await (await createClient()).get("/accounts");
    expect(result.ok).toBe(true);
    expect(tokenRequest).not.toHaveBeenCalled();
  });

  it("refreshes once and retries once with the new token on a 401", async () => {
    const fetchMock = respond(401, 200);
    const result = await (await createClient()).get("/accounts");
    expect(result.ok).toBe(true);
    expect(tokenRequest).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bearerOf(fetchMock.mock.calls[1])).toBe("Bearer new-access");
  });

  it("saves the rotated refresh token, because the old one is now invalid", async () => {
    respond(401, 200);
    await (await createClient()).get("/accounts");
    expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "new-refresh" }));
  });

  it("signs out instead of looping when the retry is also a 401", async () => {
    const fetchMock = respond(401, 401);
    const client = await createClient();
    await expect(client.get("/accounts")).rejects.toBeInstanceOf(NotSignedInError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenRequest).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalled();
  });

  it("signs out when the refresh itself fails, such as after a revoke", async () => {
    respond(401);
    vi.mocked(tokenRequest).mockRejectedValue(new Error("Token request failed: 400 invalid_grant"));
    const client = await createClient();
    await expect(client.get("/accounts")).rejects.toBeInstanceOf(NotSignedInError);
    expect(clearSession).toHaveBeenCalled();
  });

  it("refreshes before calling when the token is about to expire", async () => {
    vi.mocked(getSession).mockResolvedValue({ ...session, expiresAt: Date.now() + 1000 });
    const fetchMock = respond(200);
    await (await createClient()).get("/accounts");
    expect(tokenRequest).toHaveBeenCalledTimes(1);
    expect(bearerOf(fetchMock.mock.calls[0])).toBe("Bearer new-access");
  });

  it("refreshes only once when several calls get a 401", async () => {
    respond(401, 200, 401, 200);
    const client = await createClient();
    await client.get("/accounts");
    await client.get("/accounts/1/positions/all");
    expect(tokenRequest).toHaveBeenCalledTimes(1);
  });

  it("passes other errors back, so one failed call doesn't sign the user out", async () => {
    respond(500);
    const result = await (await createClient()).get("/accounts");
    expect(result.status).toBe(500);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("reports not signed in when there's no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(createClient()).rejects.toBeInstanceOf(NotSignedInError);
  });
});
