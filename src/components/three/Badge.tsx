"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LinearFilter,
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
import qrcode from "qrcode-generator";
import { badge, socials } from "@/content/site";
import { hash2, pageFonts, type Fonts } from "./canvasPaint";
import { badgeState } from "./badgeState";
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
  // ExtrudeGeometry puts both caps in group 0, the back (z = 0 before the
  // translate) first. The back gets its own group, 2, for its own print: the
  // card turns right round when pressed, and a shared group would show the
  // face art mirrored on the back.
  const caps = geometry.groups[0];
  if (caps && caps.materialIndex === 0) {
    const half = caps.count / 2;
    geometry.clearGroups();
    geometry.addGroup(caps.start, half, 2);
    geometry.addGroup(caps.start + half, half, 0);
    geometry.addGroup(caps.start + caps.count, Infinity, 1);
  }
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
/** Where the face's QR code goes when scanned. */
const TELEGRAM = socials.find((s) => s.id === "telegram")!.href;

const FACE_W = 680;
const FACE_H = Math.round(FACE_W * (H / W));
const PANEL = { x: 44, y: 104, w: FACE_W - 88, h: Math.round(FACE_H * 0.56), r: 44 };

/**
 * The badge face, after the client's lanyard reference: a card of the
 * business face's white stock, most of it given to a rounded art
 * panel, with the event line and two chips under it. The panel is the brand
 * in a glow — soft black with blurred mint light, the mint as light rather
 * than type — carrying the index pill, the access line and the wordmark.
 * Below: the pass line, name and agency chips, the two info columns, the
 * handle and reference, and the QR block. Copy is `badge` in site.ts.
 */
function paintBusinessBadge(fonts: Fonts, w: number, h: number, ctx: CanvasRenderingContext2D, holder: string) {
  // The face's tokens, painted by hand because a canvas cannot read CSS.
  // Keep these in step with :root[data-mode="business"] in globals.css.
  const ink = "#141414";
  const paper = "#ffffff";
  const line = "#e3e3e3";
  const muted = "#6e6e6e";
  const system = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  const c = badge;
  const pad = 44;

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);

  // The art panel.
  // Starts below the slot punch.
  const { x: px, y: py, w: pw, h: ph } = PANEL;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, PANEL.r);
  ctx.clip();
  ctx.fillStyle = ink;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  // The glows and the panel's own type are separate layers, composed over
  // this one by paintBadge, so the glows can drift (paintGlows,
  // paintPanelText).

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // The pass line, as the reference sets its event name — or the visitor's
  // own name once they have put it on the pass (badgeState), shrunk to fit.
  let y = py + ph + 64;
  ctx.fillStyle = ink;
  const passLine = holder || c.headline.join(" ");
  ctx.font = `500 38px ${system}`;
  const passSize = Math.max(22, Math.floor(38 * Math.min(1, (w - pad * 2 - 8) / ctx.measureText(passLine).width)));
  ctx.font = `500 ${passSize}px ${system}`;
  ctx.fillText(passLine, pad + 4, y);

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

  // A real QR code: scanned, it opens GTHR's Telegram (`socials` in
  // site.ts, so it follows the link wherever it changes). Built to be read
  // off a screen, where the card is small: low error correction (a screen
  // never smudges, and fewer modules means bigger ones), solid modules with
  // no gaps between them, as large as the corner allows, and the plain stock
  // all round it as the quiet zone.
  const qr = qrcode(0, "L");
  qr.addData(TELEGRAM);
  qr.make();
  const n = qr.getModuleCount();
  const qrSize = 128;
  const qx = w - pad - qrSize;
  const qy = h - 32 - qrSize;
  const at = (i: number) => Math.round((i * qrSize) / n);
  ctx.fillStyle = ink;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(qx + at(col), qy + at(row), at(col + 1) - at(col), at(row + 1) - at(row));
      }
    }
  }

  grain(ctx, w, h);
}

/**
 * The art panel's type, on its own transparent layer so it sits over the
 * drifting glows: the index pill (mint fill, soft black type — mint is never
 * type on paper) and the wordmark bottom-left.
 */
function paintPanelText(fonts: Fonts, ctx: CanvasRenderingContext2D) {
  const ink = "#141414";
  const paper = "#ffffff";
  const mint = "#86dcb2";
  const system = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  const c = badge;
  const { x: px, y: py, w: pw, h: ph } = PANEL;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `500 17px ${fonts.mono}`;
  const pillW = ctx.measureText(c.index).width + 34;
  ctx.fillStyle = mint;
  ctx.beginPath();
  ctx.roundRect(px + 28, py + 28, pillW, 32, 16);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(c.index, px + 45, py + 50);
  // (The panel's top-right access mark, "ALL-ACCESS" then "AAA", was taken
  // off at the client's request.)
  ctx.fillStyle = paper;

  ctx.font = `600 100px ${system}`;
  ctx.letterSpacing = "-5px";
  const fit = Math.min(1.7, (pw * 0.62) / ctx.measureText(c.mark).width);
  ctx.font = `600 ${Math.floor(100 * fit)}px ${system}`;
  ctx.letterSpacing = `${-5 * fit}px`;
  ctx.fillText(c.mark, px + 26, py + ph - 34);
  ctx.letterSpacing = "0px";
}

