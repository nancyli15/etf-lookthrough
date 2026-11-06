import { describe, expect, it } from "vitest";
import { emptyAccountsMessage } from "./connections";

const connections = (data: unknown, status = 200) => ({ status, ok: status < 400, data });
const sandbox = { id: "c1", brokerage: { name: "SnapTrade Sandbox" }, disabled: false };

describe("why there are no accounts", () => {
  it("says no brokerage is shared with this sign-in", () => {
    expect(emptyAccountsMessage([], connections([]))).toContain("No brokerage is shared with this sign-in");
  });

  it("names a connection that hasn't synced accounts yet", () => {
    expect(emptyAccountsMessage([], connections([sandbox]))).toBe(
      "Your SnapTrade Sandbox connection has no accounts yet. SnapTrade may still be syncing it, so try again in a few minutes.",
    );
  });

  it("says when every connection is disabled", () => {
    expect(emptyAccountsMessage([], connections([{ ...sandbox, disabled: true }]))).toContain(
      "Your SnapTrade Sandbox connection is disabled",
    );
  });

  it("says when the connections list didn't load", () => {
    expect(emptyAccountsMessage([], connections({ detail: "no" }, 403))).toContain("didn't load (status 403)");
  });

  it("spots accounts in a shape the app doesn't read, like { results: [...] }", () => {
    expect(emptyAccountsMessage({ results: [{ id: "a" }] }, connections([sandbox]))).toContain("a shape this app doesn't read");
  });
});
