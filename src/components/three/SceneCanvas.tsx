"use client";

import dynamic from "next/dynamic";

// three + R3F are browser-only; keep them out of the server bundle entirely.
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
});

/**
 * Fixed full-viewport WebGL layer behind the page, like the reference. Every
 * section is transparent, so the scene shows through; the opaque statement
 * panel and nothing else covers it.
 */
export function SceneCanvas() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-dvh w-full lg:h-screen"
    >
      <Scene />
    </div>
  );
}