/**
 * The glows behind the panel's type, as fractions of the panel: where each
 * sits, its radius, colour and strength, and its drift — a small loop
 * (`ax`, `ay`) taking `period` seconds, each on its own period and phase so
 * the light never visibly repeats. Very slow on purpose: a few pixels a
 * second. Held mid-dark, so the panel reads as one dark field behind the
 * white wordmark rather than a pale wash.
 */
const GLOWS = [
  { x: 0.3, y: 0.78, r: 190, color: "#86dcb2", alpha: 0.72, ax: 0.12, ay: 0.08, period: 95, phase: 0 },
  { x: 0.78, y: 0.3, r: 150, color: "#86dcb2", alpha: 0.5, ax: 0.1, ay: 0.12, period: 120, phase: 2.1 },
  { x: 0.08, y: 0.12, r: 110, color: "#2f5f4b", alpha: 1, ax: 0.08, ay: 0.1, period: 80, phase: 4.2 },
];
const GLOW_BLUR = 70;

/** Complementary error function (Abramowitz-Stegun 7.1.26), for the glows' falloff. */
function erfc(x: number) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
    Math.exp(-z * z);
  return x >= 0 ? y : 2 - y;
}

/** Each glow blurred once into its own canvas; a frame only places them. */
let glowSprites: HTMLCanvasElement[] | null = null;
function glowSprite(i: number) {
  if (!glowSprites) {
    glowSprites = GLOWS.map((g) => {
      const size = Math.ceil((g.r + GLOW_BLUR * 3) * 2);
      const sprite = document.createElement("canvas");
      sprite.width = sprite.height = size;
      const ctx = sprite.getContext("2d");
      if (!ctx) return sprite;
      const c = size / 2;
      ctx.filter = `blur(${GLOW_BLUR}px)`;
      if (ctx.filter === `blur(${GLOW_BLUR}px)`) {
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(c, c, g.r, 0, Math.PI * 2);
        ctx.fill();
        return sprite;
      }
      // No canvas filters (Safari on iPhone drew the glows as hard discs):
      // the same blurred disc as a radial gradient, its falloff the
      // Gaussian's, 0.5 * erfc((d - r) / (blur * sqrt 2)).
      const [cr, cg, cb] = [1, 3, 5].map((k) => parseInt(g.color.slice(k, k + 2), 16));
      const reach = c;
      const ramp = ctx.createRadialGradient(c, c, 0, c, c, reach);
      for (let k = 0; k <= 16; k++) {
        const d = (reach * k) / 16;
        const a = 0.5 * erfc((d - g.r) / (GLOW_BLUR * Math.SQRT2));
        ramp.addColorStop(k / 16, `rgba(${cr}, ${cg}, ${cb}, ${a.toFixed(4)})`);
      }
      ctx.fillStyle = ramp;
      ctx.fillRect(0, 0, size, size);
      return sprite;
    });
  }
  return glowSprites[i];
}

/** The glows at time `t` (seconds), clipped to the panel. At 0 they sit home. */
function paintGlows(ctx: CanvasRenderingContext2D, t: number) {
  const { x: px, y: py, w: pw, h: ph } = PANEL;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, PANEL.r);
  ctx.clip();
  GLOWS.forEach((g, i) => {
    const a = (t / g.period) * Math.PI * 2;
    const dx = g.ax * (Math.sin(a + g.phase) - Math.sin(g.phase));
    const dy = g.ay * (Math.cos(a * 0.77 + g.phase) - Math.cos(g.phase));
    const sprite = glowSprite(i);
    ctx.globalAlpha = g.alpha;
    ctx.drawImage(sprite, px + pw * (g.x + dx) - sprite.width / 2, py + ph * (g.y + dy) - sprite.height / 2);
  });
  ctx.restore();
}

/**
 * The card's back, printed like a real credential's: a black band carrying
 * the access level (the strap's black and mint, so the two read as one
 * object), the zones it opens, ticked, a barcode over the reference number,
 * the return line, and the wordmark small in the corner. Same stock, tokens
 * and grain as the face. Painted the right way round; the texture is
 * mirrored onto the back cap instead (see the texture setup).
 */
