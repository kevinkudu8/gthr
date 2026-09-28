"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
  Vector4,
  type Group,
  type Texture,
} from "three";
import { ticket } from "@/content/site";
import {
  hash2,
  pageFonts,
  paintPaper,
  type Fonts,
} from "./canvasPaint";
import { scrollState } from "./scrollState";

/*
 * The party face's prop for the statements block: an event ticket that is
 * torn in two as the page scrolls — a holographic stub over a printed body,
 * joined at a perforation. (The business face keeps the lanyard badge.)
 *
 * Each piece is a finely subdivided plane, not an extruded card: the tear has
 * to *bend* the paper, and an extrusion's face is one flat polygon with no
 * vertices inside it to move. So the die-cut outline — rounded outer corners,
 * half-round notches at the perforation, the stub's lanyard slot — is cut
 * in the fragment shader from a signed distance, along with the ragged torn
 * edge, and the curl is a vertex displacement. See `tearMaterial`.
 *
 * World units, before the whole ticket is scaled to the viewport. Each piece's
 * group has its origin on the tear line.
 */
const TW = 1.3;
const TOP_H = 1.36;
const BOT_H = 1.62;
const R = 0.09; // outer corner radius
const TEX_W = 780;
/** Perforation notch radius, at each end of the tear line. */
const NR = 0.055;
/** Perforation hole spacing and radius. */
const PERF = 0.04;
const PERF_R = 0.0085;

type Piece = "stub" | "body";

/**
 * Shader additions shared by both pieces (spliced into the stock materials so
 * they keep their lighting, map and — on the stub — iridescence).
 *
 * `uFront` is the tear's leading point along the perforation, in piece-local x:
 * everything to its right has torn. It runs right to left, the way a hand rips
 * from one notch to the other.
 */
const TEAR_COMMON = /* glsl */ `
  uniform float uFront;
  uniform float uCurl;
  uniform float uEdgeY;
  uniform float uEdgeSign;
  varying vec2 vLocal;
  // How far the paper has lifted toward the viewer at p: only behind the tear
  // front, strongest right at the torn edge and gone ~0.42 in from it, so the
  // torn strip rolls up rather than the whole piece tilting.
  float tearCurl(vec2 p) {
    float inside = uEdgeSign * (p.y - uEdgeY);
    float along = smoothstep(uFront, uFront + 0.4, p.x);
    float reach = 1.0 - clamp(inside / 0.42, 0.0, 1.0);
    // Ticket stock is stiff: it lifts, it does not roll.
    return uCurl * along * reach * reach * 0.2;
  }
`;

const TEAR_FRAGMENT = /* glsl */ `
  uniform float uFront;
  uniform float uEdgeY;
  uniform float uEdgeSign;
  uniform vec2 uHalf;
  uniform vec4 uRadii;
  uniform float uHoles;
  uniform vec3 uBack;
  uniform vec3 uFiber;
  varying vec2 vLocal;
  float tearHash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
  float tearNoise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(tearHash(i), tearHash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
  // Rounded box with a radius per corner (x: top-right, y: bottom-right,
  // z: top-left, w: bottom-left).
  float tearBox(vec2 p, vec2 b, vec4 r) {
    r.xy = (p.x > 0.0) ? r.xy : r.zw;
    r.x = (p.y > 0.0) ? r.x : r.y;
    vec2 q = abs(p) - b + r.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
  }
`;

