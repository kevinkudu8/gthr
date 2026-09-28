"use client";

import { useMode } from "@/components/mode/ModeProvider";
import { modeToggle } from "@/content/site";

/**
 * Light / dark switch in the top bar: business is the light face, party the
 * dark. One button, the sun showing on light and the moon on dark (both are
 * drawn; globals.css crossfades them off `data-mode`, so the icon is right
 * before hydration too). Its name says what a press will do.
 */
export function ModeToggle() {
  const { mode, setMode } = useMode();
  const dark = mode === "party";

  return (
    <button
      type="button"
      className="mode-toggle pointer-events-auto"
      aria-label={dark ? modeToggle.toLight : modeToggle.toDark}
      onClick={() => setMode(dark ? "business" : "party")}
    >
      <svg
        className="mode-toggle__icon mode-toggle__icon--sun"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
      <svg
        className="mode-toggle__icon mode-toggle__icon--moon"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
      </svg>
    </button>
  );
}