function paintBadgeBack(fonts: Fonts) {
  const w = FACE_W;
  const h = FACE_H;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const ink = "#141414";
  const paper = "#ffffff";
  const mint = "#86dcb2";
  const line = "#e3e3e3";
  const muted = "#6e6e6e";
  const system = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  const c = badge.back;
  const pad = 44;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "alphabetic";

  // The band, where the face's art panel starts (below the slot punch).
  const bandY = PANEL.y;
  const bandH = 168;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(pad, bandY, w - pad * 2, bandH, PANEL.r);
  ctx.fill();
  ctx.fillStyle = mint;
  ctx.font = `500 15px ${fonts.mono}`;
  ctx.textAlign = "left";
  ctx.fillText(c.band[0].toUpperCase(), pad + 30, bandY + 46);
  ctx.textAlign = "right";
  ctx.fillText(badge.index, w - pad - 30, bandY + 46);
  ctx.textAlign = "left";
  ctx.fillStyle = paper;
  ctx.font = `600 68px ${system}`;
  ctx.letterSpacing = "-2px";
  ctx.fillText(c.band[1], pad + 26, bandY + bandH - 34);
  ctx.letterSpacing = "0px";

  // Zones: two columns of ticks — all of them, it is an all-access pass.
  let y = bandY + bandH + 58;
  ctx.fillStyle = muted;
  ctx.font = `500 13px ${fonts.mono}`;
  ctx.fillText(c.zonesLabel.toUpperCase(), pad + 4, y);
  y += 22;
  const colW = (w - pad * 2) / 2;
  c.zones.forEach((zone, i) => {
    const zx = pad + 4 + (i % 2) * colW;
    const zy = y + Math.floor(i / 2) * 46;
    ctx.fillStyle = mint;
    ctx.beginPath();
    ctx.arc(zx + 13, zy + 20, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(zx + 7, zy + 20);
    ctx.lineTo(zx + 11.5, zy + 24.5);
    ctx.lineTo(zx + 19.5, zy + 15.5);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `400 21px ${system}`;
    ctx.fillText(zone, zx + 38, zy + 27);
  });
  y += Math.ceil(c.zones.length / 2) * 46 + 18;

  ctx.fillStyle = line;
  ctx.fillRect(pad, y, w - pad * 2, 2);

  // Barcode over the reference number. Bar widths hashed, not random, or
  // it would change on every repaint.
  y += 34;
  const barH = 96;
  ctx.fillStyle = ink;
  let bx = pad + 4;
  let k = 0;
  while (bx < w - pad - 6) {
    const bw = 2 + Math.floor(hash2(k, 7) * 4);
    const gap = 2 + Math.floor(hash2(k, 13) * 3);
    ctx.fillRect(bx, y, bw, barH);
    bx += bw + gap;
    k++;
  }
  y += barH + 30;
  ctx.fillStyle = muted;
  ctx.font = `500 15px ${fonts.mono}`;
  ctx.textAlign = "left";
  ctx.fillText(badge.reference[0].toUpperCase(), pad + 4, y);
  ctx.textAlign = "right";
  ctx.fillStyle = ink;
  ctx.fillText(badge.reference[1], w - pad - 4, y);
  ctx.textAlign = "left";

  // Return line.
  y += 70;
  ctx.fillStyle = muted;
  ctx.font = `500 13px ${fonts.mono}`;
  ctx.fillText(c.returnLabel.toUpperCase(), pad + 4, y);
  ctx.fillStyle = ink;
  ctx.font = `500 28px ${system}`;
  ctx.fillText(c.returnTo, pad + 4, y + 38);

  // Foot: the wordmark, and the terms opposite.
  ctx.fillStyle = ink;
  ctx.font = `600 40px ${system}`;
  ctx.letterSpacing = "-1.5px";
  ctx.fillText(badge.mark, pad + 2, h - pad + 4);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = muted;
  ctx.font = `400 12px ${fonts.mono}`;
  ctx.textAlign = "right";
  ctx.fillText(c.terms.toUpperCase(), w - pad - 4, h - pad);
  ctx.textAlign = "left";

  grain(ctx, w, h);
  return canvas;
}

/** Printed grain over everything, as on the page's own .paper-grain. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number) {
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

/**
 * The card face, full bleed, carrying `holder` (the visitor's name, or "")
 * on its pass line. Repaints into `canvas` when given one, so the texture
 * over it only needs flagging for upload.
 */
function paintBadge(fonts: Fonts, holder: string, canvas = document.createElement("canvas"), t = 0) {
  const w = FACE_W;
  const h = FACE_H;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  // The still layers are painted once per name (the grain pass is far too
  // slow for every frame); a frame is the card, the glows, then the type.
  if (!faceLayers || faceLayers.holder !== holder || faceLayers.fonts !== fonts) {
    const base = document.createElement("canvas");
    const text = document.createElement("canvas");
    base.width = text.width = w;
    base.height = text.height = h;
    const baseCtx = base.getContext("2d");
    const textCtx = text.getContext("2d");
    if (!baseCtx || !textCtx) return canvas;
    // Full bleed: the card geometry supplies the corners.
    paintBusinessBadge(fonts, w, h, baseCtx, holder);
    paintPanelText(fonts, textCtx);
    faceLayers = { holder, fonts, base, text };
  }
  ctx.drawImage(faceLayers.base, 0, 0);
  paintGlows(ctx, t);
  ctx.drawImage(faceLayers.text, 0, 0);
  return canvas;
}

/** The face's still layers, for the name they were painted with. */
let faceLayers: { holder: string; fonts: Fonts; base: HTMLCanvasElement; text: HTMLCanvasElement } | null = null;

/** How often the drifting glows are reprinted, per second. They move a few
 * pixels a second, so this is smooth, and it keeps texture uploads cheap. */
const GLOW_FPS = 12;

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

const smoothstep = (a: number, b: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** CSS pixels per world unit at depth `z`. */
function pxPerWorld(z: number, heightPx: number) {
  return heightPx / (2 * TAN_HALF_FOV * (CAMERA_Z - z));
}

/**
 * What the hero badge has to keep clear of, measured from the text itself so
 * a right edge is the last glyph rather than the block's full width: the
 * wordmark's top (in page pixels, not viewport) and the right edge of its
 * letters, the headline's right edge and bottom, and the right edge of what
 * sits under the headline (the subline, the CTA and the name field). Page
 * pixels for the vertical ones. Cached per viewport size: they only move when
 * the vw-based type does.
 */
type HeroBoxes = {
  key: string;
  markTop: number;
  markRight: number;
  headlineRight: number;
  headlineBottom: number;
  bodyRight: number;
  /** The CTA button: x in viewport pixels, y in page pixels. Phones hang the card from it. */
  cta: { left: number; right: number; top: number; bottom: number } | null;
};
let heroCache: HeroBoxes = {
  key: "",
  markTop: Infinity,
  markRight: 0,
  headlineRight: 0,
  headlineBottom: 0,
  bodyRight: 0,
  cta: null,
};
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
  let bottom = -Infinity;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(".sr-only")) continue;
    range.selectNodeContents(node);
    if (dropLast && node.textContent) range.setEnd(node, Math.max(0, node.textContent.length - 1));
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return right > -Infinity ? { top, right, bottom } : null;
}
function heroBoxes(width: number, height: number): HeroBoxes | null {
  const key = `${width}x${height}`;
  if (heroCache.key === key) return heroCache;
  // The wordmark's full stop sits low on the baseline, under where the card
  // hangs, so its right edge is taken at the R.
  const mark = textBox(".hero-poster__mark", true);
  const headline = textBox(".hero-poster__headline");
  if (!mark || !headline) return null;
  const subline = textBox(".hero-poster__subline");
  const actions = document.querySelector(".hero-poster__actions")?.getBoundingClientRect();
  const cta = document.querySelector(".hero-poster__cta")?.getBoundingClientRect();
  heroCache = {
    key,
    markTop: mark.top + scrollState.y,
    markRight: mark.right,
    headlineRight: headline.right,
    headlineBottom: headline.bottom + scrollState.y,
    bodyRight: Math.max(subline?.right ?? 0, actions?.right ?? 0),
    cta: cta
      ? { left: cta.left, right: cta.right, top: cta.top + scrollState.y, bottom: cta.bottom + scrollState.y }
      : null,
  };
  return heroCache;
}

