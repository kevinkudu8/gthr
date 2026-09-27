"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Path,
  Raycaster,
  Vector2,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type Group,
  type Mesh,
  type Texture,
} from "three";
import { badge } from "@/content/site";
import { hash2, pageFonts, type Fonts } from "./canvasPaint";
import { scrollState } from "./scrollState";

const W = 1.7; // card width, world units
const H = W * 1.4;
const D = 0.05; // solid plastic stock, not a sleeve
const STRAP_W = 0.34;
const STRAP_L = 7;
const CARD_R = 0.11; // corner radius — the card's own outline, so it cannot disagree with the art
const HOLE_Y = H / 2 - 0.15; // punched slot centre, card-local
const SLOT_W = 0.36; // slot punch, width and height
const SLOT_H = 0.085;

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
 * The card: one extruded rounded rectangle with a stadium slot punched
 * through it, which the snap hook's loop threads. The card's outline
 * *is* its geometry, and the face is mapped straight onto its front cap (the
 * cap UVs are the shape's own x/y, so the texture is scaled by 1/W, 1/H and
 * offset by half) — a RoundedBox with a separate textured plane once gave two
 * corner radii that never quite agreed.
 */
function slabGeometry(
  w: number,
  h: number,
  depth: number,
  r: number,
  cy = 0,
  slot?: { y: number; w: number; h: number },
) {
  const x = -w / 2;
  const y = cy - h / 2;
  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  if (slot) {
    // Cut clockwise so the extrusion reads it as a hole.
    const hole = new Path();
    const sw = slot.w / 2 - slot.h / 2;
    hole.moveTo(-sw, slot.y + slot.h / 2);
    hole.absarc(-sw, slot.y, slot.h / 2, Math.PI / 2, (3 * Math.PI) / 2, false);
    hole.lineTo(sw, slot.y - slot.h / 2);
    hole.absarc(sw, slot.y, slot.h / 2, -Math.PI / 2, Math.PI / 2, false);
    hole.lineTo(-sw, slot.y + slot.h / 2);
    shape.holes.push(hole);
  }
  const bevel = Math.min(0.012, depth * 0.3);
  const geometry = new ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 20,
  });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
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

/** Face texture size, and the art panel on it, in texture pixels. */
const FACE_W = 680;
const FACE_H = Math.round(FACE_W * (H / W));
const PANEL = { x: 44, y: 104, w: FACE_W - 88, h: Math.round(FACE_H * 0.56), r: 44 };

/**
 * The art panel's outline on the card's front face, card-local, rounded
 * corners included. The statements invert over it as well as over the strap:
 * the panel is dark, and black type crossing it was hard to read.
 */
const PANEL_OUTLINE: Vector3[] = (() => {
  const toWorld = (px: number, py: number) =>
    new Vector3((px / FACE_W - 0.5) * W, (0.5 - py / FACE_H) * H, D / 2 + 0.001);
  const { x, y, w, h, r } = PANEL;
  const corners: [number, number, number][] = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  return corners.flatMap(([cx, cy, a0]) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = a0 + (i / 5) * (Math.PI / 2);
      return toWorld(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }),
  );
})();

/**
 * The badge face, after the client's lanyard reference: a card of the
 * business face's warm off-white stock, most of it given to a rounded art
 * panel, with the event line and two chips under it. The panel is the brand
 * in a glow — soft black with blurred mint light, the mint as light rather
 * than type — carrying the index pill, the access line and the wordmark.
 * Below: the pass line, name and agency chips, the two info columns, the
 * handle and reference, and the QR block. Copy is `badge` in site.ts.
 */
