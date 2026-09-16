"use client";

import { useEffect, useRef } from "react";

// Classic 8-bit arrow, tip at the top-left. One character per pixel.
const ARROW = [
  "X.......",
  "XX......",
  "XXX.....",
  "XXXX....",
  "XXXXX...",
  "XXXXXX..",
  "XXXXXXX.",
  "XXXXXXXX",
  "XXXXX...",
  "XX.XXX..",
  "X..XXX..",
  "....XXX.",
  "....XXX.",
  ".....XX.",
];
const PX = 2;
const W = ARROW[0].length * PX;
const H = ARROW.length * PX;

const pixels = ARROW.flatMap((row, y) =>
  [...row].flatMap((cell, x) =>
    cell === "X" ? [{ x: x * PX, y: y * PX }] : [],
  ),
);

/**
 * Terracotta pixel cursor that sits exactly on the pointer. Replaces the OS
 * cursor for fine pointers (see `html.has-cursor` in globals.css); hidden
 * over text fields so the I-beam stays, and never shown on touch.
 */
export function PixelCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement;
    root.classList.add("has-cursor");

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      el.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      const target = event.target as Element | null;
      const overField = !!target?.closest("input, textarea, select");
      const overLink = !!target?.closest("a, button, [role=scrollbar]");
      el.hidden = overField;
      el.dataset.hover = overLink ? "" : undefined;
      if (!overLink) delete el.dataset.hover;
    };
    const onLeave = () => (el.hidden = true);
    const onEnter = () => (el.hidden = false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    return () => {
      root.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      hidden
      className="pixel-cursor pointer-events-none fixed top-0 left-0 z-[70] text-accent will-change-transform"
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        shapeRendering="crispEdges"
        className="pixel-cursor__arrow block"
      >
        {pixels.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={PX} height={PX} fill="currentColor" />
        ))}
      </svg>
    </div>
  );
}
