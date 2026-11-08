"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { lenisRef } from "@/components/chrome/SmoothScroll";
import { scrollState } from "@/components/three/scrollState";

export type Mode = "party" | "business";

const STORAGE_KEY = "gthr:mode";

/**
 * The site has two faces: `business` (the default — white, black ink, the
 * dot terrain) and `party` (colour field, cursive glass wordmark), shown to
 * visitors as light and dark mode. The layout and copy are nearly identical;
 * only the finish changes.
 *
 * The choice lives in a module-level store rather than React state so that
 * (a) it can be seeded synchronously on the client, before the first render,
 * with no setState-in-effect, and (b) the server snapshot stays `business`, which
 * `useSyncExternalStore` reconciles after hydration without a mismatch.
 * It is published three ways: this hook for components, a `data-mode`
 * attribute on <html> for the CSS tokens, and `scrollState` for the WebGL
 * frame loop, which cannot read React state at 60fps.
 */
/*
 * Remembered per tab (sessionStorage), not forever: every new visit opens on
 * business, the default face, while a reload keeps the face you picked. It was
 * localStorage, so anyone who had toggled to party kept landing on party.
 */
function readStored(): Mode {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "party" ? "party" : "business";
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

/*
 * Keeping your place across a switch. The two faces are not the same length
 * (party pulls Services up into the second statement, for one), so the same
 * scroll offset lands somewhere else. Instead: before the switch, note which
 * section is under the middle of the screen and how far through it the middle
 * is; after the new face has laid out, scroll so that same point of that same
 * section is under the middle again.
 */
const ANCHORS = ["hero", "about", "statements", "services", "contact"];
type Anchor = { id: string; progress: number };
let pendingAnchor: Anchor | null = null;

function scroller(): HTMLElement {
  return document.querySelector<HTMLElement>(".scroll-wrapper") ?? document.documentElement;
}

function captureAnchor(): Anchor | null {
  const mid = window.innerHeight / 2;
  for (const id of ANCHORS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.top <= mid && r.bottom > mid) return { id, progress: (mid - r.top) / Math.max(1, r.height) };
  }
  return null;
}

function restoreAnchor(anchor: Anchor) {
  const el = document.getElementById(anchor.id);
  if (!el) return;
  const box = scroller();
  const r = el.getBoundingClientRect();
  const lenis = lenisRef.current;
  const current = lenis ? lenis.scroll : box.scrollTop;
  const target = current + r.top + anchor.progress * r.height - window.innerHeight / 2;
  if (lenis) {
    lenis.resize(); // the content height just changed under it
    lenis.scrollTo(target, { immediate: true, force: true });
  } else {
    box.scrollTop = target;
  }
}

const listeners = new Set<() => void>();
let switchTimer = 0;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setMode(next: Mode) {
  if (next === current) return;
  pendingAnchor = captureAnchor();
  current = next;
  // Marks the switch itself for CSS (see `[data-switching]` in globals.css):
  // the hero line hides across the layout change and fades back in after.
  const root = document.documentElement;
  root.dataset.switching = "";
  window.clearTimeout(switchTimer);
  switchTimer = window.setTimeout(() => delete root.dataset.switching, 900);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, next);
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
    const anchor = pendingAnchor;
    pendingAnchor = null;
    if (!anchor) return;
    // Once now, against the new face's CSS, and again next frame in case
    // anything laid out late.
    restoreAnchor(anchor);
    const frame = requestAnimationFrame(() => restoreAnchor(anchor));
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  return <>{children}</>;
}

/**
 * Applies the stored mode before first paint, so a returning visitor never
 * sees the business palette flash before the party one takes over.
 */
export const modeBootScript = `try{document.documentElement.dataset.mode=sessionStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})==="party"?"party":"business"}catch(e){document.documentElement.dataset.mode="business"}`;
