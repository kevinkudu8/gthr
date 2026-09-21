"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Path,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type Group,
  type Texture,
} from "three";
import { useMode } from "@/components/mode/ModeProvider";
import { RAMP } from "./CloudBackdrop";
import { scrollState } from "./scrollState";

const W = 1.7; // badge width, world units
const H = W * 1.4;
const D = 0.05;
const STRAP_W = 0.34;
const STRAP_L = 7;
const CARD_R = 0.11; // corner radius — the card's own outline, so it cannot disagree with the art
const HOLE_Y = H / 2 - 0.15; // punched hole centre, card-local
const HOLE_R = 0.065;

/* The clasp, after the client's reference photo: strap folded round the flat
   bar of a D-ring, a swivel eye and barrel under it, and a snap hook whose
   bottom loop passes through the punched hole. All card-local, y up. */
const HOOK_HALF = 0.07; // half-width of the hook's loop
const HOOK_TUBE = 0.021;
const HOOK_BOTTOM = HOLE_Y + 0.015; // centreline of the loop's lowest point
const HOOK_TOP = HOOK_BOTTOM + 0.36; // where the body meets the barrel
const BARREL_H = 0.09;
const EYE_R = 0.032;
const EYE_Y = HOOK_TOP + BARREL_H + EYE_R * 0.9;
const D_R = 0.12; // D-ring: half-width of the bar, and the radius of its bow
const D_TUBE = 0.017;
const D_BAR = EYE_Y + EYE_R * 0.6 + D_R; // the bar the strap folds round
/** Turn of the hook out of the card's plane, so its loop threads the hole. */
const HOOK_TURN = 0.8;
const PIVOT = H / 2 + 2.6; // pendulum pivot, up the strap

/**
 * The card: one extruded rounded rectangle with the hole punched through it.
 *
 * It used to be a drei RoundedBox with a separate textured plane laid on top,
 * the face art clipped to its own rounded rect — two corner radii that never
 * quite agreed (0.09 on the slab, ~0.11 in the art), so the corners showed the
 * slab's edge through transparent texels. Now the outline is the geometry and
 * the face is mapped straight onto its front cap. The cap UVs are the shape's
 * own x/y (three's world UV generator), so the texture is scaled by 1/W, 1/H
 * and offset by half to land exactly on it. The hole is real, so the ring can
 * pass through it.
 */
