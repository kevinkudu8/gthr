"use client";

import { useMode } from "@/components/mode/ModeProvider";
import { modeToggle } from "@/content/site";
import { spillToDark } from "./spill";

/**
 * Light / dark switch in the top bar: business is the light face, party the
 * dark. One button showing where a press goes — the moon on light, the sun
 * on dark (both are drawn; globals.css crossfades them off `data-mode`, so the
 * icon is right before hydration too). On light it is a white disc with a
 * turning prismatic rim, to draw the eye to dark mode. Its name says what a
 * press will do. Light to dark, the colour field spills in over the light
 * site (spill.ts, with CloudBackdrop's spill); dark to light is the plain
 * switch.
 */
export function ModeToggle() {
  const { mode, setMode } = useMode();
  const dark = mode === "party";

  return (
    <button
      type="button"
      className="mode-toggle pointer-events-auto"
      aria-label={dark ? modeToggle.toLight : modeToggle.toDark}
      onClick={() => (dark ? setMode("business") : spillToDark(() => setMode("party")))}
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
