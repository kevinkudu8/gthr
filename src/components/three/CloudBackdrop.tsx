"use client";

import { ScreenQuad } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Vector3, Vector4, type ShaderMaterial } from "three";
import { scrollState } from "./scrollState";

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// The party ground is a procedural thermal field (see below); the business
// ground is clean paper. Everything else here is the hairline grid and the film grain,
// both of which have to live in this shader because it is the only thing that
// draws behind the 3D objects.
const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIntensity;
  uniform float uBusiness;
  uniform vec3 uPaper;
  uniform vec3 uBusinessPaper;
  uniform float uGrid;
  uniform float uDpr;
  uniform float uGrain;
  uniform float uScroll;
  uniform vec4 uBlobA[BLOBS];
  uniform vec4 uBlobB[BLOBS];
  uniform float uTaper[BLOBS];
  uniform vec3 uRamp[STOPS];
  uniform float uRampAt[STOPS];

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

  /* The scalar field goes through a thermal ramp that runs black -> red ->
     orange -> amber -> teal -> navy -> back to black, sampled from the
     reference. The ramp returning to black is why the core of the big mass is
     dark again: it is the *hottest* point, not an absence. */
  vec3 thermal(float h) {
    vec3 col = uRamp[0];
    for (int i = 1; i < STOPS; i++) {
      float k = clamp((h - uRampAt[i - 1]) / (uRampAt[i] - uRampAt[i - 1]), 0.0, 1.0);
      col = mix(col, uRamp[i], k);
    }
    return col;
  }

  void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
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
    vec2 sv = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uResolution;
    float span = REF_W * clamp(aspect / REF_W, 0.5, 1.0);
    vec2 p = vec2(0.5 * REF_W + (sv.x - 0.5) * span, sv.y + uScroll);
    // A slow, low-amplitude warp so edges stay organic as they drift.
    p += vec2(sin(p.y * 5.1 + p.x * 2.3 + uTime * 0.07),
              sin(p.x * 4.3 - p.y * 1.7 - uTime * 0.05)) * 0.022;

    p.x += 0.25 * smoothstep(0.9, 1.8, p.y)
      * (sin(p.y * 1.9 + 0.8 + uTime * 0.03) + 0.5 * sin(p.y * 3.7 - p.x * 1.1));
    float fy = mod(p.y, 2.0 * FOLD);
    fy = fy < FOLD ? fy : 2.0 * FOLD - fy;
    fy = EXTEND - log(1.0 + exp((EXTEND - fy) / 0.1)) * 0.1;
    float heat = composition(vec2(p.x, fy), uTime);
    vec3 col = thermal(clamp(heat, 0.0, 1.0));

    // Hold the edges near paper so the chrome and gutters stay legible.
    float vig = smoothstep(1.4, 0.35, length(uv / vec2(aspect, 1.0)));
    // The business face is a clean white ground: the colour field fades out
    // and the paper itself goes to white.
    // Held high everywhere: the ramp is the party face's ground now, so
    // section intensity only trims it rather than fading it back to flat.
    // The vignette still darkens the gutters, which is what keeps the chrome
    // and the hairline grid legible over the warm band.
    float strength = (0.88 + 0.12 * uIntensity) * mix(0.80, 1.0, vig) * (1.0 - uBusiness);
    vec3 paper = mix(uPaper, uBusinessPaper, uBusiness);
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
      vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
      float w = uResolution.x / uDpr;
      float h = uResolution.y / uDpr;
      float gutter = w >= 1024.0 ? 56.0 : 16.0;

      float line = 0.0;
      float cross = 0.0;
      for (int k = 0; k < 4; k++) {
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

      // Matches the --ink-rgb tokens either side of the toggle. The party face
      // is dark now, so its hairlines are white — dark ones were invisible.
      vec3 ink = mix(vec3(1.0), vec3(0.0), uBusiness);
      col2 = mix(col2, ink, line * 0.1 * uGrid);
      col2 = mix(col2, ink, cross * 0.45 * uGrid);
    }

    /* Film grain. Applied last, over everything including the grid, and at a
       constant amplitude rather than one scaled by brightness — grain that
       fades out of the shadows is what makes a dark gradient look like a flat
       fill. Sized in device pixels so it stays fine on a retina screen, and
       reseeded each frame so it shimmers the way real grain does rather than
       sitting on the image as a fixed pattern. */
    float g = hash(floor(gl_FragCoord.xy / max(1.0, uDpr * 0.5)) + fract(uTime) * 91.7);
    col2 += (g - 0.5) * uGrain;

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
  [0, "05090c"], [0.12, "27090a"], [0.22, "670809"], [0.32, "ab0609"],
  [0.4, "e8180c"], [0.46, "fb4811"], [0.52, "f76f1c"], [0.58, "de8330"],
  [0.64, "b98640"], [0.7, "6e7d56"], [0.76, "317068"], [0.81, "0b5d6d"],
  [0.86, "02445f"], [0.91, "022c42"], [0.95, "031624"], [1, "060a0e"],
];

const defines = { BLOBS: BLOB_PARAMS.length, STOPS: RAMP.length };

const hex = (s: string) =>
  new Vector3(
    parseInt(s.slice(0, 2), 16) / 255,
    parseInt(s.slice(2, 4), 16) / 255,
    parseInt(s.slice(4, 6), 16) / 255,
  );

/** How fast the ground travels against the page: below 1 it sits behind it. */
const PARALLAX = 0.75;

/**
 * Full-screen thermal colour field behind everything, scrolling with the page.
 * The business face fades it to clean paper.
 */
export function CloudBackdrop() {
  const material = useRef<ShaderMaterial>(null);
  const { gl, size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uIntensity: { value: 1 },
      uBusiness: { value: 0 },
      uGrid: { value: 1 },
      uDpr: { value: 1 },
      uGrain: { value: 0 },
      uScroll: { value: 0 },
      uBlobA: {
        value: BLOB_PARAMS.map(([x, y, rx, ry]) => new Vector4(x, y, 1 / rx, 1 / ry)),
      },
      uBlobB: {
        value: BLOB_PARAMS.map(
          ([, , , , a, amp, core]) => new Vector4(Math.cos(a), Math.sin(a), amp, core),
        ),
      },
      uTaper: { value: BLOB_PARAMS.map((b) => b[7]) },
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
      uBusinessPaper: { value: [0xf4 / 255, 0xf4 / 255, 0xf3 / 255] },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const m = material.current;
    if (!m) return;
    // `thermal` is still published for the Badge, but the backdrop no longer
    // reacts to it — the statements block keeps the same ground as everywhere
    // else now.
    const { backdrop, reducedMotion } = scrollState;
    const dpr = gl.getPixelRatio();
    m.uniforms.uResolution.value = [size.width * dpr, size.height * dpr];
    m.uniforms.uDpr.value = dpr;
    m.uniforms.uGrid.value = scrollState.grid;
    // Party face only — the business ground is clean stock.
    m.uniforms.uGrain.value = 0.075 * (1 - scrollState.businessMix);
    m.uniforms.uTime.value = reducedMotion ? 12 : clock.elapsedTime;
    m.uniforms.uIntensity.value = backdrop;
    m.uniforms.uScroll.value = (scrollState.y / Math.max(1, scrollState.vh)) * PARALLAX;
    m.uniforms.uBusiness.value = scrollState.businessMix;
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
