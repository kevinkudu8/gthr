"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, DoubleSide, TextureLoader, type Mesh, type ShaderMaterial, type Texture } from "three";
import { useMode } from "@/components/mode/ModeProvider";
import { scrollState } from "./scrollState";

/**
 * Every `[data-bend]` element in the DOM (with `data-src`) gets a WebGL plane
 * drawn exactly over it, textured with the same image, that bows with scroll
 * velocity — the reference's bending thumbnails. The DOM image is kept for
 * layout and accessibility but made invisible (see .bend-source in CSS).
 * `data-gray` renders it black-and-white; `data-radius` rounds the corners.
 */

const vertexShader = /* glsl */ `
  uniform float uBend;
  uniform float uCurve;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // A little bow of the top/bottom edges in the direction of travel.
    float s = sin(uv.x * 3.14159265);
    p.y += s * uBend;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    // The curved screen, concave: wrap world space onto a cylinder whose
    // axis runs across the viewport, with the viewer inside it — images near
    // the top and bottom edges lean in toward the camera while the centre
    // sits back. Radius shrinks with scroll speed; flat again at rest.
    float r = 1.0 / max(uCurve, 1e-4);
    float a = wp.y / r;
    wp.y = r * sin(a);
    wp.z += r * (1.0 - cos(a));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uGray;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform vec2 uCoverScale;
  uniform vec2 uCoverOffset;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv * uCoverScale + uCoverOffset;
    vec4 c = texture2D(uMap, uv);
    float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    // Neutral mono. It was sepia-tinted (1.04, 1.0, 0.94), which is what read
    // as the sand cast on the team photos.
    vec3 mono = vec3(l);
    c.rgb = mix(c.rgb, mono, uGray);
    // Rounded corners: signed distance to a rounded rect, in pixels.
    vec2 px = vUv * uSize;
    vec2 d = min(px, uSize - px);
    float corner = length(max(vec2(uRadius) - d, 0.0)) - uRadius;
    // With no radius the distance is 0 everywhere, which would read as a
    // half-covered edge — so square images are simply fully opaque.
    float alpha = uRadius > 0.0 ? 1.0 - smoothstep(-1.0, 1.0, corner) : 1.0;
    gl_FragColor = vec4(c.rgb, c.a * alpha * uOpacity);
  }
`;

/**
 * Rasterise a polaroid: off-white frame with a deep bottom border, the photo
 * cover-fitted into its well, and the caption (name / initial) in the page's
 * mono font. Measured from the live DOM so it matches the layout exactly.
 */
function paintPolaroid(figure: HTMLElement, img: HTMLImageElement) {
  const scale = 2;
  const rect = figure.getBoundingClientRect();
  const well = figure.querySelector<HTMLElement>("[data-photo-well]")?.getBoundingClientRect() ?? rect;
  const caption = figure.querySelector<HTMLElement>("figcaption");
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(rect.width * scale));
  canvas.height = Math.max(2, Math.round(rect.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  const w = rect.width;
  const h = rect.height;
  const r = 4;
  // The frame colour follows the face, so it is read from the token rather
  // than hard-coded — see `--frame` in globals.css.
  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue("--frame").trim() || "#ffffff";
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fill();
  // Photo, object-fit: cover.
  const wx = well.left - rect.left;
  const wy = well.top - rect.top;
  const ww = well.width;
  const wh = well.height;
  const ia = img.width / img.height;
  const wa = ww / wh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ia > wa) { sw = img.height * wa; sx = (img.width - sw) / 2; } else { sh = img.width / wa; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, wx, wy, ww, wh);
  // Caption.
  if (caption) {
    const cs = getComputedStyle(caption);
    const cr = caption.getBoundingClientRect();
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textBaseline = "alphabetic";
    caption.querySelectorAll("span").forEach((span, i) => {
      const sr = span.getBoundingClientRect();
      ctx.fillStyle = getComputedStyle(span).color;
      ctx.textAlign = i === 0 ? "left" : "right";
      ctx.fillText(span.textContent ?? "", (i === 0 ? sr.left : sr.right) - rect.left, cr.bottom - rect.top - 3);
    });
  }
  return canvas;
}

type Source = {
  el: HTMLElement;
  src: string;
  gray: number;
  radius: number;
  /** Composite the element's polaroid frame + caption around the photo. */
  frame: boolean;
  /** Fade out as the statements block comes into view. */
  fadeOnStatements: boolean;
};