const TEAR_CUT = /* glsl */ `
  vec2 tp = vLocal;
  float sd = tearBox(tp, uHalf, uRadii);
  sd = max(sd, ${NR.toFixed(3)} - length(tp - vec2(uHalf.x, uEdgeY)));
  sd = max(sd, ${NR.toFixed(3)} - length(tp - vec2(-uHalf.x, uEdgeY)));
  if (uHoles > 0.5) {
    // One lanyard slot, centred near the top edge.
    sd = max(sd, -tearBox(tp - vec2(0.0, uHalf.y - 0.1), vec2(0.11, 0.024), vec4(0.024)));
  }
  // The perforation, and the edge it leaves. Real holes run the whole line —
  // each piece cuts its half of every circle, so before the tear they read as
  // one row of punched holes. Where the tear has passed, the bridges between
  // holes have snapped: each leaves a small nub on one side or the other
  // (complementary, so what one piece keeps the other lost), with a fine
  // fringe. A ticket parts along its perforation; it does not rip freely.
  float perfX = tp.x / ${PERF.toFixed(3)};
  float perfK = floor(perfX + 0.5);
  float perfLimit = uHalf.x - ${NR.toFixed(3)} - 0.015;
  float perfOn = step(abs(perfK * ${PERF.toFixed(3)}), perfLimit);
  float perfHole = length(vec2((perfX - perfK) * ${PERF.toFixed(3)}, tp.y - uEdgeY)) - ${PERF_R.toFixed(4)};
  sd = max(sd, -perfHole * perfOn + (1.0 - perfOn) * -1.0);
  float torn = step(uFront, tp.x);
  float nub = (tearHash(perfK + 3.7) - 0.5) * 0.009 + (tearNoise(tp.x * 420.0) - 0.5) * 0.0025;
  float inside = uEdgeSign * (tp.y - uEdgeY);
  sd = max(sd, (uEdgeSign * nub - inside) * torn + (1.0 - torn) * -1.0);
  float aa = fwidth(sd);
  float tearCover = 1.0 - smoothstep(-aa, aa, sd);
  if (tearCover <= 0.0) discard;
  // A hairline of bare stock where each bridge snapped — on the foil, that
  // white edge is what reads as torn rather than cut.
  float tearFiber = torn * (1.0 - smoothstep(uEdgeSign * nub, uEdgeSign * nub + 0.004, inside));
`;

type TearUniforms = {
  uFront: { value: number };
  uCurl: { value: number };
  [key: string]: { value: unknown };
};

function tearMaterial(piece: Piece, map: Texture) {
  const h = piece === "stub" ? TOP_H : BOT_H;
  const uniforms: TearUniforms = {
    uFront: { value: TW },
    uCurl: { value: 0 },
    uEdgeY: { value: piece === "stub" ? -h / 2 : h / 2 },
    uEdgeSign: { value: piece === "stub" ? 1 : -1 },
    uHalf: { value: new Vector2(TW / 2, h / 2) },
    uRadii: { value: piece === "stub" ? new Vector4(R, 0, R, 0) : new Vector4(0, R, 0, R) },
    uHoles: { value: piece === "stub" ? 1 : 0 },
    uBack: { value: new Color(piece === "stub" ? "#dcd8d0" : "#e6e3dc") },
    uFiber: { value: new Color("#f3efe6") },
  };
  const material =
    piece === "stub"
      ? // Foil: the thin-film sheen shifts over the pearl print as it
        // turns, which is what makes it read as holographic.
        new MeshPhysicalMaterial({
          map,
          roughness: 0.32,
          metalness: 0.15,
          iridescence: 1,
          iridescenceIOR: 1.4,
          iridescenceThicknessRange: [180, 620],
          clearcoat: 0.6,
          clearcoatRoughness: 0.2,
        })
      : new MeshStandardMaterial({ map, roughness: 0.85 });
  material.side = DoubleSide;
  material.transparent = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${TEAR_COMMON}`)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        {
          // Normal from the curl's own slope, so the rolled edge shades.
          float e = 0.01;
          vec2 p = position.xy;
          float dx = (tearCurl(p + vec2(e, 0.0)) - tearCurl(p - vec2(e, 0.0))) / (2.0 * e);
          float dy = (tearCurl(p + vec2(0.0, e)) - tearCurl(p - vec2(0.0, e))) / (2.0 * e);
          objectNormal = normalize(vec3(-dx, -dy, 1.0));
        }`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vLocal = position.xy;
        float lift = tearCurl(position.xy);
        transformed.z += lift;
        // Rolling up draws the edge in a little, as bending paper does.
        transformed.y += uEdgeSign * lift * 0.35;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${TEAR_FRAGMENT}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${TEAR_CUT}`)
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uFiber, tearFiber * 0.85);
        // The back is plain stock, not the art seen through.
        if (!gl_FrontFacing) diffuseColor.rgb = uBack;
        diffuseColor.a *= tearCover;`,
      );
  };
  return { material, uniforms };
}

const INK = "#0b0b0c";

/**
 * Pearl foil: near-white with soft pastel bands running diagonally. It was
 * the thermal ramp's bright middle, the same colours as the ground it floats
 * over, and it disappeared into it; a pale stock stands off the dark field
 * and still reads as holographic once the iridescence moves across it.
 */
const PEARL: readonly [number, string][] = [
  [0, "#e4d9ff"],
  [0.18, "#bdf0da"],
  [0.36, "#f6f3ec"],
  [0.52, "#ffc9da"],
  [0.7, "#d0d5ff"],
  [0.86, "#c3eee8"],
  [1, "#fbe4c8"],
];