function paintBusinessBadge(fonts: Fonts, w: number, h: number, ctx: CanvasRenderingContext2D) {
  // The face's tokens, painted by hand because a canvas cannot read CSS.
  // Keep these in step with :root[data-mode="business"] in globals.css.
  const ink = "#141414";
  const paper = "#f4f2ec";
  const mint = "#86dcb2";
  const line = "#dad7cf";
  const muted = "#6b6b66";
  const system = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  const c = badge;
  const pad = 44;

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);

  // The art panel.
  // Starts below the slot punch. Shared with PANEL_OUTLINE.
  const { x: px, y: py, w: pw, h: ph } = PANEL;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, PANEL.r);
  ctx.clip();
  ctx.fillStyle = ink;
  ctx.fillRect(px, py, pw, ph);
  ctx.filter = "blur(70px)";
  const glow = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px + pw * x, py + ph * y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Held mid-dark: the statements turn white where they cross the panel, so
  // no part of it may be pale. (A pale-mint and a paper glow were brighter
  // and left white type unreadable over them.)
  ctx.globalAlpha = 0.72;
  glow(0.3, 0.78, 190, mint);
  ctx.globalAlpha = 0.5;
  glow(0.78, 0.3, 150, mint);
  ctx.globalAlpha = 1;
  glow(0.08, 0.12, 110, "#2f5f4b");
  ctx.filter = "none";
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  // Index pill: mint fill, soft black type (mint is never type on paper).
  ctx.font = `500 17px ${fonts.mono}`;
  const pillW = ctx.measureText(c.index).width + 34;
  ctx.fillStyle = mint;
  ctx.beginPath();
  ctx.roundRect(px + 28, py + 28, pillW, 32, 16);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(c.index, px + 45, py + 50);
  ctx.fillStyle = paper;
  ctx.textAlign = "right";
  ctx.fillText(c.access.toUpperCase(), px + pw - 30, py + 50);
  ctx.textAlign = "left";

  // Wordmark, bottom-left of the panel.
  ctx.font = `600 100px ${system}`;
  ctx.letterSpacing = "-5px";
  const fit = Math.min(1.7, (pw * 0.62) / ctx.measureText(c.mark).width);
  ctx.font = `600 ${Math.floor(100 * fit)}px ${system}`;
  ctx.letterSpacing = `${-5 * fit}px`;
  ctx.fillText(c.mark, px + 26, py + ph - 34);
  ctx.letterSpacing = "0px";

  // The pass line, as the reference sets its event name.
  let y = py + ph + 64;
  ctx.fillStyle = ink;
  ctx.font = `500 38px ${system}`;
  ctx.fillText(c.headline.join(" "), pad + 4, y);

  // Chips: name on a grey pill, the agency on an outlined one.
  y += 30;
  ctx.font = `500 15px ${fonts.mono}`;
  const nameText = c.name.toUpperCase();
  const nw = ctx.measureText(nameText).width + 36;
  ctx.fillStyle = line;
  ctx.beginPath();
  ctx.roundRect(pad, y, nw, 40, 20);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(nameText, pad + 18, y + 26);
  ctx.font = `400 17px ${system}`;
  const agencyText = c.agency.join(" ");
  const aw = ctx.measureText(agencyText).width + 36;
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(pad + nw + 10, y + 1, aw, 38, 19);
  ctx.stroke();
  ctx.fillText(agencyText, pad + nw + 28, y + 26);

  // Two info columns, labels in the mono.
  y += 88;
  c.columns.forEach(([label, ...lines], i) => {
    const x = pad + 4 + i * 210;
    ctx.fillStyle = muted;
    ctx.font = `500 13px ${fonts.mono}`;
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = ink;
    ctx.font = `400 16px ${system}`;
    lines.forEach((l, k) => ctx.fillText(l, x, y + 26 + k * 22));
  });

  // Foot: handle and reference left, QR block right.
  ctx.fillStyle = muted;
  ctx.font = `400 13px ${fonts.mono}`;
  ctx.fillText(`${c.handle}   ${c.reference.join(" ")}`.toUpperCase(), pad + 4, h - pad);

  const cell = 4;
  const n = 23;
  const qx = w - pad - cell * n;
  const qy = h - pad - cell * n + 4;
  const finder = (fx: number, fy: number) =>
    (fx < 7 && fy < 7) || (fx > n - 8 && fy < 7) || (fx < 7 && fy > n - 8);
  const finderBit = (fx: number, fy: number) => {
    const lx = fx > n - 8 ? fx - (n - 7) : fx;
    const ly = fy > n - 8 ? fy - (n - 7) : fy;
    const ring = lx === 0 || ly === 0 || lx === 6 || ly === 6;
    const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return ring || core;
  };
  ctx.fillStyle = ink;
  for (let qy2 = 0; qy2 < n; qy2++) {
    for (let qx2 = 0; qx2 < n; qx2++) {
      const on = finder(qx2, qy2) ? finderBit(qx2, qy2) : hash2(qx2 + 11, qy2 + 29) > 0.52;
      if (on) ctx.fillRect(qx + qx2 * cell, qy + qy2 * cell, cell - 0.5, cell - 0.5);
    }
  }

  // Printed grain over everything, as on the page's own .paper-grain.
  const img = ctx.getImageData(0, 0, w, h);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const g = (hash2(gx, gy) - 0.5) * 7;
      const o = (gy * w + gx) * 4;
      img.data[o] += g;
      img.data[o + 1] += g;
      img.data[o + 2] += g;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** The strap plane's corners, in its own local space (it is rotated upright). */
