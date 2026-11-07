"use client";
// Closes a dropdown or popup on a click anywhere outside it, or on Esc. Used by the
// Accounts dropdown (a <details>) and the ⓘ notes (a <span> with React state), so it
// doesn't know how to close either one: each passes its own `onDismiss`.
import { useEffect, type RefObject } from "react";

// `active` is false while the popup is closed, so a page with twenty ⓘs isn't
// listening to every click. `reason` lets Esc put keyboard focus back on the button.
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: (reason: "outside" | "escape") => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onDismiss("outside");
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss("escape");
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, onDismiss, active]);
}
