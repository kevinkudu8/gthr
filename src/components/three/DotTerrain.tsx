"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Raycaster, Vector2, Vector3 } from "three";
import type { Points, ShaderMaterial } from "three";
import { valueNoise } from "./noise";
import { scrollState } from "./scrollState";

/**
 * The business face's hero image: a field of dots that is two things at once.
 *
 * At rest it is a digital mountain range — a regular lattice (the grid is what
 * makes it read as *digital* rather than as scattered dust) lifted by ridged
 * noise over big massifs. It is drawn as a **stipple**, the way the reference
 * engraving is: tone is carried by how many dots there are and how big they
 * are, not by how faint they are, and the dots stay near solid so the depth
 * buffer can do its job — near ridges occlude the ground behind them, which is
 * most of what makes it read as three-dimensional rather than as a shaded
 * sheet. Shading is sky plus a low sun with real cast shadows marched over the
 * heightfield, and ink is *darkness*: bare paper where the sun lands, dense
 * where it does not.
 * The cursor both tints what it passes over and pushes
 * the ground: a swell under it with ripples running out.
 *
 * Hover the GTHR wordmark and the whole field gathers into the letterforms.
 * The text target is not guessed: the word is rasterised into a canvas using
 * the live computed font of the DOM wordmark and positioned from its own box
 * metrics, so the dots land exactly where the type is.
 *
 * The dots then fade out *completely* before they land. The DOM word keeps its
 * own solid look and sits in front of this layer, so any residue at all
 * stipples the glyph edges and the word reads as noisy — what marks the
 * arrival instead is the spectral sweep on the word itself (see
 * sections/WordSheen.tsx).
 */

/**
 * The landscape, in world units. Tall and deep.
 *
 * These two were solved against the projection, not chosen: a dot's ndcY is
 * `y / ((6 - z) * tan20)`, so a distant peak sits far higher on screen than its
 * world y suggests. Swept until the highest dot *within the type's band* clears
 * ndcY -0.26 (the hero's text runs +0.09 down to -0.22) while the flanking
 * peaks reach ndcY -0.05, about halfway up the frame. Redo that sweep if the
 * depth, the carve, or the hero's type size changes.
 */
const GROUND_Y = -3.2;
const RELIEF = 5.4;
/** Strictly nearer than the camera at z = 6, or the first row sits on the lens. */
const Z_NEAR = 3;
const Z_FAR = -24;
const HALF_WIDTH = 14;
const WORD_SELECTOR = ".hero-lockup__word";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Ridged noise: folding the field at its midpoint turns rounded hills into
 * sharp crests, and squaring sharpens them further. Plain fbm gives dunes.
 */
function ridged(x: number, z: number, octaves: number) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * frequency, z * frequency) * 2 - 1);
    // Weighting each octave by the one above it keeps detail on the ridges and
    // out of the valleys, which is what stops it looking like crumpled foil.
    sum += amplitude * n * n * (0.45 + 0.55 * sum);
    norm += amplitude;
    amplitude *= 0.52;
    frequency *= 2.03;
  }
  // The octave weighting biases the sum low — measured, it tops out near 0.52,
  // so the range is stretched back out. Without this the "mountains" only ever
  // use the bottom half of RELIEF and read as hills.
  return Math.min(1, (sum / norm) * 1.9);
}

/**
 * A pass through the middle of the range, which is where the type sits.
 *
 * Returns 0 in the floor of the pass and 1 out on the flanks. This is what lets
 * the mountains be tall: holding the *whole* field below the type flattened it
 * out of the frame, but only the middle of the field is ever behind the
 * wordmark, so only the middle has to keep its head down.
 *
 * The pass widens with distance because the type holds the same share of the
 * screen however far away the ground is — a constant-width corridor would close
 * up at the horizon and let a peak through.
 */
