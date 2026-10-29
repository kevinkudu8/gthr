"use client";

import { ScreenQuad } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type ShaderMaterial,
} from "three";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { scrollState } from "./scrollState";

const vertexShader = /* glsl */ `
  varying vec2 vScreen;
  void main() {
    // 0..1 across the screen, whatever this is being drawn into.
    vScreen = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// The party ground is a procedural thermal field (see below); the business
// ground is clean paper. Everything else here is the hairline grid and the film grain,
// both of which have to live in this shader because it is the only thing that
// draws behind the 3D objects.
const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vScreen;
  uniform float uQuadCoords;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIntensity;
  uniform float uCalm;
  uniform float uEnd;
  uniform float uBusiness;
  // The light-to-dark spill: progress 0..1, 1 while the last switch was one
  // (0 means plain crossfade on uBusiness), and a per-switch random offset.
  uniform float uSpill;
  uniform float uSpillOn;
  uniform vec2 uSpillSeed;
  // 1: draw only the spill (how much is still light, as grey) -- the mask
  // pass for chrome/spill.ts. 0: the ground itself.
  uniform float uMaskOnly;
  uniform vec3 uPaper;
  uniform vec3 uBusinessPaper;
  uniform float uGrid;
  uniform float uDpr;
  uniform float uGrain;
  uniform float uScroll;
  uniform float uLift;
  uniform float uPhoneGrid;
  uniform vec4 uBlobA[BLOBS];
  uniform vec4 uBlobB[BLOBS];
  uniform float uTaper[BLOBS];
  uniform vec3 uRamp[STOPS];
  uniform float uRampAt[STOPS];
  // The pointer's heat trail: xy a point in screen space (0..1, y down),
  // z its heat (already faded with age), w its radius in screen heights.
  uniform vec4 uTrail[TRAIL];
  // The hero's bottom edge on screen (0..1, y down): the trail stops there.
  uniform float uTrailEdge;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // Smooth value noise and a few octaves of it, for the spill's fronts.
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int o = 0; o < 4; o++) {
      v += amp * vnoise(p);
      p = p * 2.03 + 17.1;
      amp *= 0.5;
    }
    return v;
  }

  // The reference artwork's width, in units of its height.
  const float REF_W = 1.736;
  // Below the reference's own bottom edge the field is held constant in y...
  const float EXTEND = 0.95;
  // ...and the page folds back on itself (a vertical mirror) every FOLD.
  const float FOLD = 1.6;

  /* One copy of the composition, in reference space: x across 0..REF_W,
     y down 0..1. Each blob is a flat-topped gaussian — elliptical, rotated,
     optionally tapered along its long axis (that is what gives the black wedge
     and the orange tongue their points) — and they simply sum, clamped. */
  float composition(vec2 p, float t) {
    float h = 0.0;
    for (int i = 0; i < BLOBS; i++) {
      vec4 a = uBlobA[i];
      vec4 b = uBlobB[i];
      float fi = float(i);
      // A slow wander per blob, so the field breathes rather than sits.
      vec2 c = a.xy + vec2(sin(t * 0.11 + fi * 1.7), cos(t * 0.09 + fi * 2.3)) * 0.018;
      vec2 d = p - c;
      float u = (b.x * d.x + b.y * d.y) * a.z;
      float v = (-b.y * d.x + b.x * d.y) * a.w / clamp(1.0 + uTaper[i] * u, 0.15, 4.0);
      float r = max(length(vec2(u, v)) - b.w, 0.0);
      h += b.z * exp(-r * r);
    }
    return h;
  }

  /* The scalar field goes through a ramp in the client's palette, in the
     reference's own hue order — black -> green -> teal -> blue -> violet ->
     magenta -> coral -> and back to black.

     The *hues* are the new reference's; the **luminance curve is the old
     ramp's**: it peaks around the middle and then runs a long dark tail, so
     the core of the big mass is the hottest point yet reads dark. That is
     what holds the page's layout of light and dark — and the room for white
     type. Taking the reference's own luminance instead (which ends at cream)
     lit up the middle of every screen: the statements, the about copy and the
     contact form all lost their ground. */
  vec3 thermal(float h) {
    vec3 col = uRamp[0];
    for (int i = 1; i < STOPS; i++) {
      float k = clamp((h - uRampAt[i - 1]) / (uRampAt[i] - uRampAt[i - 1]), 0.0, 1.0);
      col = mix(col, uRamp[i], k);
    }
    return col;
  }

  vec3 hexc(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

  void main() {
    /* Screen position from the quad, not gl_FragCoord: the glass letters'
       transmission pass draws this same quad into its own small square
       buffer, and read through gl_FragCoord against the screen's size it
       painted only a magnified corner of the field there -- the letters
       refracted the wrong colours (pastel, coarse grain on phones, where
       that buffer is a third of the screen's width). Phones only for now
       (uQuadCoords): desktop's buffer covers most of the screen, and its
       glass, as tuned with the client, was tuned on the old read. */
    vec2 fragPx = uQuadCoords > 0.5 ? vScreen * uResolution : gl_FragCoord.xy;
    /* The light face, settled: plain paper, the same colour everything
       below would come to (no field, no grid, no grain). Skips the field
       so phones can draw it at full sharpness for the badge. */
    if (uBusiness > 0.999 && uSpillOn < 0.5 && uMaskOnly < 0.5) {
      gl_FragColor = vec4(uBusinessPaper, 1.0);
      return;
    }
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = (fragPx / uResolution) * 2.0 - 1.0;
    uv.x *= aspect;



    /* The party ground: the client's reference artwork, rebuilt as a field so
       it is sharp at any resolution and runs the full length of the page.

       Page space: x is the reference's width stretched to the viewport (a
       narrow screen shows the middle of it, squeezed at most ~2x, rather than
       a sliver), y is viewport heights down the page. The first screen is
       the reference composition.

       Below it, the page is a vertical mirror fold of that composition —
       reference, upside-down reference, reference — because a fold is
       continuous by construction. Stacked copies were tried first and read as
       tiles: the fitted mass closes just under the frame (the fit never saw
       past it), so every copy became an island with a black gap under it.
       Folding naively had the same problem as a visible seam, so past EXTEND
       the field is held constant in y (a soft clamp) and the fold lines sit
       inside that zone, where a mirror has nothing to crease. A meander that
       only grows in below the hero keeps that zone from reading as vertical
       streaks, and makes each fold differ from the last. */
    vec2 sv = vec2(fragPx.x, uResolution.y - fragPx.y) / uResolution;
    float span = REF_W * clamp(aspect / REF_W, 0.5, 1.0);
    vec2 p = vec2(0.5 * REF_W + (sv.x - 0.5) * span, sv.y + uScroll + uLift);
    // A slow, low-amplitude warp so edges stay organic as they drift.
    p += vec2(sin(p.y * 5.1 + p.x * 2.3 + uTime * 0.07),
              sin(p.x * 4.3 - p.y * 1.7 - uTime * 0.05)) * 0.022;

    p.x += 0.25 * smoothstep(0.9, 1.8, p.y)
      * (sin(p.y * 1.9 + 0.8 + uTime * 0.03) + 0.5 * sin(p.y * 3.7 - p.x * 1.1));
    float fy = mod(p.y, 2.0 * FOLD);
    fy = fy < FOLD ? fy : 2.0 * FOLD - fy;
    fy = EXTEND - log(1.0 + exp((EXTEND - fy) / 0.1)) * 0.1;
    float heat = composition(vec2(p.x, fy), uTime);

    /* The pointer is a heat source: where it has just been, the field runs
       hotter — pulled toward the ramp's magenta/coral peak (0.72) rather than
       simply up, because past the peak the ramp runs dark again, and adding
       heat to the core would cool it to brown. Party face only: the business
       ground never shows this field. */
    float boost = 0.0;
    for (int i = 0; i < TRAIL; i++) {
      vec4 tr = uTrail[i];
      vec2 d = sv - tr.xy;
      d.x *= aspect;
      boost += tr.z * exp(-dot(d, d) / (tr.w * tr.w));
    }
    boost *= smoothstep(uTrailEdge, uTrailEdge - 0.04, sv.y);
    heat = mix(heat, 0.72, clamp(boost, 0.0, 1.0) * 0.95);

    vec3 col = thermal(clamp(heat, 0.0, 1.0));

    /* Calm, below the hero: the hero is the poster, the rest of the page the
       room it hangs in. Behind reading content the full-strength field
       fought the text, black against neon. Desaturate a little, then flatten
       the range: blacks lift to a soft near-black and the peaks drop to
       about half, so the bands read as ambient glow rather than stripes.
       uCalm is per section (scrollState), blended as sections scroll past. */
    /* At the very end of the page the full colour comes back, rising from
       the bottom edge of the screen only: strongest along the bottom, gone by
       a little over half-way up, and only as uEnd reaches the last stretch of
       scroll. The contact form above stays on near-black. */
    float peek = uEnd * uEnd * smoothstep(0.42, 1.0, sv.y);
    float calmHere = uCalm * (1.0 - peek);
    float calm1 = clamp(calmHere, 0.0, 1.0);
    float calm2 = clamp(calmHere - 1.0, 0.0, 1.0);
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(lum), 0.35 * calm1);
    col = mix(col, vec3(0.05, 0.045, 0.06) + col * 0.42, calm1);
    // Level 2 (services, contact): near-black, only a trace of the colour.
    col = mix(col, vec3(0.028, 0.026, 0.034) + col * 0.16, calm2);

    // Hold the edges near paper so the chrome and gutters stay legible.
    float vig = smoothstep(1.4, 0.35, length(uv / vec2(aspect, 1.0)));
    // The business face is a clean white ground: the colour field fades out
    // and the paper itself goes to white.
    // Held high everywhere: the ramp is the party face's ground now, so
    // section intensity only trims it rather than fading it back to flat.
    // The vignette still darkens the gutters, which is what keeps the chrome
    // and the hairline grid legible over the warm band.
    /* How much of this pixel is still the light face. Normally that is
       uBusiness everywhere (a crossfade). Going light to dark it is the
       spill: the colour field eats the white from the screen edges along
       random, blobby fronts. Each pixel has an order in which it turns --
       its distance from the nearest edge, pushed about by slow drifting
       noise (reseeded every switch) and brought forward where the field
       itself runs hot, so colour pours in from its own shapes -- and a front
       sweeps through those orders as uSpill runs 0 to 1, with a narrow
       feather. */
    vec2 sq = sv * vec2(aspect, 1.0);
    float edgeDist = min(min(sq.x, aspect - sq.x), min(sq.y, 1.0 - sq.y));
    float wobble = fbm(sq * 2.2 + uSpillSeed + vec2(uTime * 0.12, -uTime * 0.09));
    float order = edgeDist * 1.6 + (wobble - 0.5) * 0.9 + (1.0 - clamp(heat, 0.0, 1.0)) * 0.35;
    // Spans the orders actually reached (about -0.3 at the edges to 1.45).
    float front = mix(-0.32, 1.48, uSpill);
    float spilled = smoothstep(front - 0.05, front + 0.05, order);
    float light = mix(uBusiness, spilled, uSpillOn);
    if (uMaskOnly > 0.5) {
      gl_FragColor = vec4(vec3(light), 1.0);
      return;
    }

    float strength = (0.88 + 0.12 * uIntensity) * mix(0.80, 1.0, vig) * (1.0 - light);
    /* Business: one flat white, the whole way down. There used to be
       a green gradient behind the hero here (businessRoom) that uRoom faded
       into this colour as the page scrolled on; the face is black-and-paper
       with a single mint accent now, so the gradient is gone and uRoom with
       it. The printed texture is a CSS grain over the page (.paper-grain in
       globals.css), not something this shader paints.

       No backticks in here: this whole shader is a template literal, and one
       in a comment ends it silently -- the quad just stops drawing. */
    vec3 paper = mix(uPaper, uBusinessPaper, light);
    // Opaque output: blended toward paper here rather than via alpha, so the
    // quad stays in the opaque pass and is drawn *under* the letters.
    vec3 col2 = mix(paper, col, strength);

    /* The hairline grid, drawn here rather than in the DOM. It has to be
       behind every 3D object — the glass letters, the badge — and this
       backdrop is the only thing in the scene that renders before them. A DOM
       layer cannot get behind it either, because this quad is opaque and
       covers the viewport. Ported from the old chrome/GridOverlay.tsx: a line
       at each gutter and at the thirds, two at the horizontal thirds, and an
       11px + at every crossing. */
    if (uGrid > 0.001) {
      // CSS pixels, y running down, to match the layout this mirrors.
      vec2 px = vec2(fragPx.x, uResolution.y - fragPx.y) / uDpr;
      float w = uResolution.x / uDpr;
      float h = uResolution.y / uDpr;
      float gutter = w >= 1024.0 ? 56.0 : 16.0;

      float line = 0.0;
      float cross = 0.0;
      /* Phones: two columns and two rows -- the gutter lines at the screen's
         edges are dropped, the thirds kept (client: "2 horizontally and 2
         vertically") -- and the whole grid fainter. (One row, between the
         word and the copy, was tried and was the wrong lines to lose.) */
      bool phone = uPhoneGrid > 0.5;
      for (int k = 0; k < 4; k++) {
        if (phone && (k == 0 || k == 3)) continue;
        float gx = gutter + (w - 2.0 * gutter) * float(k) / 3.0;
        float dx = abs(px.x - gx);
        line = max(line, 1.0 - smoothstep(0.0, 1.0, dx));
        for (int j = 1; j < 3; j++) {
          float gy = h * float(j) / 3.0;
          float dy = abs(px.y - gy);
          float armV = step(dy, 5.5) * (1.0 - smoothstep(0.0, 1.0, dx));
          float armH = step(dx, 5.5) * (1.0 - smoothstep(0.0, 1.0, dy));
          cross = max(cross, max(armV, armH));
        }
      }
      for (int j = 1; j < 3; j++) {
        line = max(line, 1.0 - smoothstep(0.0, 1.0, abs(px.y - h * float(j) / 3.0)));
      }

      /* Party only: white hairlines at a low alpha (the face is dark, black
         ones were invisible). The business face has no grid -- removed at the
         client's request once its ground went white -- so uGrid is scaled
         down to nothing as the face switches to business (see useFrame). */
      vec3 ink = vec3(1.0);
      float gridA = uGrid * (phone ? 0.55 : 1.0);
      col2 = mix(col2, ink, line * 0.1 * gridA);
      col2 = mix(col2, ink, cross * 0.45 * gridA);
    }

    /* Film grain. Applied last, over everything including the grid, and at a
       constant amplitude rather than one scaled by brightness — grain that
       fades out of the shadows is what makes a dark gradient look like a flat
       fill. Sized in device pixels so it stays fine on a retina screen, and
       reseeded each frame so it shimmers the way real grain does. (A static
       version was tried at the client's request and reverted — it looked
       better moving.) */
    float g = hash(floor(gl_FragCoord.xy / max(1.0, uDpr * 0.5)) + fract(uTime) * 91.7);
    // Only where the dark face is: none on the white, none on the spill's
    // unconsumed patches.
    col2 += (g - 0.5) * uGrain * (1.0 - light);

    gl_FragColor = vec4(col2, 1.0);
  }
`;

