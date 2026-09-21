"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { scrollState } from "@/components/three/scrollState";

export type Mode = "party" | "business";

const STORAGE_KEY = "gthr:mode";

/**
 * The site has two faces: `business` (the default — white, black ink, the
 * dot terrain) and `party` (colour field, stickers, cursive glass wordmark). The layout and copy are identical; only the finish changes.
 *
 * The choice lives in a module-level store rather than React state so that
 * (a) it can be seeded synchronously on the client, before the first render,
 * with no setState-in-effect, and (b) the server snapshot stays `business`, which
 * `useSyncExternalStore` reconciles after hydration without a mismatch.
 * It is published three ways: this hook for components, a `data-mode`
 * attribute on <html> for the CSS tokens, and `scrollState` for the WebGL
 * frame loop, which cannot read React state at 60fps.
 */
function readStored(): Mode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "party" ? "party" : "business";
  } catch {
    return "business"; // private browsing or blocked storage
  }
}

let current: Mode = "business";
if (typeof window !== "undefined") {
  current = readStored();
  // Seed the scene too, un-eased, so it starts on the right face rather than
  // crossfading into it on load.
  scrollState.business = scrollState.businessMix = current === "business" ? 1 : 0;
}

const listeners = new Set<() => void>();
let switchTimer = 0;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setMode(next: Mode) {
  if (next === current) return;
  current = next;
  // Marks the switch itself for CSS (see `[data-switching]` in globals.css):
  // the hero line hides across the layout change and fades back in after.
  const root = document.documentElement;
  root.dataset.switching = "";
  window.clearTimeout(switchTimer);
  switchTimer = window.setTimeout(() => delete root.dataset.switching, 900);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not fatal — the mode still applies for this visit.
  }
  for (const listener of listeners) listener();
}

export function useMode(): { mode: Mode; setMode: (mode: Mode) => void } {
  const mode = useSyncExternalStore(
    subscribe,
    () => current,
    () => "business" as Mode,
  );
  return { mode, setMode };
}

/** Mirrors the mode onto <html> and into the scene. Renders its children as-is. */
export function ModeProvider({ children }: { children: ReactNode }) {
  const { mode } = useMode();

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    scrollState.business = mode === "business" ? 1 : 0;
  }, [mode]);

  return <>{children}</>;
}

/**
 * Applies the stored mode before first paint, so a returning visitor never
 * sees the business palette flash before the party one takes over.
 */
export const modeBootScript = `try{document.documentElement.dataset.mode=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})==="party"?"party":"business"}catch(e){document.documentElement.dataset.mode="business"}`;