/** Where the card hangs: the strap's x and the card's centre y in pixels, its depth, and on phones the strap's fade. */
type Placement = {
  strapPx: number;
  z: number;
  centrePx: number;
  fade?: [number, number];
  /** Where it swings from, page pixels: phones only, the CTA's middle. */
  pivotPx?: number;
};

/**
 * Desktop: in the hero's empty right half, the strap in the gap left of the
 * nav links (the nav's black type vanishes on the black strap), measured,
 * since that gap moves with the viewport width.
 */
function deskPlacement(boxes: HeroBoxes, width: number, height: number): Placement | null {
  const navLeft = document.querySelector(".top-bar ul")?.getBoundingClientRect().left ?? width;
  const strapPx = Math.min(width * 0.7, navLeft - 60);
  // Full size, vertically centred, when that clears the wordmark to its
  // left. Where the nav pins it further left (narrower screens), it would
  // sit behind the wordmark instead, so it shrinks — pushed back from the
  // camera — into the band between the top bar and the wordmark's top.
  // Where even that band would put the card over the headline, it hangs
  // lower: the band starts under the headline instead, the card has to
  // clear only the subline and CTA beside it, and just the strap runs up
  // past the headline's end.
  let z = 0;
  let centrePx = height / 2;
  const ppw0 = pxPerWorld(0, height);
  let top = 110;
  let clearRight = boxes.headlineRight;
  if (
    strapPx - (W / 2) * ppw0 < boxes.headlineRight + 24 &&
    strapPx - (STRAP_W / 2) * ppw0 > boxes.headlineRight + 16
  ) {
    top = boxes.headlineBottom + 36;
    clearRight = boxes.bodyRight;
  }
  if (strapPx - (W / 2) * ppw0 < boxes.markRight + 16 || top > 110) {
    const bottom = boxes.markTop - 24;
    z = Math.max(-4, CAMERA_Z - height / (2 * TAN_HALF_FOV * ((bottom - top) / H)));
    z = Math.min(0, z);
    centrePx = (top + bottom) / 2;
  }
  // Too narrow for the gap to hold it clear of the type beside it (small
  // laptops, tablets).
  if (strapPx - (W / 2) * pxPerWorld(z, height) < clearRight + 24) return null;
  return { strapPx, z, centrePx };
}