/*
 * The composition, fitted to the client's reference artwork (colour-space
 * least squares against a blurred copy — the ramp below is sampled from it
 * too). Rows: centre x, centre y (reference space: x 0..1.736, y 0..1 down),
 * radius along / across the long axis, angle, amplitude (negative carves),
 * flat-core radius, taper along the long axis.
 */
const BLOB_PARAMS = [
  [0.764, 0.970, 0.914, 0.230, 0.100, 0.798, 0.100, -0.297], // main mass
  [0.409, 0.550, 0.360, 0.164, 0.202, 0.397, 0.193, -0.113], // its left shoulder
  [0.544, 0.331, 0.054, 0.100, -0.328, 0.378, 0.147, 0.024], // small flame
  [1.548, 0.290, 0.288, 0.123, 0.050, 0.461, 0.344, 0.452], // upper-right tongue
  [1.683, 0.761, 0.119, 0.331, -1.128, 0.321, 0.567, 0.311], // right edge
  [1.500, 0.819, 0.297, 0.132, -1.130, 0.320, 0.125, -0.814], // right pocket + crease
  [1.195, 0.433, 0.271, 0.055, -0.016, -0.422, 0.671, -0.013], // black wedge
  [0.390, 0.973, 0.461, 0.281, -0.203, 0.212, 0.617, 0.11], // core, left
  [1.056, 0.700, 0.439, 0.163, -0.017, 0.412, 0.085, 0.341], // core, right
];

