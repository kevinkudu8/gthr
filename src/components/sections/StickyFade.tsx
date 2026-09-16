"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fades its content out as the following sibling panel slides up over it.
 * Reads the parent `#statements` block: the sticky panel is covered once the
 * block has scrolled one viewport past its top.
 */
export function StickyFade({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const block = document.getElementById("statements");
    if (!el || !block) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const covered = -block.getBoundingClientRect().top / vh; // 0 → 1 while covered
      // Hold until the next panel is well over the top, then fade out fast so
      // the two statements never read at once.
      const opacity = 1 - Math.min(1, Math.max(0, (covered - 0.4) / 0.35));
      el.style.opacity = String(opacity);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    // Capture phase: fires for the scroll wrapper as well as the window.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="col-span-12 grid grid-cols-12 self-center">
      {children}
    </div>
  );
}