export function BendImages() {
  const [sources, setSources] = useState<Source[]>([]);
  // A painted polaroid bakes the frame and caption colours into its texture,
  // and both follow the face — so a mode change has to repaint it.
  const mode = useMode().mode;

  useEffect(() => {
    const collect = () =>
      setSources(
        [...document.querySelectorAll<HTMLElement>("[data-bend]")].map((el) => ({
          el,
          src: el.dataset.src ?? "",
          gray: el.hasAttribute("data-gray") ? 1 : 0,
          radius: Number(el.dataset.radius ?? 0),
          frame: el.hasAttribute("data-frame"),
          fadeOnStatements: el.hasAttribute("data-fade-statements"),
        })),
      );
    collect();
    const observer = new MutationObserver(collect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {sources.map((source) => (
        <BendPlane key={`${source.src}${source.gray}${source.frame ? mode : ""}`} source={source} />
      ))}
    </>
  );
}

function BendPlane({ source }: { source: Source }) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const [texture, setTexture] = useState<Texture | null>(null);
  const bend = useRef(0);
  const curve = useRef(0);
  const { viewport, size } = useThree();

  useEffect(() => {
    let alive = true;
    // Leave textures un-decoded: a ShaderMaterial writes straight to the sRGB
    // framebuffer, so passing sRGB texels through is the correct result.
    if (!source.frame) {
      new TextureLoader().load(source.src, (tex) => {
        if (alive) setTexture(tex);
      });
    } else {
      // Paint the whole polaroid — frame, photo, caption — so it bends as one.
      const img = new Image();
      img.onload = () => {
        if (alive) setTexture(new CanvasTexture(paintPolaroid(source.el, img)));
      };
      img.src = source.src;
    }
    return () => {
      alive = false;
    };
  }, [source.src, source.frame, source.el]);

  const uniforms = useMemo(
    () => ({
      uMap: { value: null as Texture | null },
      uBend: { value: 0 },
      uCurve: { value: 0 },
      uGray: { value: source.gray },
      uSize: { value: [1, 1] },
      uRadius: { value: source.radius },
      uCoverScale: { value: [1, 1] },
      uCoverOffset: { value: [0, 0] },
      uOpacity: { value: 1 },
    }),
    [source.gray, source.radius],
  );

  useFrame((_, delta) => {
    const m = mesh.current;
    const mat = material.current;
    if (!m || !mat || !texture) return;
    const rect = source.el.getBoundingClientRect();
    const onScreen = rect.bottom > -200 && rect.top < size.height + 200;
    m.visible = onScreen && rect.width > 0;
    if (!m.visible) return;

    // DOM rect → world units on the z = 0.6 plane.
    const vp = viewport.getCurrentViewport(undefined, [0, 0, 0.6]);
    const sx = vp.width / size.width;
    const sy = vp.height / size.height;
    m.position.set(
      (rect.left + rect.width / 2 - size.width / 2) * sx,
      -(rect.top + rect.height / 2 - size.height / 2) * sy,
      0.6,
    );
    m.scale.set(rect.width * sx, rect.height * sy, 1);

    // object-fit: cover
    const img = texture.image as { width: number; height: number };
    const planeAspect = rect.width / rect.height;
    const imageAspect = img.width / img.height;
    if (imageAspect > planeAspect) {
      const s = planeAspect / imageAspect;
      mat.uniforms.uCoverScale.value = [s, 1];
      mat.uniforms.uCoverOffset.value = [(1 - s) / 2, 0];
    } else {
      const s = imageAspect / planeAspect;
      mat.uniforms.uCoverScale.value = [1, s];
      mat.uniforms.uCoverOffset.value = [0, (1 - s) / 2];
    }
    mat.uniforms.uSize.value = [rect.width, rect.height];
    mat.uniforms.uMap.value = texture;
    mat.uniforms.uOpacity.value = source.fadeOnStatements
      ? 1 - Math.min(1, scrollState.thermal / 0.22)
      : 1;

    // Both follow smoothed scroll velocity. uBend is plane-local (a 1×1 plane
    // before scale); uCurve is 1/radius in world units — 0 means flat.
    const v = scrollState.reducedMotion ? 0 : scrollState.velocity;
    const bendTarget = Math.max(-0.09, Math.min(0.09, v * 0.0012));
    const curveTarget = Math.min(0.315, Math.abs(v) * 0.00525);
    const k = 1 - Math.exp(-delta * 7);
    bend.current += (bendTarget - bend.current) * k;
    curve.current += (curveTarget - curve.current) * k;
    mat.uniforms.uBend.value = bend.current;
    mat.uniforms.uCurve.value = curve.current;
  });

  if (!texture) return null;
  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[1, 1, 32, 32]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        side={DoubleSide}
      />
    </mesh>
  );
}
