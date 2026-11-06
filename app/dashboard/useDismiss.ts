"use client";
// Closes a <details> dropdown or popup on a click anywhere outside it, or on Esc.
// <details> on its own only closes when its own button is clicked again. Clicks
// inside leave it open, so several boxes can be ticked in one go.
import { useEffect, type RefObject } from "react";

export function useDismiss(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const menu = ref.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      const menu = ref.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        // Back on the button, so keyboard users don't lose their place.
        menu.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [ref]);
}
