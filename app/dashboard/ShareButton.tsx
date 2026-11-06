"use client";
// Shares the top companies as percentages, with no dollar amounts (see shareText).
// Phones open their share menu; computers copy the text instead.
import { useState } from "react";

export default function ShareButton({ text }: { text: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function share() {
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: "What I actually own", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      setStatus("Copied. Only percentages, no dollar amounts.");
    } catch (err) {
      // Closing the share menu counts as an error, but isn't one.
      if (err instanceof Error && err.name === "AbortError") return;
      setStatus("Couldn't share. Try again.");
    }
  }

  return (
    <div className="row spaced">
      <button className="button secondary" type="button" onClick={share}>
        Share my top companies
      </button>
      {status && (
        <span className="muted small" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
