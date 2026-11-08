import { describe, expect, it } from "vitest";
import { disabledConnectionsMessage, emptyAccountsMessage } from "./connections";

const connections = (data: unknown, status = 200) => ({ status, ok: status < 400, data });
const sandbox = { id: "c1", brokerage: { name: "SnapTrade Sandbox" }, disabled: false };

describe("why there are no accounts", () => {
  it("says no brokerage is shared with this sign-in", () => {
    expect(emptyAccountsMessage([], connections([]))).toContain("No brokerage is shared with this sign-in");
  });

  it("names an active connection with no visible accounts, and suggests they're hidden", () => {
    expect(emptyAccountsMessage([], connections([sandbox]))).toBe(
      "Your SnapTrade Sandbox connection has no accounts this app can see. Its accounts may be hidden from apps in SnapTrade, or it may still be syncing.",
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

describe("a disabled connection among working ones", () => {
  const questrade = { id: "c2", brokerage: { display_name: "Questrade" }, disabled: true };
  const ibkr = { id: "c3", brokerage: { display_name: "Interactive Brokers" }, disabled: true };

  it("says nothing when every connection works", () => {
    expect(disabledConnectionsMessage(connections([sandbox]))).toBeUndefined();
  });

  it("names the disabled connection and says what to do", () => {
    expect(disabledConnectionsMessage(connections([sandbox, questrade]))).toBe(
      "Your Questrade connection is disabled, so SnapTrade can't update it and its numbers below may be out of date. Reconnect it in SnapTrade, then sign in again.",
    );
  });

  it("names several, in plural", () => {
    expect(disabledConnectionsMessage(connections([sandbox, questrade, ibkr]))).toContain(
      "Your Questrade and Interactive Brokers connections are disabled",
    );
  });

  it("says nothing when the connections list didn't load, rather than guess", () => {
    expect(disabledConnectionsMessage(connections({ detail: "no" }, 403))).toBeUndefined();
    expect(disabledConnectionsMessage(undefined)).toBeUndefined();
  });
});
