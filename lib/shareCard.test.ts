import { describe, expect, it } from "vitest";
import { buildReport } from "./report";
import { escapeXml, shareCardSvg } from "./shareCard";

function position(symbol: string, kind: string, price: string, description: string) {
  return { instrument: { kind, symbol, description, currency: "USD" }, units: "1", price, currency: "USD" };
}

const report = buildReport([
  {
    account: { name: "My secret IRA" },
    positions: {
      ok: true,
      status: 200,
      data: { results: [position("AAPL", "stock", "500", "Apple Inc"), position("SPY", "etf", "1000", "SPDR S&P 500")] },
    },
    balances: { ok: true, data: [{ cash: "999", currency: "USD" }] },
  },
]);

describe("share image", () => {
  const svg = shareCardSvg(report.result, "https://etf-lookthrough.vercel.app/")!;

  it("shows the top companies as percentages, with the funds and the site", () => {
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("What I actually own");
    expect(svg).toContain("inside SPY");
    expect(svg).toContain(">Apple<");
    expect(svg).toMatch(/>\d+\.\d%</);
    expect(svg).toContain("etf-lookthrough.vercel.app<");
  });

  it("has no dollar amounts, cash or account names", () => {
    expect(svg).not.toMatch(/\$|>500<|1,000|999|IRA/);
  });

  it("splits a company held both ways into two bars, with a legend", () => {
    expect(svg.match(/<rect [^>]*fill="#2a78d6"/g)?.length).toBeGreaterThanOrEqual(2); // bar + legend
    expect(svg).toContain("Bought directly");
  });

  it("escapes names that would break the image, like AT&T", () => {
    expect(escapeXml(`AT&T <"x">`)).toBe("AT&amp;T &lt;&quot;x&quot;&gt;");
  });

  it("has nothing to draw without companies", () => {
    expect(shareCardSvg(buildReport([]).result, "https://example.com")).toBeUndefined();
  });
});