// Raw sRGB — this ShaderMaterial writes straight to the sRGB framebuffer.
// Exported: the party badge is painted from the same ramp.
export const RAMP: [number, string][] = [
  [0, "05070a"], [0.1, "0d2a1a"], [0.18, "14461f"], [0.26, "1b7038"],
  [0.34, "23a05a"], [0.4, "2ab39a"], [0.46, "2f8fd0"], [0.52, "4a5fe0"],
  [0.58, "8b3fd0"], [0.64, "d23b9a"], [0.7, "f43f74"], [0.75, "fb6a4e"],
  [0.8, "d9742f"], [0.85, "8a5a34"], [0.9, "4a2f3a"], [0.95, "1e1526"],
  [1, "080a12"],
];

/** Points kept in the pointer's heat trail, and how long each one glows. */
const TRAIL = 48;
const TRAIL_LIFE = 1.1;

const defines = { BLOBS: BLOB_PARAMS.length, STOPS: RAMP.length, TRAIL };

const hex = (s: string) =>
  new Vector3(
    parseInt(s.slice(0, 2), 16) / 255,
    parseInt(s.slice(2, 4), 16) / 255,
    parseInt(s.slice(4, 6), 16) / 255,
  );

/** The off-screen pass that draws the spill as a mask, and where it is read back to. */
type MaskPass = {
  target: WebGLRenderTarget;
  scene: Scene;
  camera: OrthographicCamera;
  quad: Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  pixels: Uint8Array;
  image: ImageData | null;
};

