"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { scrollState } from "@/components/three/scrollState";

/**
 * The spectral sweep over the business wordmark.
 *
 * A second copy of the word laid exactly over the first, painted with a stack
 * of spectral blobs through `background-clip: text`. The *base* word underneath
 * is never touched — it stays plain ink — so there is nothing to go wrong with
 * the type itself; this layer simply fades in on top of it, which is what makes
 * the onset gradual rather than a switch.
 *
 * It is also where the hover lives: it publishes `scrollState.wordmark`, which
 * is what the dot field reads to gather itself into the letterforms
 * (three/DotTerrain.tsx).
 *
 * The blob positions are driven from a frame loop rather than from CSS
 * keyframes, because they answer to the pointer as well as to the clock — the
 * two cannot share the `background-position` property otherwise. The loop only
 * runs while the word is hovered (and while the sheen is fading back out), so
 * it costs nothing the rest of the time.
 */

/**
 * One entry per gradient layer. Each drifts on its own pair of frequencies and
 * answers to the pointer by its own amount and sign, so the layers cross
 * instead of marching — deliberately incommensurate, so the pattern does not
 * visibly repeat.
 */
const LAYERS = [
  { ax: 78, fx: 0.13, px: 70, ay: 42, fy: 0.09, py: 40, phase: 0 },
  { ax: 64, fx: 0.09, px: -55, ay: 55, fy: 0.12, py: 60, phase: 2.1 },
  { ax: 88, fx: 0.16, px: 50, ay: 38, fy: 0.07, py: -45, phase: 4 },
  { ax: 58, fx: 0.11, px: -65, ay: 62, fy: 0.14, py: -35, phase: 5.3 },
  { ax: 72, fx: 0.07, px: 60, ay: 48, fy: 0.1, py: 50, phase: 1.2 },
];

export function WordSheen({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    const word = el?.parentElement;
    if (!el || !word) return;

    let frame = 0;
    let hovering = false;
    let strength = 0;
    let last = performance.now();
    const pointer = { x: 0.5, y: 0.5 };
    const eased = { x: 0.5, y: 0.5 };

    const smoothstep = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    const tick = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Eased in and out, so the colour arrives and leaves rather than snaps.
      const target = hovering ? 1 : 0;
      strength += (target - strength) * (1 - Math.exp(-delta * (hovering ? 3.2 : 5)));
      eased.x += (pointer.x - eased.x) * (1 - Math.exp(-delta * 6));
      eased.y += (pointer.y - eased.y) * (1 - Math.exp(-delta * 6));

      el.style.opacity = `${strength}`;

      // The word draws back as the page leaves it, while the dot field gathers
      // into it (three/DotTerrain.tsx mirrors this with uTextScale/uTextShift,
      // so the two have to agree). It still scrolls away with the document —
      // this is only the recession on top of that.
      const drift = smoothstep(0.12, 0.75, scrollState.hero);
      word.style.transform = drift > 0 ? `scale(${(1 - drift * 0.3).toFixed(4)})` : "";
      word.style.opacity = drift > 0 ? `${(1 - drift).toFixed(3)}` : "";
      if (!reducedMotion) {
        const t = now / 1000;
        const dx = eased.x - 0.5;
        const dy = eased.y - 0.5;
        el.style.backgroundPosition =
          LAYERS.map((l) => {
            const x = 50 + l.ax * Math.sin(t * l.fx * Math.PI * 2 + l.phase) + l.px * dx;
            const y = 50 + l.ay * Math.sin(t * l.fy * Math.PI * 2 + l.phase * 1.7) + l.py * dy;
            return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
          }).join(", ") + ", 0% 0%";
      }

      // Keep going while it is hovered, long enough afterwards to finish fading
      // out, and through the hero's own scroll range so the recession above
      // stays in step with the field.
      const scrolling = scrollState.hero > 0.001 && scrollState.hero < 0.999;
      if (hovering || strength > 0.002 || scrolling) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        el.style.opacity = "0";
      }
    };

    const start = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const onEnter = () => {
      hovering = true;
      scrollState.wordmark = 1;
      start();
    };
    const onLeave = () => {
      hovering = false;
      scrollState.wordmark = 0;
      start();
    };
    const onMove = (event: PointerEvent) => {
      const rect = word.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      pointer.x = (event.clientX - rect.left) / rect.width;
      pointer.y = (event.clientY - rect.top) / rect.height;
    };

    // Capture phase: fires for the scroll wrapper as well as the window. The
    // loop stops when nothing is moving, so it needs waking when scroll starts.
    const onScroll = () => start();

    word.addEventListener("pointerenter", onEnter);
    word.addEventListener("pointerleave", onLeave);
    word.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      word.removeEventListener("pointerenter", onEnter);
      word.removeEventListener("pointerleave", onLeave);
      word.removeEventListener("pointermove", onMove);
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (frame) cancelAnimationFrame(frame);
      word.style.transform = "";
      word.style.opacity = "";
      scrollState.wordmark = 0;
    };
  }, [reducedMotion]);

  return (
    <span ref={ref} className="hero-lockup__sheen" aria-hidden="true">
      {text}
    </span>
  );
}
