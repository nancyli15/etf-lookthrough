import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Link previews need a full URL for the image, so Next needs the site's address.
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: "ETF Look-Through",
  description: "See every company inside your ETFs, and which of your funds it comes from. Read-only, using SnapTrade.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