/**
 * The strap's alpha along its length: a ramp from solid to clear, placed
 * per frame through its offset and repeat (clamped either side), so the
 * phone layout can fade the strap out behind the CTA. Desktop pushes the
 * ramp past the strap's end, leaving it solid.
 */
function makeStrapFade() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  const ramp = ctx.createLinearGradient(0, 0, 256, 0);
  ramp.addColorStop(0, "#fff");
  ramp.addColorStop(1, "#000");
  ctx.fillStyle = ramp;
  ctx.fillRect(0, 0, 256, 1);
  const fade = new CanvasTexture(canvas);
  // Stretched over a few pixels of strap, mipmaps would sample the ramp's
  // average and leave a ghost of the strap above the button.
  fade.generateMipmaps = false;
  fade.minFilter = LinearFilter;
  return fade;
}

/** Card-local height of the strap's lower end, over the clasp. */
const STRAP_FOOT = D_BAR + 0.2;
/** Pixels of strap left showing between the CTA and the clasp, on phones. */
const PHONE_STRAP_PX = 16;
/** The card's widest on phones, as a share of the screen. */
const PHONE_CARD_W = 0.48;

/**
 * Phones: every line of the hero runs near the full width, so a strap up
 * the screen would cross the type. The card hangs instead from the CTA, in
 * the empty stretch between it and the wordmark: centred under the button,
 * the strap running up behind it (the button is solid, so it hides the
 * strap) and fading out there, so nothing shows above it. Sized to the gap,
 * never larger than full size; hidden if the gap is too short (phones held
 * sideways).
 */
function phonePlacement(boxes: HeroBoxes, width: number, height: number): Placement | null {
  const cta = boxes.cta;
  if (!cta) return null;
  const strapPx = (cta.left + cta.right) / 2;
  const reach = STRAP_FOOT - H / 2; // the clasp's height over the card
  const room = boxes.markTop - 24 - cta.bottom - PHONE_STRAP_PX;
  const ppw = Math.min(
    pxPerWorld(0, height),
    room / (H + reach),
    (2 * (Math.min(strapPx, width - strapPx) - 12)) / W,
    // Under the headline in weight: about half the screen wide at most.
    (width * PHONE_CARD_W) / W,
  );
  if (W * ppw < 90) return null;
  const z = CAMERA_Z - height / (2 * TAN_HALF_FOV * ppw);
  // Most of the room left over goes to the strap, so it reads as hanging
  // from the button rather than clipped to it; the rest sits under the card.
  const spare = room - (H + reach) * ppw;
  const centrePx = cta.bottom + PHONE_STRAP_PX + spare * 0.6 + (reach + H / 2) * ppw;
  // From fully there just inside the button's bottom edge to gone just
  // inside its top, in world units up the strap from its foot.
  const up = (px: number) => (centrePx - px) / ppw - STRAP_FOOT;
  // It swings from the button itself: from the pivot up the strap (level
  // with the top bar here), a few presses swung the card up over the CTA.
  return { strapPx, z, centrePx, fade: [up(cta.bottom - 4), up(cta.top + 6)], pivotPx: (cta.top + cta.bottom) / 2 };
}

/**
 * How the card hangs, as three damped springs about the pivot up the strap:
 * `pitch` swings it into and out of the screen, `roll` side to side, and
 * `yaw` twists it about the strap. Each has its angle and angular velocity.
 */
type Swing = { pitch: number; pitchV: number; roll: number; rollV: number; yaw: number; yawV: number };

const GRAVITY = 9.8;
/**
 * The strap's twist stiffness and the damping on each motion. The twist is
 * softer than gravity's pull, so an off-centre press spins it a good way
 * round before the strap winds it back — overshooting a little, the way a
 * lanyard does — and every motion dies away to hanging straight, face-on.
 */
const TWIST = 12;
const SWING_DAMP = 0.95;
const TWIST_DAMP = 1.3;

/**
 * One step. `t` drives a faint breeze on the roll, and is 0 under reduced
 * motion, which stills it.
 */
function swing(ph: Swing, dt: number, t: number, pivot = PIVOT) {
  const breeze = t ? Math.sin(t * 0.8) * 0.05 + Math.sin(t * 2.3) * 0.015 : 0;
  ph.pitchV += ((-GRAVITY * Math.sin(ph.pitch)) / pivot - ph.pitchV * SWING_DAMP) * dt;
  ph.pitch += ph.pitchV * dt;
  ph.rollV += ((-GRAVITY * Math.sin(ph.roll)) / pivot - ph.rollV * SWING_DAMP * 1.6 + breeze) * dt;
  ph.roll += ph.rollV * dt;
  ph.yawV += (-ph.yaw * TWIST - ph.yawV * TWIST_DAMP) * dt;
  ph.yaw += ph.yawV * dt;
}

