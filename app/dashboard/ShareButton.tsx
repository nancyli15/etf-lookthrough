"use client";
// Share opens a card over the page showing the exact image, so you see what
// you're sharing before it leaves the page. Percentages only, with no dollar
// amounts (see shareText and shareCardSvg in lib/).
//
// The image is drawn in the browser from an SVG, so holdings never go to a
// server to make it.
import { useEffect, useRef, useState } from "react";
import type { LookThroughResult } from "../../lib/lookthrough";
import { shareText } from "../../lib/format";
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

export default function ShareButton({ result }: { result: LookThroughResult }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [png, setPng] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false); // Known only in the browser.

  useEffect(() => {
    const test = new File([""], FILE_NAME, { type: "image/png" });
    setCanShareFiles(Boolean(navigator.canShare?.({ files: [test] })));
  }, []);

  // Free the preview's memory when it's replaced or the page closes.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const text = shareText(result);
  if (!text) return null;

  async function open() {
    setStatus(null);
    dialogRef.current?.showModal();
    const svg = shareCardSvg(result, window.location.origin);
    if (!svg) return;
    try {
      const image = await svgToPng(svg);
      setPng(image);
      setPreviewUrl(URL.createObjectURL(image));
    } catch {
      setStatus("Couldn't make the image. Try again.");
    }
  }

  async function copyImage() {
    if (!png) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setStatus("Image copied. Paste it into a chat or post.");
    } catch {
      setStatus("This browser can't copy images. Use Download instead.");
    }
  }

  function download() {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = FILE_NAME;
    link.click();
    setStatus("Downloaded.");
  }

  async function copyText() {
    try {
      // No link: pasting a link makes chat apps add their own preview image.
      await navigator.clipboard.writeText(text!);
      setStatus("Text copied.");
    } catch {
      setStatus("Couldn't copy. Try again.");
    }
  }

  async function shareToApps() {
    if (!png) return;
    try {
      await navigator.share({ files: [new File([png], FILE_NAME, { type: "image/png" })] });
    } catch (err) {
      // Closing the share menu counts as an error, but isn't one.
      if (!(err instanceof Error && err.name === "AbortError")) setStatus("Couldn't share. Try Download.");
    }
  }

  return (
    <>
      <div className="row spaced">
        <button className="button secondary" type="button" onClick={open}>
          Share my top companies
        </button>
      </div>

      {/* <dialog> with showModal() dims the page, closes on Esc and keeps keyboard focus inside. */}
      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby="share-title"
        // A click on the dimmed area outside the card lands on the dialog itself.
        onClick={(event) => event.target === dialogRef.current && dialogRef.current?.close()}
      >
        <div className="share-card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 id="share-title">Share your top companies</h2>
            <button className="button secondary" type="button" onClick={() => dialogRef.current?.close()} aria-label="Close">
              ✕
            </button>
          </div>
          <p className="muted small">Only percentages. No dollar amounts, cash or account names.</p>
          {previewUrl ? (
            <img className="share-preview" src={previewUrl} alt={`Share image. ${text}`} />
          ) : (
            <div className="share-preview muted small">Making the image…</div>
          )}
          <div className="row spaced">
            <button className="button" type="button" onClick={copyImage} disabled={!png}>
              Copy image
            </button>
            <button className="button secondary" type="button" onClick={download} disabled={!png}>
              Download
            </button>
            <button className="button secondary" type="button" onClick={copyText}>
              Copy as text
            </button>
            {canShareFiles && (
              <button className="button secondary" type="button" onClick={shareToApps} disabled={!png}>
                Share to apps
              </button>
            )}
          </div>
          {status && (
            <p className="muted small spaced" role="status">
              {status}
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