function paintPearl(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const band = ctx.createLinearGradient(0, 0, w, h);
  for (const [at, c] of PEARL) band.addColorStop(at, c);
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h);
  // A soft sheen across the title, as light catching foil.
  const sheen = ctx.createRadialGradient(w * 0.62, h * 0.3, 0, w * 0.62, h * 0.3, w * 0.7);
  sheen.addColorStop(0, "rgba(255,255,255,0.55)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const n = (hash2(px, py) - 0.5) * 10;
      const o = (py * w + px) * 4;
      img.data[o] += n;
      img.data[o + 1] += n;
      img.data[o + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  weight: number,
  family: string,
  text: string,
  max: number,
  width: number,
) {
  ctx.font = `${weight} 100px ${family}`;
  const size = Math.min(max, (100 * width) / ctx.measureText(text).width);
  ctx.font = `${weight} ${Math.floor(size)}px ${family}`;
  return size;
}

const MINT_INK = "#04ea98";
const CORAL = "#ff7a45";

/** A four-point sparkle — the mark on the stub. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();
}

/** Dotted leader from x0 to x1 on a baseline. */
function leader(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  for (let x = x0; x < x1; x += 10) ctx.fillRect(x, y - 3, 3, 3);
}

function paintStub(fonts: Fonts) {
  const w = TEX_W;
  const h = Math.round((w * TOP_H) / TW);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  paintPearl(ctx, w, h);
  const c = ticket.stub;
  const pad = 56;
  const right = w - pad - 44; // clear of the edge text
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.textBaseline = "alphabetic";

  // Top row, under the lanyard slot: admit / serial, then a hairline.
  ctx.font = `600 20px ${fonts.mono}`;
  ctx.textAlign = "left";
  ctx.fillText(c.admit.toUpperCase(), pad, 136);
  ctx.textAlign = "right";
  ctx.fillText(c.serial.toUpperCase(), right, 136);
  ctx.fillRect(pad, 154, right - pad, 2);

  // Title set big and flush left, sat on the band like a poster's headline;
  // the foil shows through the open space above it.
  const bandY = h - 150;
  ctx.textAlign = "left";
  ctx.font = `600 24px ${fonts.mono}`;
  ctx.fillText(`${c.tagline.toUpperCase()}  →`, pad, bandY - 30);
  const size = fitFont(ctx, 800, fonts.sans, c.title, 260, right - pad);
  const base = bandY - 84;
  ctx.fillText(c.title, pad - size * 0.04, base);
  sparkle(ctx, right - 30, base - size * 0.72 - 44, 34);

  // A black band along the foot, the label repeated across it.
  ctx.fillRect(0, bandY, w, 58);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, bandY, w, 58);
  ctx.clip();
  ctx.fillStyle = MINT_INK;
  ctx.font = `700 22px ${fonts.mono}`;
  const unit = `${c.label.toUpperCase()}  ✦  `;
  const uw = ctx.measureText(unit).width;
  for (let x = -uw * 0.4; x < w; x += uw) ctx.fillText(unit, x, bandY + 37);
  ctx.restore();

  // Up the right edge.
  ctx.save();
  ctx.translate(w - pad + 6, bandY - 24);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `500 15px ${fonts.mono}`;
  ctx.fillStyle = INK;
  ctx.fillText(c.edge.toUpperCase(), 0, 0);
  ctx.restore();
  return canvas;
}

