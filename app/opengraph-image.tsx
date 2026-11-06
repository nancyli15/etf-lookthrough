// The preview chat apps and social sites show when someone pastes the app's link.
// Next.js serves this file as /opengraph-image and adds the <meta> tags for it.
// It's the same for everyone and never shows anyone's holdings: those stay in
// the share image, which is made in the user's own browser.
import { ImageResponse } from "next/og";

export const alt = "ETF Look-Through: see the companies inside your ETFs";
export const size = { width: 1200, height: 630 }; // The size most sites expect.
export const contentType = "image/png";

// Decorative bars only, with no names or numbers, so nothing reads as real data.
const BARS = [
  { direct: 62, funds: 12 },
  { direct: 30, funds: 6 },
  { direct: 18, funds: 14 },
  { direct: 0, funds: 16 },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "#f8f9fb",
          borderTop: "14px solid #0e7c86",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 76, fontWeight: 700, color: "#111827" }}>What you actually own</div>
        <div style={{ fontSize: 34, color: "#6b7280", marginTop: 16, maxWidth: 900 }}>
          See the companies inside your ETFs, and how much of your money sits in each.
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
          {BARS.map((bar, index) => (
            <div key={index} style={{ display: "flex", marginTop: 18 }}>
              {bar.direct > 0 && (
                <div style={{ width: bar.direct * 10, height: 24, background: "#2a78d6", borderRadius: 6, marginRight: 4 }} />
              )}
              <div style={{ width: bar.funds * 10, height: 24, background: "#eb6834", borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
