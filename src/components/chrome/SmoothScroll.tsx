"use client";

import Lenis from "lenis";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const LenisContext = createContext<Lenis | null>(null);

/** The live Lenis instance, or null (not mounted yet, or reduced motion). */
export const useLenisInstance = () => useContext(LenisContext);

/** Module-level handle for non-React readers (the WebGL scene reads velocity). */
export const lenisRef: { current: Lenis | null } = { current: null };

/**
 * Click handler for an in-page anchor: hands the jump to Lenis so it eases
 * instead of snapping, and keeps the hash in the address bar. Without Lenis
 * (reduced motion, or before it mounts) it returns nothing and the anchor is
 * left to the browser, which is why every caller renders a real `href`.
 *
 * Lenis honours each section's own `scroll-margin-top`, so there is no offset
 * to apply here. Shared by the top bar's nav and the hero's CTA — both jump
 * to a section and both have to behave the same way.
 */
export function useScrollTo() {
  const lenis = useLenisInstance();
  return (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!lenis) return;
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target);
    history.replaceState(null, "", href);
  };
}

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