function paintBody(fonts: Fonts) {
  const w = TEX_W;
  const h = Math.round((w * BOT_H) / TW);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  paintPaper(ctx, w, h, [238, 237, 233]);
  const c = ticket.body;
  const pad = 56;
  const gw = w - pad * 2;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Header band: eyebrow on black, start on the right.
  ctx.fillRect(pad, 48, gw, 52);
  ctx.fillStyle = MINT_INK;
  ctx.font = `700 18px ${fonts.mono}`;
  ctx.fillText(c.eyebrow.toUpperCase(), pad + 20, 81);
  ctx.textAlign = "right";
  ctx.fillText(`${c.startLabel} — ${c.start}`.toUpperCase(), w - pad - 20, 81);
  ctx.textAlign = "left";
  ctx.fillStyle = INK;

  // Headline across the full measure.
  const [l1, l2] = c.headline.map((l) => l.toUpperCase());
  ctx.font = `800 100px ${fonts.sans}`;
  const widest = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width);
  const size = Math.min(58, (100 * gw) / widest);
  ctx.font = `800 ${Math.floor(size)}px ${fonts.sans}`;
  ctx.fillText(l1, pad, 170);
  ctx.fillText(l2, pad, 170 + size * 1.08);

  // Run of show: number, label, dotted leader, a tick box.
  const top = 170 + size * 1.08 + 64;
  const rowH = 70;
  ctx.fillRect(pad, top - 44, gw, 3);
  c.rows.forEach(([label, value], i) => {
    const y = top + i * rowH;
    ctx.font = `800 40px ${fonts.sans}`;
    ctx.fillText(value, pad, y);
    ctx.font = `600 20px ${fonts.mono}`;
    const text = label.toUpperCase();
    ctx.fillText(text, pad + 96, y - 4);
    const end = w - pad - 34;
    leader(ctx, pad + 108 + ctx.measureText(text).width, end - 14, y - 4);
    ctx.lineWidth = 3;
    ctx.strokeRect(end, y - 26, 24, 24);
    if (value !== "0") {
      ctx.beginPath();
      ctx.moveTo(end + 5, y - 14);
      ctx.lineTo(end + 11, y - 8);
      ctx.lineTo(end + 20, y - 22);
      ctx.stroke();
    }
    ctx.fillRect(pad, y + 22, gw, 1);
  });

  // The rubber stamp, tilted across the list.
  const listEnd = top + rowH * c.rows.length;
  ctx.save();
  ctx.translate(w - pad - 118, top + rowH * 2.5);
  ctx.rotate(-0.22);
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = CORAL;
  ctx.fillStyle = CORAL;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 80, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = `800 56px ${fonts.sans}`;
  ctx.fillText(c.stamp[0], 0, 14);
  ctx.font = `700 16px ${fonts.mono}`;
  ctx.fillText(c.stamp[1].toUpperCase(), 0, 46);
  ctx.restore();
  ctx.textAlign = "left";

  // Footer: a QR block, the fine print beside it.
  const fy = listEnd + 20;
  const cell = 9;
  const n = 13;
  const eye = (x: number, y: number) => x < 3 && y < 3 || x > n - 4 && y < 3 || x < 3 && y > n - 4;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (eye(x, y)) continue;
      if (hash2(x + 11, y + 29) < 0.45) ctx.fillRect(pad + x * cell, fy + y * cell, cell, cell);
    }
  }
  for (const [ex, ey] of [[0, 0], [n - 3, 0], [0, n - 3]]) {
    ctx.lineWidth = 5;
    ctx.strokeRect(pad + ex * cell + 2.5, fy + ey * cell + 2.5, cell * 3 - 5, cell * 3 - 5);
  }
  const tx = pad + n * cell + 28;
  ctx.font = `500 14px ${fonts.mono}`;
  c.fine.forEach((line, i) => ctx.fillText(line.toUpperCase(), tx, fy + 22 + i * 24));
  ctx.font = `600 14px ${fonts.mono}`;
  ctx.fillText(c.footer.toUpperCase(), tx, fy + n * cell - 4);
  return canvas;
}

function texture(canvas: HTMLCanvasElement) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * Rises into the middle of the statements block whole, is ripped in two as the
 * second statement slides over — the tear running across the perforation, the
 * halves hinging open about the point still holding, the torn edges curling —
 * then the halves fly apart diagonally to opposite corners and into the
 * distance.
 */
