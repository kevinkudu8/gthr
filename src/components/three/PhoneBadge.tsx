"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { useMode } from "@/components/mode/ModeProvider";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { Badge } from "./Badge";
import { Lighting } from "./Lighting";

/**
 * The business badge on phones and tablets, in its own small canvas inside
 * the hero rather than the fixed scene canvas. It scrolls with the page the
 * way the CTA it hangs from does, natively — the fixed canvas had to follow
 * the scroll in JS a frame behind the page, and the card shook against the
 * button (client: "jitters a lot on scroll"). A screen tall, at the top of
 * the hero, behind its type; it stops drawing once scrolled out of view.
 */
export function PhoneBadge() {
  const mobile = useIsMobile();
  const business = useMode().mode === "business";
  if (!mobile || !business) return null;
  return <PhoneBadgeCanvas />;
}

function PhoneBadgeCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-svh">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 30 }}
        gl={{ alpha: true, antialias: true }}
        frameloop={onScreen ? "always" : "never"}
        style={{ background: "transparent" }}
      >
        <Lighting business />
        <Suspense fallback={null}>
          <Badge reducedMotion={reducedMotion} mobile inPage />
        </Suspense>
      </Canvas>
    </div>
  );
}
