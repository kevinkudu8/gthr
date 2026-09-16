"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { useLenisInstance } from "./SmoothScroll";

const TRACK = 200;
const THUMB = 28;

/**
 * Thin scrollbar pinned to the right edge on desktop, driven by Lenis so it
 * tracks the smoothed position. Click or drag the track to jump. Not rendered
 * without Lenis (reduced motion).
 */
export function SideScrollbar() {
  const thumbRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lenis = useLenisInstance();

  useEffect(() => {
    if (!lenis) return;
    return lenis.on("scroll", (instance) => {
      const thumb = thumbRef.current;
      if (thumb) thumb.style.transform = `translateY(${instance.progress * (TRACK - THUMB)}px)`;
    });
  }, [lenis]);

  const jumpTo = (event: PointerEvent) => {
    const track = trackRef.current;
    if (!lenis || !track) return;
    const { top } = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - top - THUMB / 2) / (TRACK - THUMB)));
    lenis.scrollTo(ratio * lenis.limit, { immediate: dragging.current });
  };

  if (!lenis) return null;

  return (
    <div
      className="side-scrollbar pointer-events-auto fixed top-1/2 right-0 z-30 hidden w-14 -translate-y-1/2 items-center justify-center px-3 lg:flex"
      style={{ height: TRACK }}
      role="scrollbar"
      aria-controls="main"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <div
        ref={trackRef}
        className="relative h-full w-1.5 cursor-pointer touch-none rounded-full bg-ink-4"
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          jumpTo(event);
        }}
        onPointerMove={(event) => dragging.current && jumpTo(event)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <span
          ref={thumbRef}
          className="absolute inset-x-0 top-0 rounded-full bg-ink-1 will-change-transform"
          style={{ height: THUMB }}
        />
      </div>
    </div>
  );
}
