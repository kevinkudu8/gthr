"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, SRGBColorSpace, type Group, type Texture } from "three";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { scrollState } from "./scrollState";
import { STICKERS, type StickerDef } from "./stickerDefs";

/** Rasterise every sticker SVG once; textures are shared by all planes. */
function useStickerTextures() {
  const [textures, setTextures] = useState<Record<string, Texture>>({});
  useEffect(() => {
    let alive = true;
    const out: Record<string, Texture> = {};
    let pending = Object.keys(STICKERS).length;
    for (const def of Object.values(STICKERS)) {
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        const canvas = document.createElement("canvas");
        canvas.width = def.w * 3;
        canvas.height = def.h * 3;
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = 4;
        out[def.id] = tex;
        if (--pending === 0) setTextures({ ...out });
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(def.svg)}`;
    }
    return () => {
      alive = false;
    };
  }, []);
  return textures;
}

function Sticker({ def, texture, width }: { def: StickerDef; texture: Texture; width: number }) {
  return (
    <mesh scale={[width, (width * def.h) / def.w, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

type Slot = { id: string; seed: number; speed: number; z: number; size: number };

// The whole sheet, wandering. Each sticker follows its own smooth noise path
// across the hero — including behind the wordmark, which refracts it.
const SLOTS: Slot[] = [
  { id: "coil", seed: 1, speed: 0.045, z: -1.4, size: 0.1 },
  { id: "asterisk", seed: 2, speed: 0.04, z: -1.8, size: 0.09 },
  { id: "invader", seed: 3, speed: 0.05, z: -1.2, size: 0.09 },
  { id: "globe", seed: 4, speed: 0.035, z: -2.2, size: 0.09 },
  { id: "bars", seed: 5, speed: 0.042, z: -1.6, size: 0.028 },
  { id: "label", seed: 6, speed: 0.03, z: -2.0, size: 0.12 },
  { id: "dots", seed: 7, speed: 0.048, z: -1.5, size: 0.075 },
  { id: "files", seed: 8, speed: 0.028, z: -2.4, size: 0.14 },
  { id: "checker", seed: 9, speed: 0.055, z: -1.3, size: 0.045 },
  { id: "gradient", seed: 10, speed: 0.038, z: -2.1, size: 0.12 },
  { id: "diamond", seed: 11, speed: 0.044, z: -1.7, size: 0.06 },
];

/**
 * Per-sticker runtime state. The noise path is only ever a *target* now: the
 * authoritative position is here, so a sticker that has been thrown can carry
 * on under its own momentum and then find its way back onto its path.
 */
type Runtime = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  /** 0 drifting on its path, 1 held by the pointer, 2 thrown. */
  mode: 0 | 1 | 2;
  /** How firmly it is back on its path, 0..1 — ramps after a throw settles. */
  settle: number;
  primed: boolean;
};

const GRAB_PAD = 1.2;
/** Ignore pointer-downs that belong to something interactive. */
const INTERACTIVE = "a, button, input, textarea, select, label, [role='scrollbar']";

/** Flat sticker props drifting behind the hero wordmark — and grabbable. */
export function Stickers({ reducedMotion }: { reducedMotion: boolean }) {
  const textures = useStickerTextures();
  const root = useRef<Group>(null);
  const slots = useRef<(Group | null)[]>([]);
  const noise = useMemo(() => new SimplexNoise(), []);
  const { viewport, camera } = useThree();

  const runtime = useRef<Runtime[]>(
    SLOTS.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0, mode: 0, settle: 1, primed: false })),
  );
  /** Pointer in NDC, tracked here so a touch drag works too. */
  const pointer = useRef({ x: 0, y: 0, has: false });
  const held = useRef({ index: -1, dx: 0, dy: 0 });

  /**
   * The pointer's world position on the plane a sticker sits on. The frustum
   * widens with distance from the camera, so each depth needs its own scale —
   * `viewport` is only the size at z = 0.
   */
  const pointerAt = useCallback(
    (worldZ: number) => {
      const spread = (camera.position.z - worldZ) / camera.position.z;
      return {
        x: pointer.current.x * (viewport.width / 2) * spread,
        y: pointer.current.y * (viewport.height / 2) * spread,
      };
    },
    [camera, viewport.width, viewport.height],
  );

  useEffect(() => {
    const setPointer = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
      pointer.current.has = true;
    };

    const onDown = (event: PointerEvent) => {
      if (event.button > 0) return;
      if ((event.target as Element | null)?.closest(INTERACTIVE)) return;
      // Party face, and only while the sheet is actually on screen.
      if (scrollState.businessMix > 0.5 || scrollState.hero > 0.9) return;
      setPointer(event);

      const present = Math.max(0.001, 1 - scrollState.businessMix);
      const rootY = scrollState.hero * viewport.height * 0.8;
      const unit = viewport.width;
      let pick = -1;
      let pickZ = -Infinity;
      SLOTS.forEach((slot, i) => {
        const state = runtime.current[i];
        const def = STICKERS[slot.id];
        const width = unit * slot.size;
        const halfX = (width / 2) * GRAB_PAD;
        const halfY = ((width * def.h) / def.w / 2) * GRAB_PAD;
        const p = pointerAt(slot.z * present);
        // Into the root group's space, then into the sticker's own rotation.
        const lx = p.x / present - state.x;
        const ly = (p.y - rootY) / present - state.y;
        const c = Math.cos(-state.rot);
        const sn = Math.sin(-state.rot);
        if (Math.abs(lx * c - ly * sn) > halfX || Math.abs(lx * sn + ly * c) > halfY) return;
        // Frontmost wins, so the one you can see is the one you get.
        if (slot.z > pickZ) {
          pickZ = slot.z;
          pick = i;
          held.current = { index: i, dx: lx, dy: ly };
        }
      });

      if (pick >= 0) {
        runtime.current[pick].mode = 1;
        runtime.current[pick].vx = 0;
        runtime.current[pick].vy = 0;
        document.body.style.userSelect = "none";
      }
    };

    const onUp = () => {
      const { index } = held.current;
      if (index < 0) return;
      const state = runtime.current[index];
      // Let go mid-flick and it keeps the speed it had; a spin comes off the
      // sideways component, which is what makes a throw read as a throw.
      state.mode = 2;
      state.spin = -state.vx * 0.18;
      held.current = { index: -1, dx: 0, dy: 0 };
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", setPointer, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", setPointer);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
    };
    // `viewport` is read inside; re-binding on resize keeps the hit test honest.
  }, [viewport.width, viewport.height, camera, pointerAt]);

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const t = reducedMotion ? 40 : clock.elapsedTime;
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;
    const { hero: heroProgress, businessMix } = scrollState;
    // Stickers belong to the party face only; they shrink away as the
    // business face (and its metal logo) takes over.
    const present = 1 - businessMix;
    g.visible = heroProgress < 0.98 && present > 0.01;
    if (!g.visible) return;
    g.position.y = heroProgress * viewport.height * 0.8;
    g.scale.setScalar(present);

    const dt = Math.min(0.05, delta);
    const unit = viewport.width;

    SLOTS.forEach((s, i) => {
      const el = slots.current[i];
      if (!el) return;
      const state = runtime.current[i];
      const u = t * s.speed;
      // Two independent noise channels per sticker → a smooth random walk,
      // stretched a little past ±1 so paths reach the edges of the frame.
      const nx = noise.noise(s.seed * 12.9, u) * 1.25;
      const ny = noise.noise(s.seed * 7.3 + 100, u) * 1.25;
      const targetX = Math.max(-1, Math.min(1, nx)) * halfW * 0.9;
      const targetY = Math.max(-1, Math.min(1, ny)) * halfH * 0.85;
      const targetRot = noise.noise(s.seed * 3.1 + 200, u * 0.7) * 0.35;

      if (!state.primed) {
        state.x = targetX;
        state.y = targetY;
        state.rot = targetRot;
        state.primed = true;
      }

      const def = STICKERS[s.id];
      const width = unit * s.size;
      const halfX = width / 2;
      const halfY = (width * def.h) / def.w / 2;

      if (state.mode === 1) {
        // Held: the sticker goes where the pointer goes, keeping the grip
        // offset so it does not snap its centre to the cursor. Velocity is
        // measured from the movement itself, which is what gets thrown.
        const p = pointerAt(s.z * present);
        const nextX = p.x / present - held.current.dx;
        const nextY = (p.y - g.position.y) / present - held.current.dy;
        state.vx = (nextX - state.x) / Math.max(dt, 1 / 120);
        state.vy = (nextY - state.y) / Math.max(dt, 1 / 120);
        state.x = nextX;
        state.y = nextY;
        state.settle = 0;
      } else if (state.mode === 2) {
        state.x += state.vx * dt;
        state.y += state.vy * dt;
        state.vx *= Math.exp(-dt * 0.85);
        state.vy *= Math.exp(-dt * 0.85);
        state.rot += state.spin * dt;
        state.spin *= Math.exp(-dt * 1.1);

        // Bounce off the frame, losing a third of the speed each time.
        const limitX = halfW - halfX;
        const limitY = halfH - halfY;
        if (state.x < -limitX || state.x > limitX) {
          state.x = Math.max(-limitX, Math.min(limitX, state.x));
          state.vx = -state.vx * 0.66;
          state.spin += state.vy * 0.05;
        }
        if (state.y < -limitY || state.y > limitY) {
          state.y = Math.max(-limitY, Math.min(limitY, state.y));
          state.vy = -state.vy * 0.66;
          state.spin += state.vx * 0.05;
        }

        // Once it has run out of throw, it goes looking for its path again.
        if (Math.hypot(state.vx, state.vy) < halfW * 0.06) state.mode = 0;
      } else {
        // Drifting. The pull toward the path starts weak and firms up, so a
        // sticker that was just thrown wanders back rather than snapping home.
        state.settle = Math.min(1, state.settle + dt * 0.35);
        const k = 1 - Math.exp(-dt * (0.5 + state.settle * 2.6));
        state.x += (targetX - state.x) * k;
        state.y += (targetY - state.y) * k;
        state.rot += (targetRot - state.rot) * k;
      }

      el.position.set(state.x, state.y, s.z);
      el.rotation.z = state.rot;
    });
  });

  if (Object.keys(textures).length === 0) return null;
  const unit = viewport.width;

  return (
    <group ref={root}>
      {SLOTS.map((s, i) => (
        <group
          key={s.id}
          ref={(el) => {
            slots.current[i] = el;
          }}
        >
          <Sticker def={STICKERS[s.id]} texture={textures[s.id]} width={unit * s.size} />
        </group>
      ))}
    </group>
  );
}