const STRAP_OUTLINE: Vector3[] = [
  new Vector3(-STRAP_L / 2, -STRAP_W / 2, 0),
  new Vector3(STRAP_L / 2, -STRAP_W / 2, 0),
  new Vector3(STRAP_L / 2, STRAP_W / 2, 0),
  new Vector3(-STRAP_L / 2, STRAP_W / 2, 0),
];

/**
 * Keeps the statement type legible over the dark strap. The statement is
 * black ink on the business face, so where the strap passes behind it the
 * words would vanish; each statement carries a white copy
 * (`.statement-invert`) and this clips that copy to the strap's on-screen
 * outline every frame, so the letters turn white exactly where they cross it.
 *
 * Done by hand because CSS blending cannot reach the canvas: the page scrolls
 * inside a fixed wrapper, which is its own stacking context, so a
 * `mix-blend-mode` on the text only ever sees the transparent wrapper.
 */
function clipStatements(outlines: [number, number][][] | null) {
  document.querySelectorAll<HTMLElement>(".statement-invert").forEach((el) => {
    if (!outlines) {
      el.style.clipPath = "inset(50%)";
      return;
    }
    // path() is in the element's own pixels, so offset from the viewport.
    const r = el.getBoundingClientRect();
    const d = outlines
      .map((pts) =>
        pts.map(([x, y], i) => `${i ? "L" : "M"}${(x - r.left).toFixed(1)} ${(y - r.top).toFixed(1)}`).join(" ") + " Z",
      )
      .join(" ");
    el.style.clipPath = `path("${d}")`;
  });
}

/** The card face, full bleed. */
function paintBadge(fonts: Fonts) {
  const w = FACE_W;
  const h = FACE_H;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  // Full bleed: the card geometry supplies the corners.
  paintBusinessBadge(fonts, w, h, ctx);
  return canvas;
}

/**
 * The strap, with the wordmark repeating along it. Painted horizontally (no canvas
 * rotation) and applied to a plane that is rotated upright in the scene, so
 * the text orientation is decided by the mesh, not by texture conventions.
 */
/** Strap length covered by one repeat of the strap texture, world units. */
const STRAP_TILE = 2.2;