function pass(x: number, z: number) {
  const depth = 6 - z;
  // A flat floor, then a ramp up to the flanks. The floor has to be at least as
  // wide as the type's own band — the type spans about 0.17 * depth in world
  // units at any distance — or the carve is still climbing where the wordmark
  // is and peaks come through it. A single ramp from the centre did exactly
  // that: it was only ~35% carved at the edge of the text.
  const inner = 0.21 * depth + 1.8;
  const outer = inner + 0.19 * depth + 3.2;
  // A gentle wander, so it is a valley rather than a machined trench. Small
  // enough that the floor still contains the type.
  const centre = Math.sin(z * 0.09) * 0.55 + Math.sin(z * 0.031) * 0.35;
  const t = clamp01((Math.abs(x - centre) - inner) / (outer - inner));
  return t * t * (3 - 2 * t);
}

/**
 * The height at a point: big massifs carrying fine detail, rather than one
 * band of noise. The detail term is scaled *by the massif*, so the high ground
 * is rough and the low ground is smooth — which is what reads as a mountain
 * range instead of an evenly crumpled sheet.
 */
function elevation(x: number, z: number) {
  const massif = ridged(x * 0.042, z * 0.042, 6);
  // High frequency on purpose. The detail band is not only how much fine
  // structure there is, it is how *steep* the ground gets — and slope is what
  // the shading has to work with. At the gentler 0.19 the whole range was
  // near enough upward-facing everywhere, so nothing ever went dark and it
  // read flat. Four octaves: at six, the finest lands under the lattice
  // spacing and turns to noise.
  const detail = ridged(x * 0.5, z * 0.5, 4);
  return Math.min(1, massif * 0.78 + detail * 0.52 * (0.3 + 0.7 * massif));
}

/**
 * How much of its natural height a point keeps. The pass floor keeps a little,
 * so it reads as a valley floor rather than a hole cut through the range.
 */
function carveAt(x: number, z: number) {
  return 0.05 + 0.95 * pass(x, z);
}

/**
 * Below this the land is water. Tested against the *natural* elevation, not the
 * carved one: keyed to the carved height it drowned the entire pass floor —
 * 40% of the field, and the middle of the frame went blank — because the carve
 * pushes everything there down by design. Against the natural terrain the water
 * collects in real valleys instead.
 */
const WATER = 0.18;

/** World height of the finished surface at a point — carve and water included. */
function surfaceYAt(x: number, z: number) {
  const natural = elevation(x, z);
  const h = (natural < WATER ? WATER : natural) * carveAt(x, z);
  return GROUND_Y + h * RELIEF;
}

/**
 * March the cursor ray into the heightfield and return the distance at which it
 * meets the ground, or -1.
 *
 * This replaced a flat plane at mid-relief, which was cheap but put the swell
 * visibly *below* the cursor: the plane sits above the real surface almost
 * everywhere, so the ray met it early, and the dots at those coordinates —
 * sitting at their true, lower height — projected further down the screen than
 * the cursor. It is one ray per frame, not one per dot, so the accurate version
 * costs nothing worth saving: a few dozen height samples.
 */
function raycastTerrain(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) {
  const STEPS = 56;
  const NEAR = 2;
  const FAR = 36;
  let prevT = NEAR;
  let prevGap = oy + dy * NEAR - surfaceYAt(ox + dx * NEAR, oz + dz * NEAR);
  for (let i = 1; i <= STEPS; i++) {
    const t = NEAR + ((FAR - NEAR) * i) / STEPS;
    const gap = oy + dy * t - surfaceYAt(ox + dx * t, oz + dz * t);
    if (gap <= 0 && prevGap > 0) {
      // Bisect the straddled interval — a linear guess is enough at this step
      // size, but a few halvings cost nothing and stop the swell juddering.
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < 8; k++) {
        const mid = (lo + hi) / 2;
        const g = oy + dy * mid - surfaceYAt(ox + dx * mid, oz + dz * mid);
        if (g <= 0) hi = mid;
        else lo = mid;
      }
      return (lo + hi) / 2;
    }
    prevT = t;
    prevGap = gap;
  }
  return -1;
}

