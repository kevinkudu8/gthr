"use client";

import { useLayoutEffect, useRef } from "react";

type Props = {
  value: number;
  suffix?: string;
  className?: string;
};

/** How long a count takes, and the easing — a fast start that settles. */
const DURATION = 1400;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * A number that counts up from zero when it scrolls into view, the same way
 * `Reveal` arms its transitions: the final value is what the server renders,
 * so without JS — and for search — the real figure is always there. JS only
 * takes it back to zero if it is still below the fold, then counts up once it
 * enters (same threshold and margin as `Reveal`, so it lands with the rest of
 * the section). Reduced motion leaves the final number alone.
 *
 * The final value is laid out invisibly underneath the counting one, so the
 * width is fixed from the start and nothing beside it shifts as digits change.
 * Screen readers get the final value only.
 */
export function CountUp({ value, suffix = "", className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = `${value}${suffix}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen at load: leave it. Counting something the visitor is
    // already reading is noise.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    el.textContent = `0${suffix}`;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION);
          el.textContent = `${Math.round(easeOut(t) * value)}${suffix}`;
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = final;
    };
  }, [value, suffix, final]);

  return (
    <span className={`relative inline-grid ${className}`}>
      <span className="sr-only">{final}</span>
      {/* Sizes the box to the final value, so counting never reflows. */}
      <span aria-hidden="true" className="invisible [grid-area:1/1]">
        {final}
      </span>
      <span ref={ref} aria-hidden="true" className="[grid-area:1/1]">
        {final}
      </span>
    </span>
  );
}