function makeMaskPass(): MaskPass {
  const scene = new Scene();
  // The vertex shader writes clip space directly, so any camera will do and a
  // 2x2 plane covers the target.
  const quad = new Mesh(new PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const canvas = document.createElement("canvas");
  return {
    target: new WebGLRenderTarget(2, 2, { depthBuffer: false }),
    scene,
    camera: new OrthographicCamera(),
    quad,
    canvas,
    ctx: canvas.getContext("2d"),
    pixels: new Uint8Array(16),
    image: null,
  };
}

/** How long the light-to-dark spill takes to swallow the white, seconds. */
const SPILL_S = 0.72;
/** How far through the spill (0..1 of its time) the glass word starts in. */
const WORD_AT = 0.6;

/**
 * How far up the field is lifted on a phone held upright, in screen heights.
 * 0.2 first; then 0.38, with the glass word raised (HeroLetters'
 * PHONE_RAISE) and the client wanting the colour behind it rather than the
 * reference's black top — 0.38 with the word at 0.08 sets it on the band,
 * the copy under it on the darker ground.
 */
const PORTRAIT_LIFT = 0.38;

/** How fast the ground travels against the page: below 1 it sits behind it. */
const PARALLAX = 0.75;

/**
 * Full-screen thermal colour field behind everything, scrolling with the page.
 * The business face fades it to clean paper.
 */
export function CloudBackdrop() {
  const mobile = useIsMobile();
  const material = useRef<ShaderMaterial>(null);
  /** The face the spill last saw as the target, whether one is running, and when it began. */
  const spill = useRef({ target: scrollState.business, on: false, start: 0 });
  /** The spill mask's off-screen pass, made on first use (see useFrame). */
  const maskPass = useRef<MaskPass | null>(null);
  const { gl, size } = useThree();
  /**
   * The heat trail, a ring of points dropped behind the moving pointer:
   * screen position, when, and how hard it was moving. Uploaded each frame
   * with the heat already faded by age.
   */
  const trail = useRef({
    points: Array.from({ length: TRAIL }, () => ({ x: 0, y: 0, born: -99, heat: 0 })),
    next: 0,
    lastX: NaN,
    lastY: NaN,
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uIntensity: { value: 1 },
      uCalm: { value: 0 },
      uEnd: { value: 0 },
      uBusiness: { value: 0 },
      uSpill: { value: 0 },
      uSpillOn: { value: 0 },
      uSpillSeed: { value: [0, 0] },
      uMaskOnly: { value: 0 },
      uGrid: { value: 1 },
      uDpr: { value: 1 },
      uGrain: { value: 0 },
      uScroll: { value: 0 },
      uLift: { value: 0 },
      uPhoneGrid: { value: 0 },
      uBlobA: {
        value: BLOB_PARAMS.map(([x, y, rx, ry]) => new Vector4(x, y, 1 / rx, 1 / ry)),
      },
      uBlobB: {
        value: BLOB_PARAMS.map(
          ([, , , , a, amp, core]) => new Vector4(Math.cos(a), Math.sin(a), amp, core),
        ),
      },
      uTaper: { value: BLOB_PARAMS.map((b) => b[7]) },
      uTrail: { value: Array.from({ length: TRAIL }, () => new Vector4(0, 0, 0, 0.1)) },
      uTrailEdge: { value: 1 },
      uRamp: { value: RAMP.map(([, c]) => hex(c)) },
      uRampAt: { value: RAMP.map(([at]) => at) },
      // The party face's ground. Dark: the hues below are mixed *onto* it,
      // so over a deep base they read as glow rather than as airbrush.
      uPaper: { value: new Color("#0a0b0e") },
      // This quad is opaque and covers the viewport, so it *is* the page
      // background — the `--paper` token never shows through it, and the two
      // must be kept in step with globals.css.
      //
      // Raw sRGB components, unlike the hues below: a ShaderMaterial writes
      // straight to the sRGB framebuffer, and a THREE.Color would be converted
      // into linear working space on the way in and land several shades darker.
      // It matters here because this is a near-white the eye can measure.
      // The calm tone the hero's grey settles into below it. Kept in step
      // with the --paper token.
      uBusinessPaper: { value: [1, 1, 1] },
      uQuadCoords: { value: 0 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const m = material.current;
    if (!m) return;
    // `thermal` is still published for the Ticket, but the backdrop no longer
    // reacts to it — the statements block keeps the same ground as everywhere
    // else now.
    const { backdrop, reducedMotion } = scrollState;
    const dpr = gl.getPixelRatio();
    m.uniforms.uResolution.value = [size.width * dpr, size.height * dpr];
    m.uniforms.uDpr.value = dpr;
    // Party face only: the business face has no grid. Eased off businessMix,
    // so it fades out with the switch rather than vanishing.
    m.uniforms.uGrid.value = scrollState.grid * (1 - scrollState.businessMix);
    // Party face only — the business ground is clean stock.
    // Subtle, a touch under the original 0.075. 0.11 and 0.09 read as TV
    // static; an ordered (Bayer) dither was tried with it and removed — its
    // 4x4 pattern showed as fine lines on the smooth gradients.
    // Scaled per pixel in the shader, by how much of it is still light.
    // Lighter on phones: drawn at a low pixel ratio there and scaled up, each
    // grain is a few device pixels wide and read as a crawling static.
    m.uniforms.uGrain.value = mobile ? 0.035 : 0.06;
    m.uniforms.uQuadCoords.value = mobile ? 1 : 0;
    m.uniforms.uPhoneGrid.value = mobile ? 1 : 0;
    m.uniforms.uTime.value = reducedMotion ? 12 : clock.elapsedTime;
    m.uniforms.uIntensity.value = backdrop;
    m.uniforms.uCalm.value = scrollState.calm;
    m.uniforms.uEnd.value = scrollState.end;
    m.uniforms.uScroll.value = (scrollState.y / Math.max(1, scrollState.vh)) * PARALLAX;
    // Portrait screens: the composition is a landscape one stretched over a
    // tall screen, which left its black top as the upper ~40% of a phone.
    // Lifted up the field there (0 on landscape, PORTRAIT_LIFT at a phone's
    // ~0.46), so the colour comes up behind the wordmark too.
    const aspect = size.width / Math.max(1, size.height);
    m.uniforms.uLift.value = PORTRAIT_LIFT * Math.min(1, Math.max(0, (1 - aspect) / 0.54));
    m.uniforms.uBusiness.value = scrollState.businessMix;

    // The spill, light to dark only: started when the target face flips to
    // party, run on its own clock (not businessMix, whose ease the rest of
    // the scene's sequencing is built on), with a fresh random seed so no two
    // spills are alike. Going back to light drops it, and the ground
    // crossfades as before. Not under reduced motion.
    const sp = spill.current;
    if (scrollState.business !== sp.target) {
      const toDark = sp.target === 1 && scrollState.business === 0;
      sp.target = scrollState.business;
      sp.on = toDark && !reducedMotion;
      sp.start = clock.elapsedTime;
      if (sp.on) {
        m.uniforms.uSpillSeed.value = [Math.random() * 40, Math.random() * 40];
        // The glass word waits for the colour to fill the screen.
        scrollState.wordGate = scrollState.wordGateMix = 0;
      }
    }
    const k = Math.min(1, (clock.elapsedTime - sp.start) / SPILL_S);
    // Released while the last patches are still closing (by 0.8 of the
    // time the ease-out has covered ~96% of the way), so the word arrives
    // with the end of the spill rather than after it. (At the very end it
    // read as late; at 0.65 a touch early.)
    scrollState.wordGate = sp.on && k < WORD_AT ? 0 : 1;
    // Ease out: most of the screen goes at once — the dark face's white type
    // is already up, and the edges, where it sits, go first — and the last
    // patches of white close more gently in the middle.
    m.uniforms.uSpill.value = 1 - (1 - k) ** 2;
    m.uniforms.uSpillOn.value = sp.on ? 1 : 0;

    // While chrome/spill.ts holds the light site's snapshot over the page,
    // hand it the spill as a mask: the same shader in mask mode, at a quarter
    // of the screen's size, read back and passed to CSS as a data URL. The
    // snapshot then shows exactly where the white would, so the colour field
    // reads as covering the site rather than a blank page.
    if (scrollState.spillMask && sp.on) {
      const mk = maskPass.current ?? (maskPass.current = makeMaskPass());
      const w = Math.max(2, Math.round(size.width / 4));
      const h = Math.max(2, Math.round(size.height / 4));
      if (mk.target.width !== w || mk.target.height !== h) {
        mk.target.setSize(w, h);
        mk.canvas.width = w;
        mk.canvas.height = h;
        mk.pixels = new Uint8Array(w * h * 4);
        mk.image = mk.ctx?.createImageData(w, h) ?? null;
      }
      mk.quad.material = m;
      const resolution = m.uniforms.uResolution.value;
      m.uniforms.uResolution.value = [w, h];
      m.uniforms.uMaskOnly.value = 1;
      gl.setRenderTarget(mk.target);
      gl.render(mk.scene, mk.camera);
      gl.setRenderTarget(null);
      m.uniforms.uMaskOnly.value = 0;
      m.uniforms.uResolution.value = resolution;
      gl.readRenderTargetPixels(mk.target, 0, 0, w, h, mk.pixels);
      if (mk.ctx && mk.image) {
        // GL rows run bottom-up; the mask is the grey, as alpha.
        for (let y = 0; y < h; y++) {
          const from = (h - 1 - y) * w * 4;
          const to = y * w * 4;
          for (let x = 0; x < w; x++) {
            mk.image.data[to + x * 4 + 3] = mk.pixels[from + x * 4];
          }
        }
        mk.ctx.putImageData(mk.image, 0, 0);
        document.documentElement.style.setProperty("--spill-mask", `url(${mk.canvas.toDataURL()})`);
      }
    }

    // The heat trail: a new point each time the pointer has moved a little,
    // hotter the faster it went — a thin line, close-spaced so it reads as
    // one stroke. The hero only: points drop only over it, and the shader
    // cuts the glow off at its bottom edge, so "Who are we" never gets it.
    // Party face only, and not under reduced motion; old points fade out.
    const now = clock.elapsedTime;
    const tr = trail.current;
    const { pointer, pointerActive } = scrollState;
    const heroBottom = document.getElementById("hero")?.getBoundingClientRect().bottom ?? 0;
    const edge = heroBottom / Math.max(1, size.height);
    m.uniforms.uTrailEdge.value = edge;
    const x = (pointer.x + 1) / 2;
    const y = (1 - pointer.y) / 2;
    if (pointerActive && !reducedMotion && scrollState.businessMix < 0.5 && y < edge) {
      const moved = Number.isNaN(tr.lastX) ? 0 : Math.hypot((x - tr.lastX) * (size.width / size.height), y - tr.lastY);
      if (moved > 0.006) {
        const point = tr.points[tr.next];
        point.x = x;
        point.y = y;
        point.born = now;
        point.heat = Math.min(0.9, 0.45 + moved * 8);
        tr.next = (tr.next + 1) % TRAIL;
        tr.lastX = x;
        tr.lastY = y;
      } else if (Number.isNaN(tr.lastX)) {
        tr.lastX = x;
        tr.lastY = y;
      }
    }
    const slots = m.uniforms.uTrail.value as Vector4[];
    tr.points.forEach((point, i) => {
      const age = (now - point.born) / TRAIL_LIFE;
      const fade = age >= 1 ? 0 : (1 - age) * (1 - age);
      // Thins as it cools, so the line tapers off behind the pointer.
      slots[i].set(point.x, point.y, point.heat * fade, 0.022 * (1 - 0.7 * Math.min(1, age)));
    });
  });

  return (
    <ScreenQuad renderOrder={-1} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        defines={defines}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthTest={false}
        depthWrite={false}
      />
    </ScreenQuad>
  );
}