/**
 * The lanyard badge: a solid plastic card on a printed woven strap, hanging
 * from a pivot up the strap as a real pendulum, in the business hero's empty
 * right half. The strap runs off the top of the frame; scrolling down
 * carries it back and up, off the top-right corner. On phones and tablets
 * (stacked hero) it hangs from the CTA instead — see `phonePlacement`.
 *
 * Pressing it pushes it into the screen at the point pressed, as a finger
 * would: it swings back away from you, further the lower down it is pressed
 * (more leverage about the pivot), and twists on the strap by how far off
 * centre the press was — an edge press spins it most of the way round, a
 * central one barely turns it. Then it swings back and unwinds to where it
 * hung. Only a press moves it; hovering just marks it as clickable. The canvas takes no pointer
 * events (it sits behind the page), so both are hit-tested from window
 * listeners, and the custom cursor is told through `data-badge` on <html>.
 */
export function Badge({
  reducedMotion,
  mobile = false,
  inPage = false,
}: {
  reducedMotion: boolean;
  mobile?: boolean;
  /**
   * Drawn in its own canvas inside the hero (PhoneBadge), which scrolls with
   * the page natively: no scroll to follow and no scroll sway. The fixed
   * canvas tracking the scroll in JS shook against the CTA on phones, whose
   * scrolling runs ahead of the page's frames.
   */
  inPage?: boolean;
}) {
  const root = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const physics = useRef<Swing>({ pitch: 0, pitchV: 0, roll: 0, rollV: 0, yaw: 0, yawV: 0 });
  /** The pivot's last x and its speed, for the lag as scrolling carries it. */
  const travel = useRef({ x: NaN, vx: 0 });
  const [textures, setTextures] = useState<{
    face: Texture;
    back: Texture;
    strap: Texture;
    fade: Texture;
  } | null>(null);
  const { camera, size, gl } = useThree();
  const cardMesh = useRef<Mesh>(null);
  const card = useMemo(() => slabGeometry(W, H, D, CARD_R, 0, { y: HOLE_Y, w: SLOT_W, h: SLOT_H }), []);
  const hook = useMemo(() => hookGeometry(), []);
  const dRing = useMemo(() => dRingGeometry(), []);
  /** Pointer in NDC; `fresh` when it has moved since the last hover test. */
  const input = useRef({ ndc: new Vector2(), fresh: false, over: false });
  /**
   * The face as painted: the fonts it was painted with, which name, when,
   * and the confirmations (stamps) already answered with a spin. Also the
   * last scroll speed, for the sway, and whether the card is on screen.
   */
  const printed = useRef<{
    fonts: Fonts | null;
    face: Texture | null;
    version: number;
    at: number;
    /** When the glows were last reprinted. */
    glowAt: number;
    stamps: number;
    shown: boolean;
  }>({
    fonts: null,
    face: null,
    version: badgeState.version,
    at: 0,
    glowAt: 0,
    stamps: badgeState.stamps,
    shown: false,
  });
  const hoverRay = useMemo(() => new Raycaster(), []);
  /** The pendulum's length: PIVOT, or on phones from the card to the CTA. */
  const pivotLen = useRef(PIVOT);
  const hang = useRef<Group>(null);
  /** The strap's fade ramp, placed each frame (see `makeStrapFade`). */
  const strapFade = useRef<Texture | null>(null);

  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const fonts = pageFonts();
      printed.current.fonts = fonts;
      printed.current.version = badgeState.version;
      const face = new CanvasTexture(paintBadge(fonts, badgeState.name));
      face.colorSpace = SRGBColorSpace;
      // Onto the card's front cap, whose UVs are its x/y in world units.
      face.repeat.set(1 / W, 1 / H);
      face.offset.set(0.5, 0.5);
      face.anisotropy = 8;
      printed.current.face = face;
      // The back cap has the same x/y UVs as the front, so seen from behind
      // it would read mirrored: flipped in u here instead.
      const back = new CanvasTexture(paintBadgeBack(fonts));
      back.colorSpace = SRGBColorSpace;
      back.repeat.set(-1 / W, 1 / H);
      back.offset.set(0.5, 0.5);
      back.anisotropy = 8;
      const strap = new CanvasTexture(paintStrap(fonts));
      strap.colorSpace = SRGBColorSpace;
      strap.wrapS = strap.wrapT = RepeatWrapping;
      strap.repeat.set(STRAP_L / STRAP_TILE, 1);
      const fade = makeStrapFade();
      strapFade.current = fade;
      setTextures({ face, back, strap, fade });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const raycaster = new Raycaster();
    const inp = input.current;
    const html = document.documentElement;
    // Relative to this canvas: the viewport for the fixed one, the hero's
    // box for the in-page one.
    const setNdc = (event: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      inp.ndc.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
      inp.fresh = true;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") setNdc(event);
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // A press on the page's own controls is theirs, never the card's. On
      // the way out the card passes under the top bar (the menu button on
      // phones), and taking the tap there stopped the menu closing.
      const target = event.target as Element | null;
      if (target?.closest?.("a, button, input, textarea, label, .top-bar, .menu-sheet")) return;
      setNdc(event);
      const mesh = cardMesh.current;
      if (!mesh || !root.current?.visible) return;
      raycaster.setFromCamera(inp.ndc, camera);
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (!hit) return;
      // Ours: no text selection starting under the card.
      event.preventDefault();
      // The press point on the card, -1..1 across and from the pivot down.
      const local = mesh.worldToLocal(hit.point.clone());
      const across = Math.max(-1, Math.min(1, local.x / (W / 2)));
      const lever = (pivotLen.current - local.y) / pivotLen.current;
      const ph = physics.current;
      // Into the screen: positive pitch carries the card away from the
      // camera. Presses add to whatever it is already doing, capped so a
      // run of clicks cannot wind it up without limit.
      ph.pitchV = Math.min(1.6, ph.pitchV + 0.75 * lever);
      // The pressed side goes back, so the card turns about the strap that
      // way: positive yaw carries +x into the screen.
      ph.yawV = Math.max(-24, Math.min(24, ph.yawV + across * 16));
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      delete html.dataset.badge;
      delete html.dataset.badgeShown;
    };
  }, [camera, gl]);

  useFrame(({ clock }, rawDelta) => {
    const g = root.current;
    const pv = pivot.current;
    if (!g || !pv) return;
    const dt = Math.min(0.05, rawDelta);
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const ph = physics.current;
    const inp = input.current;
    // Hover only changes the cursor. Tested here rather than on pointermove,
    // so it also follows the card moving under a still pointer.
    const setOver = (over: boolean) => {
      if (over === inp.over) return;
      inp.over = over;
      if (over) document.documentElement.dataset.badge = "hover";
      else delete document.documentElement.dataset.badge;
    };

    // Tells the page whether the card is up, so the field that puts a name
    // on it (BadgeNameField) only shows while there is a card to print on.
    const setShown = (shown: boolean) => {
      if (shown === printed.current.shown) return;
      printed.current.shown = shown;
      if (shown) document.documentElement.dataset.badgeShown = "";
      else delete document.documentElement.dataset.badgeShown;
    };

    const boxes = heroBoxes(size.width, size.height);
    g.visible = scrollState.hero < 1 && !!boxes;
    // `hero < 1` is a scroll state; the field sits at the top of the hero,
    // so it follows the layout only (a card that fits), not the scroll.
    // Phones have no name field (no room beside the CTA).
    if (!boxes || mobile) setShown(false);
    if (!g.visible || !boxes) {
      setOver(false);
      return;
    }
    const place = mobile
      ? phonePlacement(boxes, size.width, size.height)
      : deskPlacement(boxes, size.width, size.height);
    // No room to hang it clear of the type: no badge rather than one over it.
    if (!place) {
      g.visible = false;
      setOver(false);
      setShown(false);
      return;
    }
    const { strapPx, z, centrePx } = place;
    if (!mobile) setShown(true);
    // The strap fades out where the phone layout tucks it behind the CTA;
    // on desktop it runs solid off the top of the frame.
    const fade = strapFade.current;
    if (!fade) {
      // Not painted yet.
    } else if (place.fade) {
      const [s0, s1] = place.fade;
      fade.repeat.x = STRAP_L / (s1 - s0);
      fade.offset.x = -s0 / (s1 - s0);
    } else {
      fade.repeat.x = 1;
      fade.offset.x = -2;
    }

    // A name typed into the hero's field: reprint the face, at most every
    // tenth of a second while typing, with a small tick of movement per
    // change so the card visibly takes it. A confirmed name spins it round,
    // as a new pass being issued.
    const pr = printed.current;
    if (pr.fonts && pr.face && pr.version !== badgeState.version && clock.elapsedTime - pr.at > 0.1) {
      paintBadge(pr.fonts, badgeState.name, pr.face.image as HTMLCanvasElement, t);
      pr.face.needsUpdate = true;
      pr.version = badgeState.version;
      pr.at = clock.elapsedTime;
      ph.pitchV += 0.12;
    }
    // The panel's glows drift, very slowly; reprinted a few times a second
    // while the card is on screen. Still under reduced motion (t is 0).
    if (pr.fonts && pr.face && t && clock.elapsedTime - pr.glowAt > 1 / GLOW_FPS) {
      paintBadge(pr.fonts, badgeState.name, pr.face.image as HTMLCanvasElement, t);
      pr.face.needsUpdate = true;
      pr.glowAt = clock.elapsedTime;
    }
    if (pr.stamps !== badgeState.stamps) {
      pr.stamps = badgeState.stamps;
      ph.yawV = Math.min(24, ph.yawV + 21);
      ph.pitchV += 0.35;
    }
    // Scrolling down carries it away: back into the distance, and up and off
    // the top-right corner, as if the lanyard were being reeled in — gone by
    // 70% of the way through the hero, before "Who are we" comes up. Placed
    // in screen pixels at its own depth, so it leaves the same way at any
    // size. On the way out the strap crosses the nav for a moment; the
    // client preferred this to going straight up, which kept it clear.
    // (Down and off the bottom-right was tried too, and read as it falling
    // off the page.)
    // Phones: no reeling in. The card hangs from the CTA, so it scrolls with
    // the page and stays on the button (client request).
    const leave = mobile ? 0 : smoothstep(0, 0.7, scrollState.hero);
    const zNow = z - leave * 6;
    const ppwNow = pxPerWorld(zNow, size.height);
    const exitX = leave * (size.width - strapPx + W * ppwNow);
    const exitY = inPage ? 0 : mobile ? scrollState.y : leave * (centrePx + H * ppwNow);
    const x = (strapPx + exitX - size.width / 2) / ppwNow;
    const cardY = (size.height / 2 - centrePx + exitY) / ppwNow;
    const L = place.pivotPx !== undefined ? Math.max(1.2, (centrePx - place.pivotPx) / ppwNow) : PIVOT;
    pivotLen.current = L;
    if (hang.current) hang.current.position.y = -L;
    const pivotY = cardY + L;
    g.position.set(x, pivotY, zNow);

    // Being carried sideways swings it: the card lags its pivot, as a badge
    // on a moving lanyard does, and swings back through when it stops.
    if (!reducedMotion) {
      const tr = travel.current;
      const vx = Number.isNaN(tr.x) ? 0 : (x - tr.x) / dt;
      const ax = Number.isNaN(tr.x) ? 0 : Math.max(-30, Math.min(30, (vx - tr.vx) / dt));
      tr.x = x;
      tr.vx = vx;
      ph.rollV -= (ax / L) * 0.5 * dt;
    }

    // Scrolling: the page moves under the badge and it lags, swinging back
    // with the speed and a little to the side. Lenis's velocity is pixels per
    // frame; as screens per second it is about the same at any size.
    if (!reducedMotion && !inPage) {
      const speed = Math.max(-6, Math.min(6, (scrollState.velocity * 60) / size.height));
      ph.pitchV += speed * 0.3 * dt;
      ph.rollV += speed * 0.09 * dt;
    }
    swing(ph, dt, t, L);
    // Phones: held to a modest swing, so presses never carry it up over
    // the button it hangs from.
    if (inPage) {
      const hold = (angle: "pitch" | "roll", vel: "pitchV" | "rollV", lim: number) => {
        if (Math.abs(ph[angle]) <= lim) return;
        ph[angle] = Math.sign(ph[angle]) * lim;
        ph[vel] *= -0.3;
      };
      hold("pitch", "pitchV", 0.45);
      hold("roll", "rollV", 0.25);
    }
    // Twist first, about the strap, then the swing about the pivot: the
    // Euler order applies Y, then Z, then X.
    pv.rotation.order = "XZY";
    pv.rotation.x = ph.pitch;
    pv.rotation.z = ph.roll;
    // Turned a touch toward the headline, so it reads as an object. Face-on
    // in the centred phone layout, where the turn only looked crooked.
    pv.rotation.y = (mobile ? 0 : -0.22) + ph.yaw;

    const mesh = cardMesh.current;
    if (mesh && (inp.fresh || scrollState.velocity !== 0 || Math.abs(ph.yawV) + Math.abs(ph.pitchV) > 0.02)) {
      inp.fresh = false;
      hoverRay.setFromCamera(inp.ndc, camera);
      setOver(hoverRay.intersectObject(mesh, false).length > 0);
    }
  });

  if (!textures) return null;

  return (
    <group ref={root} visible={false}>
      <group ref={pivot}>
        <group ref={hang} position={[0, -PIVOT, 0]}>
          {/* Strap: from the crimp up past the pivot and out of frame.
              A plane rotated upright: text reads from the clip upward. */}
          <mesh position={[0, D_BAR + 0.2 + STRAP_L / 2, -0.012]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[STRAP_L, STRAP_W]} />
            <meshStandardMaterial map={textures.strap} alphaMap={textures.fade} transparent roughness={0.85} />
          </mesh>
          {/* Its other face, turned to look backwards and printed the same
              way up, so the strap is still there when the card twists round
              (a plane only draws its front). */}
          <mesh position={[0, D_BAR + 0.2 + STRAP_L / 2, -0.012]} rotation={[0, Math.PI, Math.PI / 2]}>
            <planeGeometry args={[STRAP_L, STRAP_W]} />
            <meshStandardMaterial map={textures.strap} alphaMap={textures.fade} transparent roughness={0.85} />
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
              plain stock on the edges (group 1), the back's own print on the
              back cap (group 2). A little of the face
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
            <meshPhysicalMaterial
              attach="material-2"
              map={textures.back}
              emissiveMap={textures.back}
              emissive="#ffffff"
              emissiveIntensity={0.3}
              roughness={0.35}
              clearcoat={0.6}
              clearcoatRoughness={0.2}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
