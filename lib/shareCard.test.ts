import { describe, expect, it } from "vitest";
import { buildReport } from "./report";
import { escapeXml, PUBLIC_HOST, shareCardSvg } from "./shareCard";

function position(symbol: string, kind: string, price: string, description: string) {
  return { instrument: { kind, symbol, description, currency: "USD" }, units: "1", price, currency: "USD" };
}

// Apple bought directly and inside SPY and FXAIX, in an account with cash and a name
// that must never appear on the card.
const report = buildReport([
  {
    account: { name: "My secret IRA" },
    positions: {
      ok: true,
      status: 200,
      data: {
        results: [
          position("AAPL", "stock", "500", "Apple Inc"),
          position("SPY", "etf", "1000", "SPDR S&P 500"),
          position("FXAIX", "mutualfund", "800", "Fidelity 500"),
        ],
      },
    },
    balances: { ok: true, data: [{ cash: "999", currency: "USD" }] },
  },
]);

describe("share card", () => {
  const svg = shareCardSvg(report)!;

  it("tells one story: the headline, the biggest exposure, the top 5 and the biggest overlap", () => {
    expect(svg).toMatch(/^<svg [^>]*width="1080" height="1350"/);
    expect(svg).toContain("My ETFs own more");
    expect(svg).toContain("MY LARGEST EXPOSURE");
    expect(svg).toContain("% more than my own shares");
    expect(svg).toContain("MY TOP 5 COMPANIES · % OF INVESTED HOLDINGS");
    expect(svg).toContain("MY BIGGEST ETF OVERLAP");
    expect(svg).toContain("SPY + FXAIX");
  });

  it("says what the numbers are based on, and always shows the public address", () => {
    expect(svg).toContain("underlying companies");
    expect(svg).toContain("cash not included");
    expect(svg).toContain(`>${PUBLIC_HOST}<`);
    expect(svg).not.toContain("localhost");
  });

  it("has no dollar amounts, cash or account names by default", () => {
    expect(svg).not.toMatch(/\$|999|IRA/);
  });

  it("shows dollar amounts only when asked, and still no cash or account names", () => {
    const withAmounts = shareCardSvg(report, { amounts: true })!;
    expect(withAmounts).toMatch(/US\$[\d.]+K? bought directly · US\$[\d.]+K? through funds/);
    expect(withAmounts).not.toMatch(/999|IRA/);
  });

  it("leaves out the biggest exposure or the overlap when unticked", () => {
    const plain = shareCardSvg(report, { insight: false, overlap: false })!;
    expect(plain).not.toContain("MY LARGEST EXPOSURE");
    expect(plain).not.toContain("MY BIGGEST ETF OVERLAP");
    expect(plain).toContain("MY TOP 5 COMPANIES");
  });

  it("cuts long names with … instead of letting them run off the card", () => {
    const long = buildReport([
      { positions: { ok: true, status: 200, data: { results: [position("XYZ", "stock", "500", "A".repeat(80))] } } },
    ]);
    const card = shareCardSvg(long)!;
    expect(card).toContain("…");
    expect(card).not.toContain("A".repeat(60));
  });

  it("escapes names that would break the image, like AT&T", () => {
    expect(escapeXml(`AT&T <"x">`)).toBe("AT&amp;T &lt;&quot;x&quot;&gt;");
  });

  it("has nothing to draw without companies", () => {
    expect(shareCardSvg(buildReport([]))).toBeUndefined();
  });
});
