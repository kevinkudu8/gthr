import { flushSync } from "react-dom";
import { scrollState } from "@/components/three/scrollState";

/**
 * Light to dark, with the colour field spilling in over the light site
 * itself rather than over a blank page.
 *
 * The spill is CloudBackdrop's (random, blobby fronts from the screen edges;
 * see the backdrop notes). On its own it eats the *white*: the page's type
 * has already switched to the dark face. So this runs the switch as a View
 * Transition: the browser keeps a snapshot of the light site on top, and
 * CloudBackdrop, seeing `scrollState.spillMask`, publishes its spill each
 * frame as `--spill-mask` — the snapshot shows exactly where the white
 * would (`html[data-spilling]::view-transition-old(root)` in globals.css).
 * Underneath is the live dark site, revealed as the colour arrives.
 *
 * Falls back to the plain switch (the background still spills) without the
 * API or under reduced motion.
 */

/** A touch longer than the spill itself (SPILL_S), so it is done first. */
const HOLD_MS = 1060;

export function spillToDark(apply: () => void) {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof document.startViewTransition !== "function") {
    apply();
    return;
  }

  // Fully shown until the backdrop's first mask frame arrives.
  root.style.setProperty("--spill-mask", "linear-gradient(#000, #000)");
  root.style.setProperty("--spill-hold", `${HOLD_MS}ms`);
  root.dataset.spilling = "";
  scrollState.spillMask = true;

  const transition = document.startViewTransition(() => {
    flushSync(apply);
    // Already true by the provider's effect; set here too so the backdrop's
    // next frame starts the spill whatever the effect timing.
    root.dataset.mode = "party";
    scrollState.business = 0;
  });

  transition.finished.finally(() => {
    scrollState.spillMask = false;
    delete root.dataset.spilling;
    root.style.removeProperty("--spill-mask");
    root.style.removeProperty("--spill-hold");
  });
}
