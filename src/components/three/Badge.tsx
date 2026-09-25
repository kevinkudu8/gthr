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
  type Mesh,
  type Texture,
} from "three";
import { badge } from "@/content/site";
import { hash2, pageFonts, type Fonts } from "./canvasPaint";
import { scrollState } from "./scrollState";

const W = 1.7; // badge width, world units
const H = W * 1.4;
const D = 0.05;
const STRAP_W = 0.34;
const STRAP_L = 7;
const CARD_R = 0.11; // corner radius — the card's own outline, so it cannot disagree with the art
const HOLE_Y = H / 2 - 0.15; // punched hole centre, card-local
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
  // A slot punch, as on a real ID card: a stadium, cut clockwise so the
  // extrusion reads it as a hole.
  const hole = new Path();
  const sw = SLOT_W / 2 - SLOT_H / 2;
  hole.moveTo(-sw, HOLE_Y + SLOT_H / 2);
  hole.absarc(-sw, HOLE_Y, SLOT_H / 2, Math.PI / 2, (3 * Math.PI) / 2, false);
  hole.lineTo(sw, HOLE_Y - SLOT_H / 2);
  hole.absarc(sw, HOLE_Y, SLOT_H / 2, -Math.PI / 2, Math.PI / 2, false);
  hole.lineTo(-sw, HOLE_Y + SLOT_H / 2);
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

/**
 * The badge face: the business hero's poster in miniature (after the client's
 * reference), keeping the old ID card's working parts — and now on the
 * business face's own stock: warm off-white with a printed grain (it was the
 * hero's green gradient in miniature until that gradient went), the pass line
 * in soft black top-left, a `01\\ | label | text` row, a rule, handle and name, the
 * QR block and reference lines, and the wordmark large along the bottom.
 * Copy is `badge` in site.ts.
 */
