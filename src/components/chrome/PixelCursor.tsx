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
// 1.5px cells: 12 x 21, about the size of the OS arrow. At 2 it was 16 x 28,
// and half again on hover.
const PX = 1.5;
// One cell of black outline all round the arrow, so it holds up over the
// party field's orange as well as its dark ground. The drawing grows by a
// cell each side and is pulled back by one, so the tip stays on the pointer.
const W = (ARROW[0].length + 2) * PX;
const H = (ARROW.length + 2) * PX;

const filled = (x: number, y: number) => ARROW[y]?.[x] === "X";

const pixels = ARROW.flatMap((row, y) =>
  [...row].flatMap((cell, x) =>
    cell === "X" ? [{ x: (x + 1) * PX, y: (y + 1) * PX }] : [],
  ),
);

const outline: { x: number; y: number }[] = [];
for (let y = -1; y <= ARROW.length; y++) {
  for (let x = -1; x <= ARROW[0].length; x++) {
    if (filled(x, y)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++)
      for (let dx = -1; dx <= 1 && !near; dx++) near = filled(x + dx, y + dy);
    if (near) outline.push({ x: (x + 1) * PX, y: (y + 1) * PX });
  }
}

/**
 * Custom cursor that sits exactly on the pointer. Replaces the OS cursor for
 * fine pointers (see `html.has-cursor` in globals.css); hidden over text
 * fields so the I-beam stays, and never shown on touch.
 *
 * Two drawings, one per face, swapped in CSS by `data-mode`: party gets the
 * terracotta 8-bit arrow; business a slim vector arrow in soft black with a
 * paper keyline, which fills mint over links (mint as a fill with black
 * around it, the only way it is used on that face). Both about OS size.
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
      className="pixel-cursor pointer-events-none fixed top-0 left-0 z-[70] text-accent-ink will-change-transform"
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        shapeRendering="crispEdges"
        className="pixel-cursor__arrow pixel-cursor__arrow--party"
        style={{ margin: `${-PX}px 0 0 ${-PX}px` }}
      >
        {outline.map((p, i) => (
          <rect key={`o${i}`} x={p.x} y={p.y} width={PX} height={PX} fill="#0b0b0c" />
        ))}
        {pixels.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={PX} height={PX} fill="currentColor" />
        ))}
      </svg>
      <svg
        width={14}
        height={20}
        viewBox="0 0 14 20"
        className="pixel-cursor__arrow pixel-cursor__arrow--business"
      >
        <path
          d="M1.2 1.2 L1.2 16.2 L5 12.6 L7.6 18.4 L10 17.3 L7.5 11.6 L12.6 11.6 Z"
          className="pixel-cursor__sleek"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
