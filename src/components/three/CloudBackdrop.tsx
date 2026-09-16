"use client";

import { ScreenQuad } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type ShaderMaterial } from "three";
import { scrollState } from "./scrollState";

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Soft airbrushed blobs, after the poster: several low-frequency noise fields,
// each driving one hue with a wide, feathered edge. Three octaves is plenty.
const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uIntensity;
  uniform float uWarm;
  uniform float uThermal;
  uniform float uSwirl;
  uniform float uBusiness;
  uniform vec3 uPaper;
  uniform vec3 uBusinessPaper;
  uniform vec3 uTeal;
  uniform vec3 uMint;
  uniform vec3 uTerra;
  uniform vec3 uSun;
  uniform vec3 uPink;
  uniform vec3 uSky;
  uniform vec3 uLime;
  uniform float uGrid;
  uniform float uDpr;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  // Thermal-camera bands: pale → pink → blue → orange → white, then back to
  // paper. Applied to a soft field, it draws rainbow rims around each blob.
  vec3 thermal(float x) {
    vec3 pale = vec3(0.90, 0.96, 0.80);
    vec3 white = vec3(1.0);
    vec3 c = mix(uPaper, pale, smoothstep(0.00, 0.30, x));
    c = mix(c, uPink,  smoothstep(0.30, 0.44, x));
    c = mix(c, uSky,   smoothstep(0.44, 0.56, x));
    c = mix(c, uTerra, smoothstep(0.56, 0.68, x));
    c = mix(c, white,  smoothstep(0.68, 0.80, x));
    c = mix(c, pale,   smoothstep(0.80, 0.92, x));
    return c;
  }

  void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    uv.x *= aspect;
    vec2 ptr = uPointer * vec2(aspect, 1.0);
    float pd = distance(uv, ptr);

    // The field leans toward the pointer and swirls around it, so the blobs
    // visibly follow the hand.
    vec2 p = uv * 0.75;
    float near = smoothstep(1.7, 0.0, pd);
    float angle = near * 0.35 * uSwirl;
    vec2 rel = uv - ptr;
    rel = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * rel;
    p = (ptr + rel) * 0.75;
    p += (ptr - uv) * near * 0.22;

    float t = uTime * 0.07;
    float n1 = fbm(p * 0.9 + vec2(t, -t * 0.6));
    float n2 = fbm(p * 0.8 + vec2(4.1, 2.3) + vec2(-t * 0.8, t * 0.5));
    float n3 = fbm(p * 1.0 + vec2(9.4, 5.7) + vec2(t * 0.5, t * 0.9));
    float n4 = fbm(p * 0.7 + vec2(2.2, 8.8) + vec2(-t * 0.4, -t * 0.7));
    float n5 = fbm(p * 1.1 + vec2(6.6, 1.1) + vec2(t * 0.9, -t * 0.3));
    float n6 = fbm(p * 0.85 + vec2(3.3, 7.7) + vec2(-t * 0.6, t * 0.4));

    // Airbrush on white: each hue is a soft-edged blob; later ones sit on top.
    vec3 col = uPaper;
    col = mix(col, uSky,   smoothstep(0.34, 0.76, n1));
    col = mix(col, uLime,  smoothstep(0.42, 0.80, n6) * 0.95);
    col = mix(col, uMint,  smoothstep(0.46, 0.84, n2) * 0.9);
    col = mix(col, uTerra, smoothstep(0.42, 0.80, n3) * uWarm);
    col = mix(col, uSun,   smoothstep(0.40, 0.78, n4) * uWarm);
    col = mix(col, uPink,  smoothstep(0.42, 0.80, n5) * uWarm * 0.95);
    col = mix(col, uPink,  smoothstep(0.7, 0.0, pd) * 0.08);

    // In the statements block, remap a warped field through the thermal bands.
    if (uThermal > 0.001) {
      float field = fbm(p * 1.15 + vec2(n2, n4) * 1.6 + vec2(t * 0.7, -t * 0.5));
      float x = smoothstep(0.28, 0.78, field);
      col = mix(col, thermal(x), uThermal);
    }

    // Hold the edges near paper so the chrome and gutters stay legible.
    float vig = smoothstep(1.4, 0.35, length(uv / vec2(aspect, 1.0)));
    // The business face is a clean white ground: the colour field fades out
    // and the paper itself goes to white.
    float strength = uIntensity * (0.15 + 0.85 * vig) * (1.0 - uBusiness);
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

      // Matches the --ink-rgb tokens either side of the toggle.
      vec3 ink = mix(vec3(11.0, 16.0, 14.0) / 255.0, vec3(0.0), uBusiness);
      col2 = mix(col2, ink, line * 0.1 * uGrid);
      col2 = mix(col2, ink, cross * 0.45 * uGrid);
    }

    gl_FragColor = vec4(col2, 1.0);
  }
`;

/**
 * Full-screen airbrushed colour field behind everything. Strength and warmth
 * follow the section on screen (see scrollState); the field drifts toward
 * the pointer.
 */
export function CloudBackdrop() {
  const material = useRef<ShaderMaterial>(null);
  const { gl, size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uPointer: { value: [0, 0] },
      uIntensity: { value: 1 },
      uWarm: { value: 1 },
      uThermal: { value: 0 },
      uSwirl: { value: 1 },
      uBusiness: { value: 0 },
      uGrid: { value: 1 },
      uDpr: { value: 1 },
      uPaper: { value: new Color("#f4f3ee") },
      // This quad is opaque and covers the viewport, so it *is* the page
      // background — the `--paper` token never shows through it, and the two
      // must be kept in step with globals.css.
      //
      // Raw sRGB components, unlike the hues below: a ShaderMaterial writes
      // straight to the sRGB framebuffer, and a THREE.Color would be converted
      // into linear working space on the way in and land several shades darker.
      // It matters here because this is a near-white the eye can measure.
      uBusinessPaper: { value: [0xf4 / 255, 0xf4 / 255, 0xf3 / 255] },
      uTeal: { value: new Color("#1d6b58") },
      uMint: { value: new Color("#04ea98") },
      uTerra: { value: new Color("#ff7a3d") },
      uSun: { value: new Color("#ffd640") },
      uPink: { value: new Color("#ff62b8") },
      uSky: { value: new Color("#3d8dff") },
      uLime: { value: new Color("#9beb3c") },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const m = material.current;
    if (!m) return;
    const { backdrop, warm, thermal, pointer, pointerActive, reducedMotion } = scrollState;
    const dpr = gl.getPixelRatio();
    m.uniforms.uResolution.value = [size.width * dpr, size.height * dpr];
    m.uniforms.uDpr.value = dpr;
    m.uniforms.uGrid.value = scrollState.grid;
    m.uniforms.uTime.value = reducedMotion ? 12 : clock.elapsedTime;
    m.uniforms.uIntensity.value = backdrop;
    m.uniforms.uWarm.value = warm;
    m.uniforms.uThermal.value = thermal;
    m.uniforms.uSwirl.value = reducedMotion ? 0 : 1;
    m.uniforms.uBusiness.value = scrollState.businessMix;
    m.uniforms.uPointer.value = pointerActive ? [pointer.x, pointer.y] : [0.3, 0.2];
  });

  return (
    <ScreenQuad renderOrder={-1} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthTest={false}
        depthWrite={false}
      />
    </ScreenQuad>
  );
}