function paintBusinessBadge(fonts: Fonts, w: number, h: number, ctx: CanvasRenderingContext2D) {
  /* Ground: the face's warm off-white stock, with the same fine grain as
     before. It used to be the hero's gradient in miniature — a ramp of stops
     plus a glow, kept in step with CloudBackdrop's businessRoom — and went
     flat when that gradient did. The grain stays: it is what keeps a printed
     card from reading as a filled rectangle, and it is the same idea as the
     page's own .paper-grain. */
  const img = ctx.createImageData(w, h);
  const stock = [244, 242, 236];
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const n = (hash2(px, py) - 0.5) * 6;
      const o = (py * w + px) * 4;
      img.data[o] = stock[0] + n;
      img.data[o + 1] = stock[1] + n;
      img.data[o + 2] = stock[2] + n;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const system = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  // The face's tokens, painted by hand because a canvas cannot read CSS.
  // Keep these in step with :root[data-mode="business"] in globals.css.
  const ink = "#141414";
  const mint = "#86dcb2";
  const pad = 56;
  const c = badge;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  /* The pass line. It was thin white caps, which needed the green behind it;
     on off-white stock it is soft black, and set at the weight the page's own
     headline now uses rather than as a hairline. */
  ctx.fillStyle = ink;
  ctx.font = `500 44px ${system}`;
  ctx.letterSpacing = "0px";
  c.headline.forEach((line, i) => ctx.fillText(line, pad, 196 + i * 54));

  /* The middle row: index, label, text. The index is a black pill with mint
     type — the packaging label the face borrows, and the one place the mint
     is set as type, which is why it is on black rather than on the stock. */
  const rowY = 470;
  ctx.font = `500 17px ${fonts.mono}`;
  const pillW = ctx.measureText(c.index).width + 34;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(pad, rowY - 21, pillW, 31, 15.5);
  ctx.fill();
  ctx.fillStyle = mint;
  ctx.fillText(c.index, pad + 17, rowY);

  ctx.fillStyle = ink;
  ctx.font = `400 19px ${system}`;
  ctx.fillText(c.columns[0][0].toUpperCase(), pad + (w - pad * 2) * 0.24, rowY);
  const tx = pad + (w - pad * 2) * 0.56;
  ctx.font = `400 17px ${system}`;
  [...c.columns[0].slice(1), "", ...c.columns[1].slice(1)].forEach((line, i) => {
    if (line) ctx.fillText(line, tx, rowY + i * 24);
  });

  // The rule, on the face's one hairline colour.
  ctx.fillStyle = "#dad7cf";
  ctx.fillRect(pad, 592, w - pad * 2, 1.5);
  ctx.fillStyle = ink;
  ctx.font = `400 15px ${fonts.mono}`;
  ctx.fillText(c.handle.toUpperCase(), pad, 632);
  ctx.font = `500 40px ${system}`;
  ctx.fillText(c.name, pad, 680);

  // QR block: three finder squares and hashed modules, so it is identical on
  // every repaint.
  const cell = 4;
  const n = 25;
  const qx = w - pad - cell * n;
  const qy = 604;
  const finder = (fx: number, fy: number) =>
    (fx < 7 && fy < 7) || (fx > n - 8 && fy < 7) || (fx < 7 && fy > n - 8);
  const finderBit = (fx: number, fy: number) => {
    const lx = fx > n - 8 ? fx - (n - 7) : fx;
    const ly = fy > n - 8 ? fy - (n - 7) : fy;
    const ring = lx === 0 || ly === 0 || lx === 6 || ly === 6;
    const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return ring || core;
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const on = finder(x, y) ? finderBit(x, y) : hash2(x + 11, y + 29) > 0.52;
      if (on) ctx.fillRect(qx + x * cell, qy + y * cell, cell - 0.5, cell - 0.5);
    }
  }
  ctx.font = `400 13px ${fonts.mono}`;
  ctx.fillStyle = "rgba(20,20,20,0.62)";
  ctx.fillText(c.reference.join(" ").toUpperCase(), pad, 730);

  // The wordmark, as large as the card allows, along the bottom.
  ctx.fillStyle = ink;
  ctx.font = `600 100px ${system}`;
  ctx.letterSpacing = "-5px";
  const fit = (w - pad * 2 + 8) / ctx.measureText(c.mark).width;
  ctx.font = `600 ${Math.floor(100 * fit)}px ${system}`;
  ctx.letterSpacing = `${-5 * fit}px`;
  ctx.fillText(c.mark, pad - 6, h - 52);
  ctx.letterSpacing = "0px";
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
 * black ink on the business face, so where the strap passes behind it the words
 * would vanish; each statement carries a white copy (`.statement-invert`) and
 * this clips that copy to the badge's on-screen outline — card and strap —
 * every frame, so the letters turn white exactly where they cross it.
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

/** The badge face, full bleed. */
function paintBadge(fonts: Fonts) {
  const w = 680;
  const h = Math.round(w * (H / W));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  // Full bleed: the card geometry supplies the corners and the hole.
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
  const { viewport, camera, size } = useThree();
  const cardMesh = useRef<Mesh>(null);
  const strapMesh = useRef<Mesh>(null);
  const clipped = useRef(false);
  const scratch = useRef(new Vector3());
  const card = useMemo(() => cardGeometry(), []);
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

  useFrame(({ clock }, rawDelta) => {
    const g = root.current;
    const pv = pivot.current;
    if (!g || !pv) return;
    const { statement: p, thermal } = scrollState;
    const ph = physics.current;
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
      // Strap only: the card is light, and black type reads on it.
      clipStatements([STRAP_OUTLINE.map(toScreen(sm))]);
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
            <meshStandardMaterial color="#124a3f" roughness={0.85} />
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
          <mesh ref={cardMesh} geometry={card}>
            <meshPhysicalMaterial
              attach="material-0"
              map={textures.face}
              roughness={0.35}
              clearcoat={0.6}
              clearcoatRoughness={0.2}
            />
            <meshPhysicalMaterial
              attach="material-1"
              color="#e4ebe9"
              roughness={0.5}
              clearcoat={0.25}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
