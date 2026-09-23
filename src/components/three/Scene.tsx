"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { lenisRef } from "@/components/chrome/SmoothScroll";
import { useMode } from "@/components/mode/ModeProvider";
import { Badge } from "./Badge";
import { CloudBackdrop } from "./CloudBackdrop";
import { HeroLetters } from "./HeroLetters";
import { Lighting } from "./Lighting";
import { scrollState, updateScrollState } from "./scrollState";
import { Stickers } from "./Stickers";
import { Ticket } from "./Ticket";

export function Scene() {
  const mobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  // `useMode` is backed by a module store, not context, so it reads correctly
  // from inside the Canvas — React context does not cross the R3F reconciler.
  const business = useMode().mode === "business";

  return (
    <Canvas
      shadows="soft"
      dpr={[1, mobile ? 1.25 : 1.75]}
      camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 30 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      frameloop="always"
      style={{ background: "transparent" }}
    >
      <SceneTracker reducedMotion={reducedMotion} />
      <CloudBackdrop />
      <Lighting business={business} />
      <Suspense fallback={null}>
        <HeroLetters reducedMotion={reducedMotion} mobile={mobile} />
        <Stickers reducedMotion={reducedMotion} />
        {/* One prop per face for the statements block: the lanyard badge on
            business, the tearing ticket on party. */}
        {business ? (
          <Badge reducedMotion={reducedMotion} />
        ) : (
          <Ticket reducedMotion={reducedMotion} />
        )}
      </Suspense>
    </Canvas>
  );
}

/** Feeds scroll + pointer into `scrollState` once per frame. Renders nothing. */
function SceneTracker({ reducedMotion }: { reducedMotion: boolean }) {
  useEffect(() => {
    scrollState.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  const { viewport } = useThree();
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = -((event.clientY / window.innerHeight) * 2 - 1);
      const moved = Math.hypot(nx - last.current.x, ny - last.current.y);
      last.current = { x: nx, y: ny };
      scrollState.pointer.x = nx;
      scrollState.pointer.y = ny;
      scrollState.pointerSpeed = Math.min(1, scrollState.pointerSpeed + moved * 6);
      scrollState.pointerActive = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, delta) => {
    updateScrollState();
    scrollState.velocity = lenisRef.current?.velocity ?? 0;
    // Everything mode-dependent in the scene crossfades on this, so the two
    // faces dissolve into each other instead of cutting.
    const step = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.2);
    scrollState.businessMix += (scrollState.business - scrollState.businessMix) * step;
    scrollState.pointerSpeed *= Math.exp(-delta * 3);
    scrollState.pointerWorld.x = (scrollState.pointer.x * viewport.width) / 2;
    scrollState.pointerWorld.y = (scrollState.pointer.y * viewport.height) / 2;
  });
  return null;
}
