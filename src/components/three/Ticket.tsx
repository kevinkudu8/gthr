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
  paintThermal,
  type Blob,
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
 * half-round notches at the perforation, the stub's two punched holes — is cut
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
    vec2 hc = vec2(uHalf.x - 0.09, uHalf.y - 0.09);
    sd = max(sd, 0.028 - length(tp - hc));
    sd = max(sd, 0.028 - length(tp - vec2(-hc.x, hc.y)));
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
      ? // Foil: the thin-film sheen shifts over the thermal print as it
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

/** Foil: the bright middle of the thermal ramp — orange through amber to teal. */
const FOIL: Blob[] = [
  [0.5, 0.48, 0.55, 0.3, 0, 0.5, 0.4], // amber glow behind the title
  [0.02, 1.05, 0.34, 0.26, 0.4, 1, 0.5], // teal from the lower left
  [1.02, 0.95, 0.22, 0.2, -0.3, 0.75, 0.3], // and a little lower right
  [0.95, 0.08, 0.3, 0.14, 0.2, 0.3, 0.3], // warm lift top right
];

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

function paintStub(fonts: Fonts) {
  const w = TEX_W;
  const h = Math.round((w * TOP_H) / TW);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  paintThermal(ctx, w, h, FOIL, { lo: 0.4, hi: 0.8, grain: 16 });
  const c = ticket.stub;
  const cx = w / 2;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // The mark: a wide wireframe globe, after the site's old corner globe.
  ctx.lineWidth = 3;
  for (const rx of [48, 30, 12]) {
    ctx.beginPath();
    ctx.ellipse(cx, 92, rx, 24, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 48, 92);
  ctx.lineTo(cx + 48, 92);
  ctx.stroke();

  ctx.font = `600 22px ${fonts.mono}`;
  ctx.fillText(c.kicker.toUpperCase(), cx, 172);

  // Title inside an orbit ring, as on the reference.
  const ty = h * 0.47;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(cx, ty, w * 0.44, 74, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  fitFont(ctx, 800, fonts.sans, c.title, 230, w * 0.62);
  ctx.fillText(c.title, cx, ty + 8);

  fitFont(
    ctx,
    700,
    fonts.sans,
    `+  ${c.tagline.toUpperCase()}  +`,
    34,
    w * 0.78,
  );
  ctx.fillText(`+  ${c.tagline.toUpperCase()}  +`, cx, h * 0.69);

  // Rule and boxed label at the foot of the stub.
  ctx.fillRect(cx - w * 0.16, h * 0.82, w * 0.32, 2);
  ctx.font = `600 20px ${fonts.mono}`;
  const label = c.label.toUpperCase();
  const lw = ctx.measureText(label).width + 28;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - lw / 2, h * 0.87 - 20, lw, 40);
  ctx.fillText(label, cx, h * 0.87 + 1);
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
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";


  // Header: eyebrow, bullet, the hero line as the "venue".
  ctx.font = `500 18px ${fonts.mono}`;
  ctx.fillText(c.eyebrow.toUpperCase(), pad + 40, 72);
  ctx.fillRect(pad, 88, 26, 26);
  // Kept clear of the date block on the right — Syne 800 runs wide.
  const headWidth = w * 0.46;
  const [l1, l2] = c.headline.map((l) => l.toUpperCase());
  ctx.font = `800 100px ${fonts.sans}`;
  const widest = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width);
  const size = Math.min(44, (100 * headWidth) / widest);
  ctx.font = `800 ${Math.floor(size)}px ${fonts.sans}`;
  ctx.fillText(l1, pad + 40, 112);
  ctx.fillText(l2, pad + 40, 112 + size * 1.08);

  // Date block, right, behind a dotted rule.
  ctx.fillStyle = "rgba(11,11,12,0.5)";
  for (let y = 64; y < 250; y += 12) ctx.fillRect(w - pad - 18, y, 4, 4);
  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.font = `800 64px ${fonts.sans}`;
  ctx.fillText(c.date[0], w - pad - 36, 136);
  ctx.fillText(c.date[1], w - pad - 36, 226);
  ctx.textAlign = "left";

  ctx.font = `500 16px ${fonts.mono}`;
  ctx.fillText(c.startLabel.toUpperCase(), pad, 262);
  ctx.font = `800 40px ${fonts.sans}`;
  ctx.fillText(c.start.toUpperCase(), pad + 110, 266);

  // The grid: three rows of two label/value cells.
  const gx = pad;
  const gy = 300;
  const gw = w - pad * 2;
  const rowH = 118;
  ctx.lineWidth = 3;
  ctx.strokeRect(gx, gy, gw, rowH * 3);
  const cellW = gw / 2;
  c.rows.forEach(([label, value], i) => {
    const x = gx + (i % 2) * cellW;
    const y = gy + Math.floor(i / 2) * rowH;
    ctx.font = `500 18px ${fonts.mono}`;
    ctx.fillText(label.toUpperCase(), x + 28, y + rowH / 2 + 6);
    ctx.font = `800 62px ${fonts.sans}`;
    ctx.fillText(value, x + cellW * 0.6, y + rowH / 2 + 22);
  });

  // Fine print, checker strip, barcode, stamp.
  const fy = gy + rowH * 3 + 44;
  ctx.fillRect(pad, fy - 22, gw, 1);
  ctx.font = `500 14px ${fonts.mono}`;
  c.fine.forEach((line, i) =>
    ctx.fillText(line.toUpperCase(), pad, fy + i * 22),
  );
  const cy = fy + 50;
  for (let i = 0; i < 22; i++) {
    for (let j = 0; j < 2; j++)
      if ((i + j) % 2 === 0) ctx.fillRect(pad + i * 12, cy + j * 12, 12, 12);
  }
  const by = cy + 40;
  let bx = pad;
  let n = 0;
  while (bx < pad + 300) {
    const bw = 2 + Math.floor(hash2(n, 7) * 4);
    if (n % 2 === 0) ctx.fillRect(bx, by, bw, 46);
    bx += bw + 1;
    n++;
  }
  const sx = w - pad - 72;
  const sy = cy + 44;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(sx, sy, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 38px ${fonts.sans}`;
  ctx.fillText(c.stamp, sx, sy + 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 14px ${fonts.mono}`;
  ctx.fillText(c.footer.toUpperCase(), pad, h - 40);
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
