"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Group, type Texture } from "three";
import { scrollState } from "./scrollState";

const W = 1.7; // badge width, world units
const H = W * 1.4;
const D = 0.05;
const STRAP_W = 0.34;
const STRAP_L = 7;
const HOLE_Y = H / 2 - 0.16; // hole centre, card-local
const RING_Y = H / 2 + 0.5; // strap loop ring, card-local
const PIVOT = H / 2 + 2.6; // pendulum pivot, up the strap

/** Fonts as the page loaded them (next/font hashes the family names). */
function pageFonts() {
  const sans = getComputedStyle(document.body).fontFamily;
  const mono = getComputedStyle(document.querySelector("time") ?? document.body).fontFamily;
  return { sans, mono };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The badge face: colour field, pink band with GTHR, pale footer, a hole. */
function paintBadge(fonts: { sans: string; mono: string }) {
  const w = 680;
  const h = Math.round(w * (H / W));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  roundedRect(ctx, 0, 0, w, h, 44);
  ctx.clip();

  ctx.fillStyle = "#c9c4d8";
  ctx.fillRect(0, 0, w, h);
  const blobs: [number, number, number, string][] = [
    [w * 0.35, h * 0.3, w * 0.55, "#49d6ff"],
    [w * 0.8, h * 0.18, w * 0.35, "#ffd640"],
    [w * 0.6, h * 0.5, w * 0.45, "#ff62b8"],
    [w * 0.15, h * 0.52, w * 0.4, "#3d8dff"],
  ];
  for (const [x, y, r, c] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, `${c}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.6);
  }
  // Year chip + hashtag, top right.
  ctx.fillStyle = "#ff62b8";
  ctx.fillRect(w - 170, 40, 130, 80);
  ctx.fillStyle = "#0b100e";
  ctx.beginPath();
  ctx.ellipse(w - 105, 80, 46, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff62b8";
  ctx.font = `700 40px ${fonts.sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("26", w - 105, 82);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(w - 170, 124, 130, 34);
  ctx.fillStyle = "#0b100e";
  ctx.font = `600 18px ${fonts.mono}`;
  ctx.fillText("#GTHR26", w - 105, 142);

  // Band: hot pink with GTHR set large but whole, black.
  const bandTop = h * 0.56;
  const bandH = h * 0.3;
  ctx.fillStyle = "#ff62b8";
  ctx.fillRect(0, bandTop, w, bandH);
  ctx.fillStyle = "#171612";
  ctx.font = `800 ${Math.round(bandH * 0.78)}px ${fonts.sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GTHR", w / 2, bandTop + bandH / 2 + 6);

  // Pale footer.
  ctx.fillStyle = "#ffb7e0";
  ctx.fillRect(0, bandTop + bandH, w, h - bandTop - bandH);
  ctx.fillStyle = "#171612";
  ctx.font = `600 22px ${fonts.mono}`;
  ctx.fillText("ALL ACCESS", w / 2, bandTop + bandH + (h - bandTop - bandH) / 2);

  // Punched hole (paper shows through in the scene; here a dark rim).
  const holeY = (H / 2 - HOLE_Y) * (h / H);
  ctx.fillStyle = "#171612";
  ctx.beginPath();
  ctx.arc(w / 2, holeY, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4f3ee";
  ctx.beginPath();
  ctx.arc(w / 2, holeY, 14, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/**
 * The strap: pink with "GTHR 26" repeating. Painted horizontally (no canvas
 * rotation) and applied to a plane that is rotated upright in the scene, so
 * the text orientation is decided by the mesh, not by texture conventions.
 */
function paintStrap(fonts: { sans: string }) {
  const w = 1600;
  const h = 160;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#ff8fd0";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#171612";
  ctx.font = `800 88px ${fonts.sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 0; x < w; x += 400) ctx.fillText("GTHR 26", x + 200, h / 2 + 4);
  return canvas;
}

/**
 * One big lanyard badge for the statements block. Travels from upper left,
 * close past the camera, and out lower right on scroll; hangs from a pivot
 * up the strap as a real pendulum, driven by its own acceleration.
 */
export function Badge({ reducedMotion }: { reducedMotion: boolean }) {
  const root = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const physics = useRef({ theta: 0, omega: 0, lastX: 0, lastVx: 0, warm: 0, primed: false });
  const [textures, setTextures] = useState<{ face: Texture; strap: Texture } | null>(null);
  const { viewport } = useThree();

  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const fonts = pageFonts();
      const face = new CanvasTexture(paintBadge(fonts));
      face.colorSpace = SRGBColorSpace;
      face.anisotropy = 8;
      const strap = new CanvasTexture(paintStrap(fonts));
      strap.colorSpace = SRGBColorSpace;
      strap.wrapS = strap.wrapT = RepeatWrapping;
      strap.repeat.set(STRAP_L / 2.2, 1);
      setTextures({ face, strap });
    });
    return () => {
      alive = false;
    };
  }, []);

  useFrame(({ clock }, rawDelta) => {
    const g = root.current;
    const pv = pivot.current;
    if (!g || !pv) return;
    const { statement: p, thermal } = scrollState;
    const ph = physics.current;
    // Present early but parked far off-screen left, so it slides in rather
    // than popping into view. The intro image has faded by the time its
    // leading edge reaches the frame.
    g.visible = thermal > 0.02;
    if (!g.visible) {
      ph.primed = false;
      return;
    }
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;
    const dt = Math.min(0.05, rawDelta);
    const t = reducedMotion ? 0 : clock.elapsedTime;

    // Travel of the card: upper-left → centre (close) → lower-right, dipping
    // low at the closest point so the light colour field, not the band, sits
    // behind the statement text. The pivot sits PIVOT above the card; the
    // group is positioned at the pivot and the card hangs from it.
    const e = p * p * (3 - 2 * p);
    // Closest to the camera a little before half-way, then steadily further
    // away as it travels right, so it exits smaller and more distant.
    const rise = Math.min(1, p / 0.38);
    const near = Math.sin(rise * Math.PI * 0.5);
    const fall = Math.max(0, (p - 0.38) / 0.62);
    const mid = near - fall * 1.5;
    const z = mid * 3.1 - 0.6;
    const scaleAtZ = (6 - z) / 6; // the visible half-extent shrinks as it nears the camera
    const x = (-2.3 + e * 4.6) * halfW * scaleAtZ;
    const cardY = (0.9 - e * 1.6) * halfH * scaleAtZ - mid * 0.55 * halfH * scaleAtZ;
    const y = cardY + PIVOT;
    g.position.set(x, y, z);

    // Pendulum: gravity restores, damping settles, the pivot's horizontal
    // acceleration swings it (a real hanging card lags its lanyard), and a
    // faint breeze keeps it alive at rest. Everything is clamped so a scroll
    // jump can never fling it — it should never look like anything but a
    // card hanging from a strap.
    if (!ph.primed) {
      ph.lastX = x;
      ph.lastVx = 0;
      ph.omega = 0;
      ph.theta = 0;
      ph.warm = 0;
      ph.primed = true;
    }
    const vx = (x - ph.lastX) / dt;
    const rawAx = (vx - ph.lastVx) / dt;
    ph.lastX = x;
    ph.lastVx = vx;
    ph.warm = Math.min(1, ph.warm + dt * 2); // no drive for the first half second
    const ax = Math.max(-40, Math.min(40, rawAx)) * ph.warm;
    const L = PIVOT;
    const gravity = 9.8;
    const breeze = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.05 + Math.sin(t * 2.3) * 0.015;
    const alpha = (-gravity * Math.sin(ph.theta) - ax * Math.cos(ph.theta) * 0.3) / L - ph.omega * 1.1 + breeze;
    ph.omega = Math.max(-2.5, Math.min(2.5, ph.omega + alpha * dt));
    ph.theta = Math.max(-0.5, Math.min(0.5, ph.theta + ph.omega * dt));
    pv.rotation.z = ph.theta;
    // A little turn with motion so the card reads as an object.
    pv.rotation.y = (p - 0.5) * 0.7 + Math.max(-0.25, Math.min(0.25, ph.omega * 0.12));
  });

  if (!textures) return null;

  return (
    <group ref={root} visible={false}>
      <group ref={pivot}>
        <group position={[0, -PIVOT, 0]}>
          {/* Strap: from the loop ring up past the pivot and out of frame.
              A plane rotated upright: text reads from the clip upward. */}
          <mesh position={[0, RING_Y + STRAP_L / 2 - 0.02, -0.012]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[STRAP_L, STRAP_W]} />
            <meshStandardMaterial map={textures.strap} roughness={0.85} />
          </mesh>
          {/* Strap folded back through the ring. */}
          <mesh position={[0, RING_Y + 0.08, 0.004]}>
            <boxGeometry args={[STRAP_W, 0.3, 0.024]} />
            <meshStandardMaterial color="#ff8fd0" roughness={0.85} />
          </mesh>
          {/* Loop ring the strap passes through. */}
          <mesh position={[0, RING_Y - 0.06, 0.02]}>
            <torusGeometry args={[0.12, 0.028, 12, 40]} />
            <meshStandardMaterial color="#d9dbe0" metalness={1} roughness={0.28} />
          </mesh>
          {/* Swivel barrel hanging from the ring. */}
          <mesh position={[0, RING_Y - 0.26, 0.02]}>
            <cylinderGeometry args={[0.055, 0.055, 0.16, 20]} />
            <meshStandardMaterial color="#cfd2d8" metalness={1} roughness={0.3} />
          </mesh>
          {/* Hook: down from the barrel through the hole in the card. */}
          <mesh position={[0, (RING_Y - 0.34 + HOLE_Y) / 2, 0.02]}>
            <capsuleGeometry args={[0.04, RING_Y - 0.34 - HOLE_Y, 6, 16]} />
            <meshStandardMaterial color="#cfd2d8" metalness={1} roughness={0.3} />
          </mesh>
          {/* Hook eye sitting in the hole. */}
          <mesh position={[0, HOLE_Y, 0.02]}>
            <torusGeometry args={[0.075, 0.022, 12, 32]} />
            <meshStandardMaterial color="#d9dbe0" metalness={1} roughness={0.28} />
          </mesh>
          {/* Card: rounded slab for edges, painted face on top. */}
          <RoundedBox args={[W, H, D]} radius={0.09} smoothness={6}>
            <meshPhysicalMaterial color="#ffb7e0" roughness={0.35} clearcoat={0.8} />
          </RoundedBox>
          <mesh position={[0, 0, D / 2 + 0.002]}>
            <planeGeometry args={[W, H]} />
            <meshPhysicalMaterial map={textures.face} transparent roughness={0.3} clearcoat={1} clearcoatRoughness={0.15} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