function buildTerrain(mobile: boolean) {
  const cols = mobile ? 420 : 880;
  const rows = mobile ? 250 : 520;
  const cells = cols * rows;

  // The lattice, laid out first so heights can be differenced off their
  // neighbours for shading and marched for shadows. Sampling the noise again
  // per dot for either would cost several times the build.
  const xs = new Float32Array(cols);
  const zs = new Float32Array(rows);
  for (let c = 0; c < cols; c++) xs[c] = (c / (cols - 1) - 0.5) * 2 * HALF_WIDTH;
  for (let r = 0; r < rows; r++) {
    // Rows bunch toward the horizon, so the near ground is not wasted on rows
    // perspective would pile up anyway.
    zs[r] = Z_NEAR + (Z_FAR - Z_NEAR) * Math.pow(r / (rows - 1), 1.75);
  }

  // Natural elevation and the carve are kept apart: the surface uses both, but
  // the water line is a fact about the terrain, not about the pass.
  const naturals = new Float32Array(cells);
  const carves = new Float32Array(cells);
  const surface = new Float32Array(cells);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      naturals[i] = elevation(xs[c], zs[r]);
      carves[i] = carveAt(xs[c], zs[r]);
      const wet = naturals[i] < WATER;
      // Water lies flat, but the pass it sits in still slopes, so the water
      // line follows the carve too.
      surface[i] = (wet ? WATER : naturals[i]) * carves[i];
    }
  }

  // Low sun over the left shoulder. Low matters: a high sun casts no shadows
  // on ground this broad — at 0.74 elevation nothing in the field was steep
  // enough to block it and the shadow pass found precisely nothing.
  const lx = -0.62;
  const ly = 0.3;
  const lz = 0.5;
  // How steep the ground has to rise toward the light to block it.
  const lightSlope = ly / Math.hypot(lx, lz);

  /**
   * Cast shadow, by marching the heightfield toward the light and keeping the
   * steepest rise found. Anything steeper than the light's own angle is between
   * this point and the sun. This is most of what makes the range read as solid
   * rather than as a shaded bump map — ridges throw shadows onto what is behind
   * them.
   */
  // Marching *toward* the light: x decreases as the light is to the -x side,
  // and z increases toward +lz — which is a decreasing row, since the rows run
  // from near to far. Stride 3 so eight samples still reach a useful distance.
  const stepC = lx < 0 ? -4 : 4;
  const stepR = lz > 0 ? -4 : 4;
  const shadow = new Float32Array(cells);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const y0 = surface[i] * RELIEF;
      let steepest = 0;
      for (let s = 1; s <= 6; s++) {
        const cc = c + stepC * s;
        const rr = r + stepR * s;
        if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) break;
        const run = Math.hypot(xs[cc] - xs[c], zs[rr] - zs[r]);
        if (run < 1e-4) continue;
        const slope = (surface[rr * cols + cc] * RELIEF - y0) / run;
        if (slope > steepest) steepest = slope;
      }
      shadow[i] = 1 - smoothstep(lightSlope * 0.7, lightSlope * 1.3, steepest);
    }
  }

  // Emitted dots. Tone drives both how likely a dot is to exist and how big it
  // is — this is a stipple, so density *is* the tone, the way the reference
  // engraving works. Alpha stays near solid, which is what lets the depth
  // buffer occlude: ridges hide the ground behind them.
  const position = new Float32Array(cells * 3);
  const alpha = new Float32Array(cells);
  const scale = new Float32Array(cells);
  const seed = new Float32Array(cells);
  let n = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;

      // Slope from the neighbours, in world units — the row spacing is uneven,
      // so the differences have to be divided by the real distance.
      const c0 = Math.max(0, c - 1);
      const c1 = Math.min(cols - 1, c + 1);
      const r0 = Math.max(0, r - 1);
      const r1 = Math.min(rows - 1, r + 1);
      const dhdx = ((surface[r * cols + c1] - surface[r * cols + c0]) * RELIEF) / (xs[c1] - xs[c0] || 1);
      const dhdz = ((surface[r1 * cols + c] - surface[r0 * cols + c]) * RELIEF) / (zs[r1] - zs[r0] || 1);
      const nx = -dhdx;
      const nz = -dhdz;
      const len = Math.hypot(nx, 1, nz) || 1;
      const lambert = Math.max(0, (nx * lx + ly + nz * lz) / len);

      // Ink is *darkness*, not light — the opposite of the halftone globe. The
      // reference is a photograph of a range: sunlit faces are bare paper and
      // the shadowed ones are dense with ink. Reading it the other way round is
      // most of why this looked flat.
      // Sky plus sun. The sky term is the surface's upward-facing fraction,
      // which is 0 on a vertical wall — so a wall in shadow can actually reach
      // black. Wrapping it as 0.5 + 0.5 * up floors it at half and nothing in
      // the range ever got dark.
      const sky = 1 / len;
      const lit = clamp01(sky * 0.62 + lambert * shadow[i] * 0.7);
      const tone = clamp01(0.06 + (1 - lit) * 0.94);

      // Thinning the light ground is what gives the plain its open stipple
      // instead of a uniform grid of faint dots.
      if (Math.random() > 0.35 + 0.65 * tone) continue;

      position[n * 3] = xs[c];
      position[n * 3 + 1] = GROUND_Y + surface[i] * RELIEF;
      position[n * 3 + 2] = zs[r];
      alpha[n] = 0.82 + tone * 0.18;
      // A *fraction of the lattice spacing*, not a size in pixels — see uSize.
      // 1.0 is dots exactly touching; the top of the range overlaps them into
      // solid ink, and the bottom is an open stipple.
      scale[n] = 0.3 + tone * 0.88;
      seed[n] = Math.random();
      n++;
    }
  }

  return {
    /** World distance between columns — what a dot's size is measured against. */
    spacing: (2 * HALF_WIDTH) / (cols - 1),
    position: position.subarray(0, n * 3),
    alpha: alpha.subarray(0, n),
    scale: scale.subarray(0, n),
    seed: seed.subarray(0, n),
    count: n,
  };
}

