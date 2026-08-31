"use client";

import * as React from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

// Traps Tab focus within container, focuses first element on open, restores
// focus to the previously focused element on close. Returns the container ref.
export function useFocusTrap(active: boolean, onEscape?: () => void) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!active) return;

    // Capture the element that had focus when the dialog opened
    restoreRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (container) {
      const first = getFocusable(container)[0];
      // Fall back to the container itself so focus is always inside the dialog
      const target = first ?? container;
      target.focus();
    }

    // Lock scroll while dialog is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        onEscape();
        return;
      }
      if (e.key !== "Tab" || !container) return;

      const focusables = getFocusable(container);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Wrap forward from last to first
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
      // Wrap backward from first to last
      else if (e.shiftKey && (active === first || active === container || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger element on close
      restoreRef.current?.focus();
    };
  }, [active, onEscape]);

  return containerRef;
}
