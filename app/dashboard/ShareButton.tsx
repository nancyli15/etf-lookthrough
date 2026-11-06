"use client";
// Shares your top companies, as an image or as text. Percentages only, with no
// dollar amounts (see shareText and shareCardSvg in lib/).
//
// The image is drawn in the browser from an SVG, so holdings never go to a server
// to make it. Phones get their share menu; computers download the PNG instead.
import { useEffect, useState } from "react";
import type { LookThroughResult } from "../../lib/lookthrough";
import { shareText } from "../../lib/report";
import { CARD_SIZE, shareCardSvg } from "../../lib/shareCard";

const FILE_NAME = "what-i-actually-own.png";

// SVG → PNG: load the SVG as an image, draw it onto a canvas, and read the canvas
// back as a PNG. Chats and social apps accept PNGs, but often not SVGs.
function svgToPng(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CARD_SIZE;
      canvas.height = CARD_SIZE;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("No canvas"));
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png");
    };
    image.onerror = () => reject(new Error("Couldn't draw the image"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function download(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

// Closing the share menu counts as an error, but isn't one.
function wasCancelled(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export default function ShareButton({ result }: { result: LookThroughResult }) {
  const [status, setStatus] = useState<string | null>(null);
  // Known only in the browser, so it starts false and the label starts as "Download".
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    const test = new File([""], FILE_NAME, { type: "image/png" });
    setCanShareFiles(Boolean(navigator.canShare?.({ files: [test] })));
  }, []);

  const text = shareText(result);
  if (!text) return null;

  async function shareImage() {
    const svg = shareCardSvg(result, window.location.origin);
    if (!svg) return;
    try {
      const png = await svgToPng(svg);
      const file = new File([png], FILE_NAME, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "What I actually own" });
        return;
      }
      download(png);
      setStatus("Image downloaded. Only percentages, no dollar amounts.");
    } catch (err) {
      if (!wasCancelled(err)) setStatus("Couldn't make the image. Try again.");
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(`${text}\n\n${window.location.origin}`);
      setStatus("Copied. Only percentages, no dollar amounts.");
    } catch {
      setStatus("Couldn't copy. Try again.");
    }
  }

  return (
    <div className="row spaced">
      <button className="button" type="button" onClick={shareImage}>
        {canShareFiles ? "Share image" : "Download image"}
      </button>
      <button className="button secondary" type="button" onClick={copyText}>
        Copy as text
      </button>
      {status && (
        <span className="muted small" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