/**
 * Sample the wordmark's glyphs into world-space points.
 *
 * The baseline is derived rather than eyeballed: with `line-height: 1` the text
 * is centred in its line box by half-leading, so the baseline sits at
 * `(boxHeight - (ascent + descent)) / 2 + ascent` from the top of the box,
 * using the font's own metrics from `measureText`.
 */
function sampleWordmark(el: HTMLElement, count: number, worldPerPx: number, vw: number, vh: number) {
  // Direct text nodes only. `textContent` would also pick up the sheen overlay
  // nested inside this span (sections/WordSheen.tsx) and rasterise the word
  // twice over.
  const text = Array.from(el.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();
  if (!text) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1) return null;

  const style = getComputedStyle(el);
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  probe.font = font;
  // Supported in current Chrome and Safari; without it the sampled word is a
  // shade wider than the DOM one, which only shows as a soft edge.
  if ("letterSpacing" in probe) probe.letterSpacing = style.letterSpacing;
  const metrics = probe.measureText(text);

  const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent;
  const baselineInBox = (rect.height - (ascent + descent)) / 2 + ascent;

  const pad = 4;
  const inkAscent = metrics.actualBoundingBoxAscent + pad;
  const inkDescent = metrics.actualBoundingBoxDescent + pad;
  const width = Math.ceil(metrics.width + pad * 2);
  const height = Math.ceil(inkAscent + inkDescent);
  if (width < 2 || height < 2) return null;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.font = font;
  if ("letterSpacing" in ctx) ctx.letterSpacing = style.letterSpacing;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, pad, inkAscent);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  // Where the canvas's top-left sits on screen. The pen started at `pad` in
  // the canvas and at `rect.left` on screen, and at `inkAscent` down the
  // canvas against `baselineInBox` down the box — so both origins step back by
  // exactly those offsets.
  const originX = rect.left - pad;
  const originY = rect.top + baselineInBox - inkAscent;

  const out = new Float32Array(count * 3);
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 60) {
    guard++;
    const px = Math.floor(Math.random() * canvas.width);
    const py = Math.floor(Math.random() * canvas.height);
    if (pixels[(py * canvas.width + px) * 4 + 3] < 128) continue;
    const screenX = originX + px / scale;
    const screenY = originY + py / scale;
    out[placed * 3] = (screenX - vw / 2) * worldPerPx;
    out[placed * 3 + 1] = (vh / 2 - screenY) * worldPerPx;
    out[placed * 3 + 2] = 0;
    placed++;
  }
  // A word this size always yields plenty; bail rather than ship a half-formed
  // set that would leave dots stranded mid-flight.
  if (placed !== count) return null;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < count; i++) {
    cx += out[i * 3];
    cy += out[i * 3 + 1];
  }
  return { points: out, center: [cx / count, cy / count, 0] as [number, number, number] };
}

