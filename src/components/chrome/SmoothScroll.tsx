"use client";

import Lenis from "lenis";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const LenisContext = createContext<Lenis | null>(null);

/** The live Lenis instance, or null (not mounted yet, or reduced motion). */
export const useLenisInstance = () => useContext(LenisContext);

/** Module-level handle for non-React readers (the WebGL scene reads velocity). */
export const lenisRef: { current: Lenis | null } = { current: null };

/**
 * The page scrolls inside a fixed, viewport-sized wrapper (like the
 * reference), driven by Lenis. Fixed chrome is rendered outside the wrapper.
 * Reduced motion: no Lenis — the wrapper scrolls natively.
 */
export function SmoothScroll({ children, chrome }: { children: ReactNode; chrome?: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const wrap = wrapper.current;
    const body = content.current;
    if (!wrap || !body || reducedMotion) return;

    const instance = new Lenis({ wrapper: wrap, content: body, lerp: 0.1, autoRaf: true });
    lenisRef.current = instance;
    setLenis(instance);

    return () => {
      lenisRef.current = null;
      instance.destroy();
      setLenis(null);
    };
  }, [reducedMotion]);

  return (
    <LenisContext.Provider value={lenis}>
      {/* Not "lenis-*": Lenis strips any class with that prefix on destroy. */}
      <div ref={wrapper} className="scroll-wrapper no-scrollbar">
        <div ref={content}>{children}</div>
      </div>
      {chrome}
    </LenisContext.Provider>
  );
}