function cardGeometry() {
  const x = -W / 2;
  const y = -H / 2;
  const r = CARD_R;
  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + W - r, y);
  shape.quadraticCurveTo(x + W, y, x + W, y + r);
  shape.lineTo(x + W, y + H - r);
  shape.quadraticCurveTo(x + W, y + H, x + W - r, y + H);
  shape.lineTo(x + r, y + H);
  shape.quadraticCurveTo(x, y + H, x, y + H - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const hole = new Path();
  hole.absarc(0, HOLE_Y, HOLE_R, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const bevel = 0.008;
  const geometry = new ExtrudeGeometry(shape, {
    depth: D - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -(D - bevel * 2) / 2);
  return geometry;
}

/**
 * The snap hook as one closed loop: down the spine, round the bottom that
 * threads the hole, and back up the gate side to meet the spine under the
 * barrel. It used to be an open J with a separate gate rod, which from behind
 * read as a broken hook; the loop is the same tube all the way round now. It
 * lies in the hook's own plane, turned HOOK_TURN off the card, so one side runs
 * in front of the card, the other behind, and only the bottom of the loop
 * crosses the card's plane — inside the hole.
 */
function hookGeometry() {
  const pts: Vector3[] = [];
  const b = HOOK_BOTTOM;
  const r = HOOK_HALF;
  // Top, under the barrel, then down the spine (left)...
  pts.push(new Vector3(0, HOOK_TOP, 0), new Vector3(-r * 0.6, HOOK_TOP - 0.035, 0));
  pts.push(new Vector3(-r, HOOK_TOP - 0.11, 0), new Vector3(-r, b + r + 0.06, 0));
  // ...round the bottom...
  for (let i = 1; i < 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    pts.push(new Vector3(r * Math.cos(a), b + r + r * Math.sin(a), 0));
  }
  // ...and back up the gate side (right) to the top.
  pts.push(new Vector3(r, b + r + 0.06, 0), new Vector3(r, HOOK_TOP - 0.11, 0));
  pts.push(new Vector3(r * 0.6, HOOK_TOP - 0.035, 0));
  const curve = new CatmullRomCurve3(pts, true, "centripetal");
  return new TubeGeometry(curve, 128, HOOK_TUBE, 12, true);
}

/** The D-ring: a straight bar across the top and a round bow below it. */
function dRingGeometry() {
  const pts: Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI; // 0 -> PI: right end of the bar, round the bow, left end
    pts.push(new Vector3(D_R * Math.cos(a), D_BAR - D_R * Math.sin(a), 0));
  }
  for (let i = 1; i < 8; i++) pts.push(new Vector3(-D_R + (2 * D_R * i) / 8, D_BAR, 0));
  const curve = new CatmullRomCurve3(pts, true, "centripetal");
  return new TubeGeometry(curve, 96, D_TUBE, 10, true);
}

/** Fonts as the page loaded them (next/font hashes the family names). */
function pageFonts() {
  const sans = getComputedStyle(document.body).fontFamily;
  const mono = getComputedStyle(document.querySelector("time") ?? document.body).fontFamily;
  return { sans, mono };
}

/**
 * The business face's badge: a credential, not a party pass. Card stock, a
 * black header with the wordmark reversed out, mono credential rows, hairline
 * rules and a data-matrix block — the language of an access pass at a
 * technology conference. Placeholder artwork until the client's own lands.
 */
function paintBusinessBadge(fonts: { sans: string; mono: string }, w: number, h: number, ctx: CanvasRenderingContext2D) {
  const ink = "#0a0a0a";
  ctx.fillStyle = "#f4f4f3";
  ctx.fillRect(0, 0, w, h);

  // Header bar, wordmark knocked out of it.
  const headerH = h * 0.2;
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, w, headerH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.round(headerH * 0.46)}px ${fonts.sans}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("GTHR.", 44, headerH / 2 + 2);
  ctx.font = `500 ${Math.round(headerH * 0.2)}px ${fonts.mono}`;
  ctx.textAlign = "right";
  ctx.fillText("EVENT OPS", w - 44, headerH / 2 + 2);

  // Credential rows — label over value, the way a real pass is set.
  const rows: [string, string][] = [
    ["CREDENTIAL", "FULL ACCESS"],
    ["HOLDER", "—"],
    ["ISSUED", "2026"],
  ];
  let y = headerH + 54;
  ctx.textAlign = "left";
  for (const [label, value] of rows) {
    ctx.fillStyle = "rgba(10,10,10,0.45)";
    ctx.font = `500 17px ${fonts.mono}`;
    ctx.fillText(label, 44, y);
    ctx.fillStyle = ink;
    ctx.font = `600 34px ${fonts.sans}`;
    ctx.fillText(value, 44, y + 38);
    ctx.fillStyle = "rgba(10,10,10,0.14)";
    ctx.fillRect(44, y + 62, w - 88, 1);
    y += 96;
  }

  // Data-matrix block, bottom right. Deterministic so it does not shimmer
  // between repaints — a hash of the cell index, not Math.random().
  const cell = 11;
  const grid = 11;
  const mx = w - 44 - cell * grid;
  const my = h - 56 - cell * grid;
  ctx.fillStyle = ink;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const corner = (gx < 3 && gy < 3) || (gx > grid - 4 && gy < 3) || (gx < 3 && gy > grid - 4);
      const bit = corner ? (gx === 1 && gy === 1) || gx === 0 || gy === 0 || gx === 2 || gy === 2 : ((gx * 7 + gy * 13 + gx * gy * 3) % 5) < 2;
      if (bit) ctx.fillRect(mx + gx * cell, my + gy * cell, cell - 2, cell - 2);
    }
  }

  // Serial, bottom left.
  ctx.fillStyle = "rgba(10,10,10,0.55)";
  ctx.font = `500 19px ${fonts.mono}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("NO. 0001", 44, h - 52);
  ctx.fillStyle = "rgba(10,10,10,0.3)";
  ctx.font = `500 15px ${fonts.mono}`;
  ctx.fillText("GTHR.COM", 44, h - 28);
}

/** `RAMP` as numbers, for sampling on the CPU. */
const RAMP_RGB = RAMP.map(([at, hex]) => [
  at,
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
]);

function rampAt(h: number): [number, number, number] {
  for (let i = 1; i < RAMP_RGB.length; i++) {
    const [b, br, bg, bb] = RAMP_RGB[i];
    if (h <= b || i === RAMP_RGB.length - 1) {
      const [a, ar, ag, ab] = RAMP_RGB[i - 1];
      const k = Math.min(1, Math.max(0, (h - a) / (b - a)));
      return [ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k];
    }
  }
  return [0, 0, 0];
}

/** Card-space blobs, same profile as the backdrop: x, y, rx, ry, angle, amp, core. */
const BADGE_BLOBS = [
  [0.32, 1.0, 0.5, 0.3, 0.2, 1, 1.15], // the mass, rising from the bottom
  [1.0, 0.27, 0.45, 0.1, 0.25, 0.55, 0.5], // tongue in from the right
  [0.24, 0.28, 0.05, 0.1, -0.3, 0.5, 0.3], // small flame
  [0.78, 0.44, 0.3, 0.045, 0.3, -0.7, 0.9], // dark wedge
];

/**
 * The party face's badge: a piece of the page's own ground. The card is
 * painted from the backdrop's thermal ramp and blob profile, with film grain,
 * so it reads as cut from the same stuff the site is set on — the pastel pink
 * pass it replaced belonged to the old, light party face. White Syne and mono
 * over it, as on the page.
 */
function paintPartyBadge(fonts: { sans: string; mono: string }, w: number, h: number, ctx: CanvasRenderingContext2D) {
  const img = ctx.createImageData(w, h);
  const blobs = BADGE_BLOBS.map(([x, y, rx, ry, a, amp, core]) => ({
    x, y, irx: 1 / rx, iry: 1 / ry, c: Math.cos(a), s: Math.sin(a), amp, core,
  }));
  const aspect = h / w;
  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      let heat = 0;
      for (const b of blobs) {
        const dx = u - b.x;
        const dy = (v - b.y) * aspect;
        const bu = (b.c * dx + b.s * dy) * b.irx;
        const bv = (-b.s * dx + b.c * dy) * b.iry;
        const r = Math.max(Math.hypot(bu, bv) - b.core, 0);
        heat += b.amp * Math.exp(-r * r);
      }
      const [r, g, bl] = rampAt(Math.min(1, Math.max(0, heat)));
      // Grain: an integer hash, so the card is identical on every repaint.
      let n = Math.imul(px * 374761393 + py * 668265263, 1274126177);
      n = ((n ^ (n >>> 13)) >>> 0) / 4294967296;
      const grain = (n - 0.5) * 22;
      const o = (py * w + px) * 4;
      img.data[o] = r + grain;
      img.data[o + 1] = g + grain;
      img.data[o + 2] = bl + grain;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const white = "#ffffff";
  const soft = "rgba(255,255,255,0.62)";
  const pad = 44;

  // Header row either side of the hole.
  ctx.fillStyle = white;
  ctx.font = `500 21px ${fonts.mono}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("ALL ACCESS", pad, 66);
  ctx.textAlign = "right";
  ctx.fillText("#GTHR26", w - pad, 66);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(pad, 104, w - pad * 2, 1);

  // The wordmark, set large across the card on the dark core of the mass.
  ctx.fillStyle = white;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // Sized to the card's inner width rather than a fixed size — Syne 800 caps
  // run wide, and at 186px the word ran off both edges.
  ctx.font = `800 100px ${fonts.sans}`;
  const fit = Math.min(170, (100 * (w - pad * 2.4)) / ctx.measureText("GTHR").width);
  ctx.font = `800 ${Math.floor(fit)}px ${fonts.sans}`;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24;
  ctx.fillText("GTHR", w / 2, h * 0.7);
  ctx.shadowBlur = 0;

  // Pass rows and footer.
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(pad, h * 0.76, w - pad * 2, 1);
  ctx.textAlign = "left";
  ctx.fillStyle = soft;
  ctx.font = `500 17px ${fonts.mono}`;
  ctx.fillText("PASS", pad, h * 0.76 + 44);
  ctx.textAlign = "right";
  ctx.fillText("NO. 0026", w - pad, h * 0.76 + 44);
  ctx.fillStyle = white;
  ctx.font = `700 34px ${fonts.sans}`;
  ctx.textAlign = "left";
  ctx.fillText("PARTY", pad, h * 0.76 + 88);
  ctx.textAlign = "right";
  ctx.fillText("2026", w - pad, h * 0.76 + 88);
  ctx.fillStyle = soft;
  ctx.font = `500 15px ${fonts.mono}`;
  ctx.textAlign = "center";
  ctx.fillText("GTHR.COM", w / 2, h - 34);
}

