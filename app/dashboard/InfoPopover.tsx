"use client";
// A small ⓘ that shows a note, for detail most people don't need on screen, like how
// much of a fund is cash. Opens when the mouse is over it, or on a tap or click
// (phones have no hover). Closes when the mouse leaves, on a tap outside, or on Esc.
//
// Built from a <span> and a <button>, not <details> like the Accounts dropdown: a
// <details> isn't allowed inside a paragraph, so the browser broke the line before it.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export default function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const noteId = useId();

  // Only listen while it's open, so a page with twenty ⓘs isn't watching every click.
  useEffect(() => {
    if (!open) return;
    function closeOnOutsideTap(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideTap);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideTap);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span
      className="info"
      ref={ref}
      // Only a real mouse: a tap also fires these, and would open and close it at once.
      onPointerEnter={(event) => event.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        className="info-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={noteId}
        // With a mouse, hovering already opened it, so a click keeps it open. Taps and the keyboard toggle it.
        onClick={(event) => setOpen(event.detail > 0 && window.matchMedia("(hover: hover)").matches ? true : !open)}
      >
        ⓘ
      </button>
      <span id={noteId} role="note" className="info-pop card small" hidden={!open}>
        {children}
      </span>
    </span>
  );
}