export function Ticket({ reducedMotion }: { reducedMotion: boolean }) {
  const root = useRef<Group>(null);
  const stub = useRef<Group>(null);
  const body = useRef<Group>(null);
  const tilt = useRef({ x: 0, y: 0 });
  const [parts, setParts] = useState<{
    stub: ReturnType<typeof tearMaterial>;
    body: ReturnType<typeof tearMaterial>;
  } | null>(null);
  const { viewport } = useThree();
  // Subdivided so the curl has vertices to move.
  const stubGeo = useMemo(() => new PlaneGeometry(TW, TOP_H, 52, 54), []);
  const bodyGeo = useMemo(() => new PlaneGeometry(TW, BOT_H, 52, 64), []);

  useEffect(() => {
    let alive = true;
    let made: typeof parts = null;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const fonts = pageFonts();
      made = {
        stub: tearMaterial("stub", texture(paintStub(fonts))),
        body: tearMaterial("body", texture(paintBody(fonts))),
      };
      setParts(made);
    });
    return () => {
      alive = false;
      for (const part of [made?.stub, made?.body]) {
        part?.material.map?.dispose();
        part?.material.dispose();
      }
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const g = root.current;
    const top = stub.current;
    const bottom = body.current;
    if (!g || !top || !bottom || !parts) return;
    const { statement: p, thermal, pointer, pointerActive } = scrollState;
    g.visible = thermal > 0.02;
    if (!g.visible) return;
    const t = reducedMotion ? 0 : clock.elapsedTime;

    /* One continuous motion over `statement` 0 → 0.69, never parked: it
       rises in turning, is ripped *while still rising*, and the halves are
       already pulling apart before the rip finishes. The phases overlap on
       purpose — an earlier version rose, stopped in the middle, ripped, then
       left, which read as three separate moves. Services starts to come up
       at ~0.667, and the halves cross the frame edge just before it. */
    const u = Math.min(1, Math.max(0, p / 0.69));
    // Rise: an ease-out onto a slow, constant upward drift, so the velocity
    // never reaches zero.
    const rise = 1 - (1 - Math.min(1, u / 0.55)) ** 3;
    // Centred at the moment of the rip (u ≈ 0.52), still climbing through it.
    const drift = (u - 0.52) * 0.4;
    const tear = smooth((u - 0.4) / 0.24);
    // Ease *in*: the halves separate gently, then accelerate away.
    const exitT = Math.min(1, Math.max(0, (u - 0.5) / 0.5));
    const exit = exitT * exitT;
    if (exit >= 0.999) {
      g.visible = false;
      return;
    }

    const total = TOP_H + BOT_H;
    // 15% up on the first version (0.58 / 0.62 of the viewport).
    const scale = Math.min((viewport.height * 0.667) / total, (viewport.width * 0.713) / TW);
    g.scale.setScalar(scale);
    // Centred on the whole ticket, not on the tear line.
    const centre = ((BOT_H - TOP_H) / 2) * scale;
    g.position.set(0, centre + (rise - 1) * viewport.height * 1.1 + drift * viewport.height, 0.4);

    const k = 1 - Math.exp(-delta * 3);
    const tx = pointerActive && !reducedMotion ? -pointer.y * 0.1 : 0;
    const ty = pointerActive && !reducedMotion ? pointer.x * 0.16 : 0;
    tilt.current.x += (tx - tilt.current.x) * k;
    tilt.current.y += (ty - tilt.current.y) * k;
    // Comes up turned ~15° and unwinds as it rises.
    const spin = 0.26 * (1 - rise);
    g.rotation.set(tilt.current.x, tilt.current.y, spin - 0.04 + Math.sin(t * 0.5) * 0.012);

    // The rip. The front runs right to left along the perforation; each half
    // turns about the point where it is still attached, so a V opens on the
    // torn side, and both fold toward the viewer a little, as if pulled by two
    // hands. The torn strips curl as they come free.
    const front = TW / 2 - tear * TW;
    const open = tear * 0.2;
    // Rotating about (front, 0) instead of the origin: position = P - R(a)P.
    const px = front;
    // Out past opposite corners and far back, in piece-local units (the root
    // is scaled, so world distances are divided by it). Receding widens the
    // frame — at 4 units back it is ~1.7x wider — so the sideways travel has
    // to outrun that for the halves to actually leave rather than shrink to
    // points in the middle.
    const dx = ((viewport.width / 2) * 2.4 * exit) / scale;
    const dy = ((viewport.height / 2) * 2.4 * exit) / scale;
    const deep = (4 * exit) / scale;

    const aTop = open + exit * 0.45;
    top.rotation.set(tear * 0.28 - exit * 0.2, -tear * 0.18 - exit * 0.5, aTop);
    top.position.set(
      px - px * Math.cos(open) - dx,
      -px * Math.sin(open) + tear * 0.05 + dy,
      -deep,
    );
    const aBot = -open - exit * 0.45;
    bottom.rotation.set(tear * 0.28 + exit * 0.2, tear * 0.18 + exit * 0.5, aBot);
    bottom.position.set(
      px - px * Math.cos(open) + dx,
      px * Math.sin(open) - tear * 0.05 - dy,
      -deep,
    );

    for (const part of [parts.stub, parts.body]) {
      part.uniforms.uFront.value = front + (tear >= 1 ? -0.1 : 0.01);
      part.uniforms.uCurl.value = tear * (1 - exit * 0.3);
    }
  });

  if (!parts) return null;
  return (
    <group ref={root} visible={false}>
      {/* Both halves hang off the tear line (y = 0), so that is what they
          turn about as they part. */}
      <group ref={stub}>
        <mesh geometry={stubGeo} material={parts.stub.material} position={[0, TOP_H / 2, 0]} />
      </group>
      <group ref={body}>
        <mesh geometry={bodyGeo} material={parts.body.material} position={[0, -BOT_H / 2, 0]} />
      </group>
    </group>
  );
}
