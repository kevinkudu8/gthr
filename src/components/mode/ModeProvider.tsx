"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { scrollState } from "@/components/three/scrollState";

export type Mode = "party" | "business";

const STORAGE_KEY = "gthr:mode";

/**
 * The site has two faces: `party` (the default — colour field, stickers,
 * cursive glass wordmark) and `business` (white, corporate green, the logo as
 * a metal object). The layout and copy are identical; only the finish changes.
 *
 * The choice lives in a module-level store rather than React state so that
 * (a) it can be seeded synchronously on the client, before the first render,
 * with no setState-in-effect, and (b) the server snapshot stays `party`, which
 * `useSyncExternalStore` reconciles after hydration without a mismatch.
 * It is published three ways: this hook for components, a `data-mode`
 * attribute on <html> for the CSS tokens, and `scrollState` for the WebGL
 * frame loop, which cannot read React state at 60fps.
 */
function readStored(): Mode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "business" ? "business" : "party";
  } catch {
    return "party"; // private browsing or blocked storage
  }
}

let current: Mode = "party";
if (typeof window !== "undefined") current = readStored();

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setMode(next: Mode) {
  if (next === current) return;
  current = next;
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
    () => "party" as Mode,
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
 * sees the party palette flash before the business one takes over.
 */
export const modeBootScript = `try{document.documentElement.dataset.mode=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})==="business"?"business":"party"}catch(e){}`;