const vertexShader = /* glsl */ `
  attribute vec3 aText;
  attribute float aAlpha;
  attribute float aScale;
  attribute float aSeed;

  uniform float uTime;
  uniform float uMorph;
  uniform float uFade;
  uniform float uSize;
  uniform float uDpr;
  uniform vec3 uRayOrigin;
  uniform vec3 uRayDir;
  uniform float uTouchAmt;
  uniform float uTouchRadius;
  uniform vec2 uPointer;
  /** The gathered word, as it moves: scrolled up the page, and shrinking back. */
  uniform vec3 uTextShift;
  uniform vec3 uTextCenter;
  uniform float uTextScale;
  uniform float uSwellRadius;
  uniform vec3 uInk;

  varying float vAlpha;
  varying vec3 vColor;

  vec3 spectrum(float h) {
    return clamp(0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67))), 0.0, 1.0);
  }

  void main() {
    // Staggered per dot, so the field gathers as a wave rather than snapping.
    float local = clamp(uMorph * 1.45 - aSeed * 0.45, 0.0, 1.0);
    float e = local * local * (3.0 - 2.0 * local);

    // The word is a moving target once the page scrolls — it rides up with the
    // document and draws back — so the gathered positions have to move with it,
    // or the dots converge on where the type used to be.
    vec3 target = uTextCenter + (aText - uTextCenter) * uTextScale + uTextShift;
    vec3 pos = mix(position, target, e);
    // Bowed toward the viewer at the midpoint, so dots arc into the word
    // instead of sliding flat across the ground.
    pos.z += sin(e * 3.14159) * (0.5 + aSeed * 1.1);
    // The landscape breathes, but only while it is a landscape.
    pos.y += sin(uTime * 0.5 + position.x * 0.6 + position.z * 0.35) * 0.025 * (1.0 - e);

    // The cursor pushes the ground around: a swell under it with ripples
    // running out of it. Measured from the dot's *resting* place, so the swell
    // sits still under the cursor instead of chasing the ground it just lifted.
    float pd = distance(position.xz, uPointer);
    float reach = smoothstep(uSwellRadius, 0.0, pd);
    float ripple = sin(pd * 1.9 - uTime * 2.4) * reach * reach;
    // Half the push it started with — it was overpowering the landscape.
    pos.y += (reach * 0.48 + ripple * 0.25) * uTouchAmt * (1.0 - e);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mv.z;
    gl_Position = projectionMatrix * mv;

    // Iridescence: the cursor tints what it passes over. Held back while the
    // dots are gathered into the word, where it would just muddy the letters.
    vec3 world = (modelMatrix * vec4(pos, 1.0)).xyz;
    vec3 along = uRayOrigin + uRayDir * max(0.0, dot(world - uRayOrigin, uRayDir));
    float touch = smoothstep(uTouchRadius, 0.0, distance(world, along)) * uTouchAmt * (1.0 - e * 0.85);
    vColor = mix(uInk, spectrum(fract(aSeed * 0.7 + uTime * 0.05)), touch * 0.75);

    // uSize is the projected size of one lattice cell at unit distance, so
    // uSize/dist is the cell's width in pixels and aScale is the dot's share of
    // it. Sized any other way the dots cannot reach full coverage, and the
    // range can never be darker than the few percent they cover — which is
    // exactly why it read as a pale haze.
    float px = uSize * aScale * uDpr * (1.0 - e * 0.55) / max(0.4, dist);
    float sized = clamp(px, 1.0, 40.0 * uDpr);
    gl_PointSize = sized;

    // Sub-pixel dots fade rather than being bloated to a pixel by the driver —
    // a regular lattice in perspective moirés badly without it.
    // Aerial perspective: the range pales with distance, which is the other
    // half of reading as deep. Not a fade to nothing — distant peaks stay
    // legible, they just lose their weight.
    float depthFade = mix(0.55, 1.0, smoothstep(30.0, 6.0, dist));
    // Bright through the flight, then gone *completely* before they land. The
    // DOM wordmark keeps its own solid look and sits in front of this; any
    // residue at all stipples the glyph edges and the word reads as noisy.
    float merge = 1.0 - smoothstep(0.55, 0.9, e);
    vAlpha = mix(aAlpha * depthFade, 0.8, e) * merge * uFade * min(1.0, px / sized) * (1.0 + touch * 0.6);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.34, 0.5, d)) * vAlpha;
    // With depth writing on, a surviving fragment also writes depth, so a
    // dot's soft rim occludes rather than blends. Kept low all the same: the
    // distant dots are faint by design (aerial perspective, sub-pixel fade) and
    // a high threshold deletes the far half of the range outright. A one-pixel
    // rim of over-occlusion around a near dot is the cheaper mistake.
    if (a < 0.05) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

export function DotTerrain({ mobile }: { mobile: boolean }) {
  const material = useRef<ShaderMaterial>(null);
  const points = useRef<Points>(null);
  const { gl, camera, viewport, size } = useThree();
  const morph = useRef(0);
  const touch = useRef(0);
  const scratch = useRef({
    ndc: new Vector2(),
    raycaster: new Raycaster(),
    // The cursor is met on a plane through the middle of the relief, which is
    // where the swell should sit — the real surface is a heightfield, and
    // marching a ray down it would cost more than the swell is worth.
    hit: new Vector3(),
  });

  const terrain = useMemo(() => buildTerrain(mobile), [mobile]);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(terrain.position, 3));
    geo.setAttribute("aText", new Float32BufferAttribute(new Float32Array(terrain.count * 3), 3));
    geo.setAttribute("aAlpha", new Float32BufferAttribute(terrain.alpha, 1));
    geo.setAttribute("aScale", new Float32BufferAttribute(terrain.scale, 1));
    geo.setAttribute("aSeed", new Float32BufferAttribute(terrain.seed, 1));
    geo.boundingSphere = null;
    return geo;
  }, [terrain]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uFade: { value: 0 },
      uSize: { value: 11 },
      uDpr: { value: 1 },
      uRayOrigin: { value: [0, 0, 60] },
      uRayDir: { value: [0, 0, -1] },
      uTouchAmt: { value: 0 },
      uTouchRadius: { value: 2.2 },
      uPointer: { value: [0, -60] },
      uSwellRadius: { value: 4.2 },
      uTextShift: { value: [0, 0, 0] },
      uTextCenter: { value: [0, 0, 0] },
      uTextScale: { value: 1 },
      // Raw sRGB: a ShaderMaterial writes straight to the sRGB framebuffer, so
      // a THREE.Color would be converted to linear first and land wrong.
      uInk: { value: [0, 0, 0] },
    }),
    [],
  );

  /** Measure the wordmark and load the gathered positions into the geometry. */
  const ready = useRef(false);
  const textCenter = useRef<[number, number, number]>([0, 0, 0]);
  const perPx = useRef(1);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(WORD_SELECTOR);
    if (!el) return;

    const measure = () => {
      const worldPerPx = viewport.height / size.height;
      const sampled = sampleWordmark(el, terrain.count, worldPerPx, size.width, size.height);
      if (!sampled) return;
      const attribute = geometry.getAttribute("aText") as BufferAttribute;
      attribute.copyArray(sampled.points);
      attribute.needsUpdate = true;
      textCenter.current = sampled.center;
      perPx.current = worldPerPx;
      ready.current = true;
    };

    measure();
    // Re-measure once webfonts settle and whenever the box changes: the dots
    // have to keep landing on the type, not near it.
    document.fonts?.ready.then(measure).catch(() => {});
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, [geometry, terrain.count, viewport.height, size.width, size.height]);

  useFrame(({ clock }, delta) => {
    const m = material.current;
    const field = points.current;
    if (!m || !field) return;
    const { businessMix, hero, reducedMotion, pointerActive } = scrollState;

    const fade = businessMix * (1 - smoothstep(0.42, 0.88, hero));
    m.uniforms.uFade.value = fade;
    // Hidden on the party face rather than drawn at zero alpha: otherwise the
    // vertex shader still runs for every dot to produce nothing.
    field.visible = fade > 0.001;
    if (!field.visible) return;

    m.uniforms.uTime.value = reducedMotion ? 2 : clock.elapsedTime;
    m.uniforms.uDpr.value = gl.getPixelRatio();
    // One lattice cell, projected to CSS pixels at unit distance. Derived from
    // the live viewport and camera rather than being a tuned constant, so the
    // stipple tiles the same way at any window size.
    // R3F types the camera as the union of both projections; only a
    // perspective one has a field of view, and that is what this scene uses.
    const fov = "fov" in camera ? camera.fov : 40;
    const perspective = 2 * Math.tan((fov * Math.PI) / 360);
    m.uniforms.uSize.value = (size.height / perspective) * terrain.spacing;

    // Two ways in. The hover is owned by sections/WordSheen.tsx, which is the
    // DOM side of the same interaction; scrolling gathers the field as well, so
    // the range collects itself into the word on the way out rather than just
    // fading. Only gather once there is somewhere to gather to.
    const hovering = scrollState.wordmark > 0.5;
    const scrolled = smoothstep(0.03, 0.4, hero);
    const wantMorph = ready.current ? Math.max(hovering ? 1 : 0, scrolled) : 0;
    morph.current += (wantMorph - morph.current) * (1 - Math.exp(-delta * (wantMorph > morph.current ? 3.4 : 2.6)));
    // Scroll wins outright once it is ahead: easing toward a target that is
    // itself following the scroll would always lag behind the type.
    m.uniforms.uMorph.value = Math.max(morph.current, scrolled * (ready.current ? 1 : 0));

    // The word rides up with the document and draws back as it goes, so the
    // gathered positions track it.
    const drift = smoothstep(0.12, 0.75, hero);
    m.uniforms.uTextCenter.value = textCenter.current;
    m.uniforms.uTextScale.value = 1 - drift * 0.3;
    m.uniforms.uTextShift.value = [0, scrollState.y * perPx.current, -drift * 2.2];

    const state = scratch.current;
    state.ndc.set(scrollState.pointer.x, scrollState.pointer.y);
    state.raycaster.setFromCamera(state.ndc, camera);
    const { origin, direction } = state.raycaster.ray;
    m.uniforms.uRayOrigin.value = [origin.x, origin.y, origin.z];
    m.uniforms.uRayDir.value = [direction.x, direction.y, direction.z];
    // Above the skyline there is no hit; the swell simply holds its last spot
    // and fades out with uTouchAmt.
    const t = raycastTerrain(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z);
    if (t > 0) {
      m.uniforms.uPointer.value = [origin.x + direction.x * t, origin.z + direction.z * t];
    }

    const target = pointerActive && !reducedMotion ? 1 : 0;
    touch.current += (target - touch.current) * (1 - Math.exp(-delta * 4));
    m.uniforms.uTouchAmt.value = touch.current;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={-1}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        // The depth buffer is what makes this read as terrain rather than as a
        // flat spray: near ridges occlude the ground behind them. Safe to turn
        // on because nothing else in the scene writes depth here — the cloud
        // backdrop runs with both off — and the lattice is emitted near row
        // first, so dots arrive front to back.
        depthTest
        depthWrite
      />
    </points>
  );
}
