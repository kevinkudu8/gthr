"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { brands } from "@/content/site";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const SLOTS = 9;
/** Ms between swaps. One slot changes at a time, so each one turns over about every 16s. */
const STEP_MS = 1800;
/** The order slots change in: scattered, so it never reads as a left-to-right sweep. */
const ORDER = [4, 0, 7, 2, 5, 8, 1, 6, 3];

type Logo = (typeof brands.logos)[number];

/**
 * Width as a share of the cell, from the logo's proportions: grows with the
 * square root of the aspect, so a long wordmark and a squarish shield cover
 * about the same area, capped so nothing touches the cell's edges.
 */
function logoStyle(logo: Logo): CSSProperties {
  const scale = "scale" in logo ? logo.scale : 1;
  const width = Math.min(72, 26 * Math.sqrt(logo.aspect) * scale);
  return {
    width: `${width}%`,
    aspectRatio: logo.aspect,
    maskImage: `url(${logo.src})`,
    WebkitMaskImage: `url(${logo.src})`,
  };
}

type Slot = { logo: number; previous: number | null; turn: number };

/**
 * Nine logos at a time out of the full list. Every STEP_MS one slot hands its
 * logo to the back of the queue and takes the one waiting longest, crossfading
 * between them, so every brand comes round and none shows twice at once.
 * Paused off screen and in background tabs; still under reduced motion.
 * The wall is decorative (aria-hidden); the full list is in the sr-only list.
 */
export function BrandGrid() {
  const count = brands.logos.length;
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: Math.min(SLOTS, count) }, (_, i) => ({ logo: i, previous: null, turn: 0 })),
  );
  const live = useRef(slots);
  const queue = useRef<number[]>(Array.from({ length: Math.max(0, count - SLOTS) }, (_, i) => SLOTS + i));
  const step = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen || reducedMotion || queue.current.length === 0) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const index = ORDER[step.current % ORDER.length];
      step.current += 1;
      // The queue is a ref, so it is changed here, outside the state updater
      // (which React may run twice).
      const next = live.current.slice();
      const slot = next[index];
      const incoming = queue.current.shift()!;
      queue.current.push(slot.logo);
      next[index] = { logo: incoming, previous: slot.logo, turn: slot.turn + 1 };
      live.current = next;
      setSlots(next);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [onScreen, reducedMotion]);

  return (
    <div ref={root}>
      <ul className="sr-only">
        {brands.logos.map((logo) => (
          <li key={logo.name}>{logo.name}</li>
        ))}
      </ul>
      <div className="brand-grid grid grid-cols-3" aria-hidden="true">
        {slots.map((slot, i) => (
          <div key={i} className="brand-cell relative grid place-items-center">
            {slot.previous !== null ? (
              <span
                key={`out-${slot.turn}`}
                className="brand-logo brand-logo--out"
                style={logoStyle(brands.logos[slot.previous])}
              />
            ) : null}
            <span
              key={`in-${slot.turn}`}
              className={`brand-logo ${slot.turn > 0 ? "brand-logo--in" : ""}`}
              style={logoStyle(brands.logos[slot.logo])}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