function paintStrap(fonts: Fonts) {
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
  /* Woven tape, the wordmark repeating small in mono with a hairline above
     and below — how a lanyard is actually printed. Soft black tape with mint
     lettering, which is the face's pill label at length; it was deep green
     while the hero was. Mint on black is 8.8:1. */
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(134,220,178,0.3)";
  ctx.fillRect(0, h * 0.2, w, 2);
  ctx.fillRect(0, h * 0.8 - 2, w, 2);
  ctx.fillStyle = "#86dcb2";
  ctx.font = `500 40px ${fonts.mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 4; i++) ctx.fillText("GTHR.", (w / 4) * (i + 0.5), h / 2 + 2);
  return canvas;
}

/** The scene camera: 40° vertical field of view, at z = 6. See Scene.tsx. */
const TAN_HALF_FOV = Math.tan((20 * Math.PI) / 180);
const CAMERA_Z = 6;

/** CSS pixels per world unit at depth `z`. */
function pxPerWorld(z: number, heightPx: number) {
  return heightPx / (2 * TAN_HALF_FOV * (CAMERA_Z - z));
}

/**
 * What the hero badge has to keep clear of, measured from the text itself so
 * a right edge is the last glyph rather than the block's full width: the
 * wordmark's top (in page pixels, not viewport) and the right edge of its
 * letters, and the headline's right edge. Cached per viewport size: they only move when the
 * vw-based type does.
 */
type HeroBoxes = { key: string; markTop: number; markRight: number; headlineRight: number };
let heroCache: HeroBoxes = { key: "", markTop: Infinity, markRight: 0, headlineRight: 0 };
function textBox(selector: string, dropLast = false) {
  const el = document.querySelector(selector);
  if (!el) return null;
  // Text nodes one at a time: a range over the element would take in block
  // children's full boxes (the headline's lines are blocks), and the
  // screen-reader copy is skipped.
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let top = Infinity;
  let right = -Infinity;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(".sr-only")) continue;
    range.selectNodeContents(node);
    if (dropLast && node.textContent) range.setEnd(node, Math.max(0, node.textContent.length - 1));
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
  }
  return right > -Infinity ? { top, right } : null;
}
function heroBoxes(width: number, height: number): HeroBoxes | null {
  const key = `${width}x${height}`;
  if (heroCache.key === key) return heroCache;
  // The wordmark's full stop sits low on the baseline, under where the card
  // hangs, so its right edge is taken at the R.
  const mark = textBox(".hero-poster__mark", true);
  const headline = textBox(".hero-poster__headline");
  if (!mark || !headline) return null;
  heroCache = { key, markTop: mark.top + scrollState.y, markRight: mark.right, headlineRight: headline.right };
  return heroCache;
}

type Swing = { theta: number; omega: number; yaw: number; yawV: number };

/**
 * One step of the pendulum. Gravity restores, damping settles, the pivot's
 * horizontal acceleration `ax` swings it (a real hanging card lags its
 * lanyard), and a faint breeze keeps it alive at rest; `t` is 0 under reduced
 * motion, which stills the breeze. Everything is clamped so a scroll jump can
 * never fling it — it should never look like anything but a card hanging from
 * a strap. `yaw` is the turn about the strap a click kicks in, on a damped
 * spring, and capped short of showing the card's unprinted back.
 */
function swing(ph: Swing, ax: number, dt: number, t: number) {
  const gravity = 9.8;
  const breeze = t ? Math.sin(t * 0.8) * 0.05 + Math.sin(t * 2.3) * 0.015 : 0;
  const alpha = (-gravity * Math.sin(ph.theta) - ax * Math.cos(ph.theta) * 0.3) / PIVOT - ph.omega * 1.1 + breeze;
  ph.omega = Math.max(-2.5, Math.min(2.5, ph.omega + alpha * dt));
  ph.theta = Math.max(-0.5, Math.min(0.5, ph.theta + ph.omega * dt));
  ph.yawV += (-ph.yaw * 18 - ph.yawV * 2.2) * dt;
  ph.yaw = Math.max(-1.1, Math.min(1.1, ph.yaw + ph.yawV * dt));
}

/**
 * The lanyard badge: a solid plastic card on a printed woven strap, hanging
 * from a pivot up the strap as a real pendulum. Two placements:
 *
 * - `statements`: travels from upper left, close past the camera, and out
 *   lower right through the statements block, driven by its own acceleration.
 * - `hero`: hangs still in the business hero's empty right half, the strap
 *   running off the top of the frame, and scrolls away with the page. Desktop
 *   only — on a phone the right half is the headline's.
 *
 * Both swing when the card is clicked. The canvas takes no pointer events (it
 * sits behind the page), so the click is hit-tested from a window listener,
 * as Stickers.tsx does for its drag.
 */
export function Badge({
  reducedMotion,
  placement = "statements",
  mobile = false,
}: {
  reducedMotion: boolean;
  placement?: "statements" | "hero";
  mobile?: boolean;
}) {
  const hero = placement === "hero";
  const root = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const physics = useRef({ theta: 0, omega: 0, yaw: 0, yawV: 0, lastX: 0, lastVx: 0, warm: 0, primed: false });
  const [textures, setTextures] = useState<{ face: Texture; strap: Texture } | null>(null);
  const { viewport, camera, size } = useThree();
  const cardMesh = useRef<Mesh>(null);
  const strapMesh = useRef<Mesh>(null);
  const clipped = useRef(false);
  const scratch = useRef(new Vector3());
  const card = useMemo(() => slabGeometry(W, H, D, CARD_R, 0, { y: HOLE_Y, w: SLOT_W, h: SLOT_H }), []);
  const hook = useMemo(() => hookGeometry(), []);
  const dRing = useMemo(() => dRingGeometry(), []);

  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const fonts = pageFonts();
      const face = new CanvasTexture(paintBadge(fonts));
      face.colorSpace = SRGBColorSpace;
      // Onto the card's front cap, whose UVs are its x/y in world units.
      face.repeat.set(1 / W, 1 / H);
      face.offset.set(0.5, 0.5);
      face.anisotropy = 8;
      const strap = new CanvasTexture(paintStrap(fonts));
      strap.colorSpace = SRGBColorSpace;
      strap.wrapS = strap.wrapT = RepeatWrapping;
      strap.repeat.set(STRAP_L / STRAP_TILE, 1);
      setTextures({ face, strap });
    });
    return () => {
      alive = false;
    };
    // Painted once: the badge is the business face's only — the party face
    // has the torn ticket (Ticket.tsx) in this slot instead.
  }, []);

  // Click to swing. A hit on one side of the card pushes that side back:
  // the pendulum swings away from it and the card turns about its strap.
  // A hit near the middle picks a side, so a click always visibly lands.
  useEffect(() => {
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const onDown = (event: PointerEvent) => {
      const g = root.current;
      const mesh = cardMesh.current;
      if (!g?.visible || !mesh) return;
      ndc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (!hit) return;
      const local = mesh.worldToLocal(hit.point.clone());
      let side = local.x / (W / 2);
      if (Math.abs(side) < 0.2) side = Math.random() < 0.5 ? -0.6 : 0.6;
      const ph = physics.current;
      ph.omega -= side * 2.2;
      ph.yawV += side * 7;
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [camera]);

  useFrame(({ clock }, rawDelta) => {
    const g = root.current;
    const pv = pivot.current;
    if (!g || !pv) return;
    const { statement, thermal } = scrollState;
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;
    const dt = Math.min(0.05, rawDelta);
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const ph = physics.current;

    if (hero) {
      const boxes = heroBoxes(size.width, size.height);
      g.visible = !mobile && scrollState.hero < 1 && !!boxes;
      if (!g.visible || !boxes) return;
      // The strap runs up through the top bar, and the nav's black type
      // vanishes on it, so it hangs in the gap left of the nav links —
      // measured, since that gap moves with the viewport width.
      const navLeft = document.querySelector(".top-bar ul")?.getBoundingClientRect().left ?? size.width;
      const strapPx = Math.min(size.width * 0.7, navLeft - 60);
      // Full size, vertically centred, when that clears the wordmark to its
      // left. Where the nav pins it further left (narrower screens), it would
      // sit behind the wordmark instead, so it shrinks — pushed back from the
      // camera — into the band between the top bar and the wordmark's top.
      let z = 0;
      let centrePx = size.height / 2;
      if (strapPx - (W / 2) * pxPerWorld(0, size.height) < boxes.markRight + 16) {
        const top = 110;
        const bottom = boxes.markTop - 24;
        z = Math.max(-4, CAMERA_Z - size.height / (2 * TAN_HALF_FOV * ((bottom - top) / H)));
        z = Math.min(0, z);
        centrePx = (top + bottom) / 2;
      }
      // Moves up with the page, at its own depth's pixels-per-unit.
      const ppw = pxPerWorld(z, size.height);
      // Too narrow for the gap to hold it clear of the headline (small
      // laptops, tablets): no badge rather than one over the type.
      if (strapPx - (W / 2) * ppw < boxes.headlineRight + 24) {
        g.visible = false;
        return;
      }
      const x = (strapPx - size.width / 2) / ppw;
      const cardY = (size.height / 2 - centrePx + scrollState.y) / ppw;
      g.position.set(x, cardY + PIVOT, z);
      swing(ph, 0, dt, t);
      pv.rotation.z = ph.theta;
      // Turned a touch toward the headline, so it reads as an object.
      pv.rotation.y = -0.22 + ph.yaw;
      return;
    }

    // Remapped so the card's edge reaches the frame at statement ~0.26 — just
    // after the about section's stat cards scroll off (0.23-0.26 across
    // 720-1080p) — and it clears the frame around 0.8, while "Designed to be
    // remembered" is still up. At full speed it left at ~0.62 and the second
    // statement sat alone; entering earlier put it behind the stat cards.
    const p = 0.12 + statement * 0.685;
    // Present early but parked far off-screen left, so it slides in rather
    // than popping into view.
    g.visible = thermal > 0.02;
    if (!g.visible) {
      ph.primed = false;
      if (clipped.current) {
        clipStatements(null);
        clipped.current = false;
      }
      return;
    }
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
    // Held further back than it was (mid * 3.1 - 0.6, nearest z 2.5), so more
    // of the card and strap stay in frame at the closest point.
    const z = mid * 2.2 - 1.0;
    const scaleAtZ = (6 - z) / 6; // the visible half-extent shrinks as it nears the camera
    const x = (-2.3 + e * 4.6) * halfW * scaleAtZ;
    // Enters mid-left, into the space under the about section, not high
    // where it would pass behind the stat cards.
    const cardY = (0.55 - e * 1.25) * halfH * scaleAtZ - mid * 0.55 * halfH * scaleAtZ;
    const y = cardY + PIVOT;
    g.position.set(x, y, z);

    // Pendulum, driven by the pivot's own horizontal acceleration: see swing().
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
    swing(ph, ax, dt, t);
    pv.rotation.z = ph.theta;
    // A little turn with motion so the card reads as an object.
    pv.rotation.y = (p - 0.5) * 0.7 + Math.max(-0.25, Math.min(0.25, ph.omega * 0.12)) + ph.yaw;

    // Project the strap outline to viewport pixels for the statement
    // inversion. The canvas is fixed at the viewport's top left, so its
    // pixels are viewport pixels.
    const sm = strapMesh.current;
    if (sm) {
      g.updateWorldMatrix(true, true);
      const v = scratch.current;
      const toScreen = (mesh: Mesh) => (local: Vector3): [number, number] => {
        v.copy(local);
        mesh.localToWorld(v).project(camera);
        return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
      };
      // The strap and the card's dark art panel; the rest of the card is
      // light, and black type reads on it.
      const card = cardMesh.current;
      clipStatements([
        STRAP_OUTLINE.map(toScreen(sm)),
        ...(card ? [PANEL_OUTLINE.map(toScreen(card))] : []),
      ]);
      clipped.current = true;
    }
  });

  if (!textures) return null;

  return (
    <group ref={root} visible={false}>
      <group ref={pivot}>
        <group position={[0, -PIVOT, 0]}>
          {/* Strap: from the crimp up past the pivot and out of frame.
              A plane rotated upright: text reads from the clip upward. */}
          <mesh ref={strapMesh} position={[0, D_BAR + 0.2 + STRAP_L / 2, -0.012]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[STRAP_L, STRAP_W]} />
            <meshStandardMaterial map={textures.strap} roughness={0.85} />
          </mesh>
          {/* The strap's end, folded round the D-ring's bar and stitched: a
              slightly thicker band with the crimp across its top. */}
          <mesh position={[0, D_BAR + 0.09, 0]}>
            <boxGeometry args={[STRAP_W, 0.24, 0.03]} />
            <meshStandardMaterial color="#141414" roughness={0.85} />
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
          {/* Card: solid plastic stock. Face art on the front cap (group 0),
              plain stock on the edges (group 1). The back cap shares group 0,
              but the swing never turns it to the camera. A little of the face
              as emissive, so the stock lands near the page's own paper
              instead of a lit grey. */}
          <mesh ref={cardMesh} geometry={card}>
            <meshPhysicalMaterial
              attach="material-0"
              map={textures.face}
              emissiveMap={textures.face}
              emissive="#ffffff"
              emissiveIntensity={0.3}
              roughness={0.35}
              clearcoat={0.6}
              clearcoatRoughness={0.2}
            />
            <meshPhysicalMaterial attach="material-1" color="#ecebe6" roughness={0.45} clearcoat={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
