// The preview chat apps and social sites show when someone pastes the app's link.
// Next.js serves this file as /opengraph-image and adds the <meta> tags for it.
// It's the same for everyone and never shows anyone's holdings: anyone can fetch
// a link's preview, so it only uses grey placeholder blocks, no names or numbers.
//
// It's drawn by next/og, which supports a small part of CSS: every element with
// more than one child needs display: flex, and there's no grid.
import { ImageResponse } from "next/og";

export const alt = "ETF Look-Through: see the companies inside your ETFs, and which funds they come from";
export const size = { width: 1200, height: 630 }; // The size most sites expect.
export const contentType = "image/png";

// Same colours as the app (app/globals.css).
const COLORS = { page: "#f8f9fb", card: "#ffffff", text: "#111827", muted: "#6b7280", border: "#e5e7eb", accent: "#0e7c86", soft: "#eef7f7", direct: "#2a78d6", funds: "#eb6834", placeholder: "#e5e7eb" };

// A sketch of a company's dropdown: one bar per source, biggest first. Lengths are
// decorative. The first row is shares you bought (blue), the rest are funds (orange).
const ROWS = [
  { label: 150, bar: 300, color: COLORS.direct },
  { label: 110, bar: 190, color: COLORS.funds },
  { label: 130, bar: 110, color: COLORS.funds },
  { label: 100, bar: 60, color: COLORS.funds },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
          background: COLORS.page,
          borderTop: `14px solid ${COLORS.accent}`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Left: what the app is. */}
        <div style={{ display: "flex", flexDirection: "column", width: 520, marginRight: 50 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.accent }}>ETF Look-Through</div>
          <div style={{ fontSize: 64, fontWeight: 700, color: COLORS.text, lineHeight: 1.1, marginTop: 16 }}>
            What's really inside your ETFs
          </div>
          <div style={{ fontSize: 30, color: COLORS.muted, marginTop: 20, lineHeight: 1.35 }}>
            See every company you own, and which of your funds it comes from.
          </div>
        </div>

        {/* Right: a placeholder company card, styled like the app's dropdown. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 500,
            padding: 36,
            background: COLORS.card,
            border: `2px solid ${COLORS.border}`,
            borderRadius: 20,
          }}
        >
          <div style={{ display: "flex" }}>
            <div style={{ padding: "6px 18px", borderRadius: 999, background: COLORS.soft, color: COLORS.accent, fontSize: 22, fontWeight: 700 }}>
              Direct + funds
            </div>
          </div>
          <div style={{ width: 220, height: 40, marginTop: 22, borderRadius: 8, background: COLORS.text, opacity: 0.85 }} />
          <div style={{ width: 300, height: 16, marginTop: 14, borderRadius: 6, background: COLORS.placeholder }} />
          <div style={{ height: 2, marginTop: 28, background: COLORS.border }} />
          {ROWS.map((row, index) => (
            <div key={index} style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
              <div style={{ width: row.label, height: 16, borderRadius: 6, background: COLORS.placeholder, marginRight: 160 - row.label }} />
              <div style={{ display: "flex", width: 300, height: 16, borderRadius: 6, background: COLORS.page }}>
                <div style={{ width: row.bar, height: 16, borderRadius: 6, background: row.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