/** The badge face for either mode, full bleed. */
function paintBadge(fonts: { sans: string; mono: string }, business = false) {
  const w = 680;
  const h = Math.round(w * (H / W));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  // Full bleed: the card geometry supplies the corners and the hole.
  if (business) paintBusinessBadge(fonts, w, h, ctx);
  else paintPartyBadge(fonts, w, h, ctx);
  return canvas;
}

/**
 * The strap, with the wordmark repeating along it. Painted horizontally (no canvas
 * rotation) and applied to a plane that is rotated upright in the scene, so
 * the text orientation is decided by the mesh, not by texture conventions.
 */
/** Strap length covered by one repeat of the strap texture, world units. */
const STRAP_TILE = 2.2;

function paintStrap(fonts: { sans: string; mono: string }, business = false) {
  // Same proportions as the strip of strap one tile covers, so the lettering
  // is not squashed. It used to be 1600 x 160 on a 2.2 x 0.34 tile, which
  // compressed the type to ~65% of its width.
  const h = 160;
  const w = Math.round((h * STRAP_TILE) / STRAP_W);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  if (business) {
    // Woven black tape, the wordmark repeating small in mono with a hairline
    // above and below — how a conference lanyard is actually printed.
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(0, h * 0.2, w, 2);
    ctx.fillRect(0, h * 0.8 - 2, w, 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `500 40px ${fonts.mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 4; i++) ctx.fillText("GTHR.", (w / 4) * (i + 0.5), h / 2 + 2);
    return canvas;
  }
  // Party: black tape, the wordmark repeating in the thermal ramp's hot end,
  // orange hairlines along both edges.
  ctx.fillStyle = "#07090c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fb4811";
  ctx.fillRect(0, h * 0.14, w, 3);
  ctx.fillRect(0, h * 0.86 - 3, w, 3);
  // Two labels per tile, each sized to leave a clear gap in its slot — at a
  // fixed 80px they ran wider than the slot and into each other.
  const slot = w / 2;
  ctx.font = `800 100px ${fonts.sans}`;
  const fit = Math.min(76, (100 * slot * 0.72) / ctx.measureText("GTHR 26").width);
  ctx.font = `800 ${Math.floor(fit)}px ${fonts.sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const half = ctx.measureText("GTHR 26").width / 2;
  for (let x = 0; x < w; x += slot) {
    const g = ctx.createLinearGradient(x + slot / 2 - half, 0, x + slot / 2 + half, 0);
    g.addColorStop(0, "#e8180c");
    g.addColorStop(0.45, "#f76f1c");
    g.addColorStop(0.75, "#de8330");
    g.addColorStop(1, "#317068");
    ctx.fillStyle = g;
    ctx.fillText("GTHR 26", x + slot / 2, h / 2 + 4);
  }
  return canvas;
}

/**
 * One big lanyard badge for the statements block. Travels from upper left,
 * close past the camera, and out lower right on scroll; hangs from a pivot
 * up the strap as a real pendulum, driven by its own acceleration.
 */
export function Badge({ reducedMotion }: { reducedMotion: boolean }) {
  // `useMode` is a module store, so it reads correctly from inside the Canvas.
  const business = useMode().mode === "business";
  const root = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const physics = useRef({ theta: 0, omega: 0, lastX: 0, lastVx: 0, warm: 0, primed: false });
  const [textures, setTextures] = useState<{ face: Texture; strap: Texture } | null>(null);
  const { viewport } = useThree();
  const card = useMemo(() => cardGeometry(), []);
  const hook = useMemo(() => hookGeometry(), []);
  const dRing = useMemo(() => dRingGeometry(), []);

  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const fonts = pageFonts();
      const face = new CanvasTexture(paintBadge(fonts, business));
      face.colorSpace = SRGBColorSpace;
      // Onto the card's front cap, whose UVs are its x/y in world units.
      face.repeat.set(1 / W, 1 / H);
      face.offset.set(0.5, 0.5);
      face.anisotropy = 8;
      const strap = new CanvasTexture(paintStrap(fonts, business));
      strap.colorSpace = SRGBColorSpace;
      strap.wrapS = strap.wrapT = RepeatWrapping;
      strap.repeat.set(STRAP_L / STRAP_TILE, 1);
      setTextures({ face, strap });
    });
    return () => {
      alive = false;
    };
    // Repainted when the face changes: both textures are baked, so the badge
    // has to be redrawn rather than recoloured.
  }, [business]);

  useFrame(({ clock }, rawDelta) => {
    const g = root.current;
    const pv = pivot.current;
    if (!g || !pv) return;
    const { statement: p, thermal } = scrollState;
    const ph = physics.current;
    // Present early but parked far off-screen left, so it slides in rather
    // than popping into view. The polaroids above have faded by the
    // time its leading edge reaches the frame.
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
          {/* Strap: from the crimp up past the pivot and out of frame.
              A plane rotated upright: text reads from the clip upward. */}
          <mesh position={[0, D_BAR + 0.2 + STRAP_L / 2, -0.012]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[STRAP_L, STRAP_W]} />
            <meshStandardMaterial map={textures.strap} roughness={0.85} />
          </mesh>
          {/* The strap's end, folded round the D-ring's bar and stitched: a
              slightly thicker band with the crimp across its top. */}
          <mesh position={[0, D_BAR + 0.09, 0]}>
            <boxGeometry args={[STRAP_W, 0.24, 0.03]} />
            <meshStandardMaterial color={business ? "#141414" : "#07090c"} roughness={0.85} />
          </mesh>
          <mesh position={[0, D_BAR + 0.2, 0]}>
            <boxGeometry args={[STRAP_W + 0.02, 0.05, 0.04]} />
            <meshStandardMaterial color="#1b1c20" metalness={0.85} roughness={0.32} />
          </mesh>
          {/* Black hardware on both faces, as in the reference. */}
          <mesh geometry={dRing}><meshStandardMaterial color="#1b1c20" metalness={0.85} roughness={0.32} /></mesh>
          {/* Swivel: an eye hung through the D-ring's bow (turned across it,
              so the two interlock), then the barrel down to the hook. */}
          <mesh position={[0, EYE_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[EYE_R, 0.012, 10, 28]} />
            <meshStandardMaterial color="#1b1c20" metalness={0.85} roughness={0.32} />
          </mesh>
          <mesh position={[0, HOOK_TOP + BARREL_H / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.036, BARREL_H, 20]} />
            <meshStandardMaterial color="#1b1c20" metalness={0.85} roughness={0.32} />
          </mesh>
          {/* Snap hook, turned out of the card's plane so its loop threads
              the hole. */}
          <group rotation={[0, HOOK_TURN, 0]}>
            <mesh geometry={hook}>
              <meshStandardMaterial color="#1b1c20" metalness={0.85} roughness={0.32} />
            </mesh>
          </group>
          {/* Card: face art on the front cap (group 0), plain stock on the
              sides (group 1). The back cap shares group 0, but the swing never
              turns it to the camera. */}
          <mesh geometry={card}>
            <meshPhysicalMaterial
              attach="material-0"
              map={textures.face}
              roughness={0.3}
              clearcoat={1}
              clearcoatRoughness={0.15}
            />
            <meshPhysicalMaterial
              attach="material-1"
              color={business ? "#e8e8e6" : "#0b0d10"}
              roughness={business ? 0.5 : 0.35}
              clearcoat={business ? 0.25 : 0.8}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
