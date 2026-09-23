/**
 * Canvas painting shared by the baked prop textures (Badge, Ticket): the page's
 * fonts, and the party face's colour field — the same ramp and blob profile
 * CloudBackdrop draws on the GPU, sampled here on the CPU so a prop can be cut
 * from the same stuff the site is set on.
 */
import { RAMP } from "./CloudBackdrop";

export type Fonts = { sans: string; mono: string };

/** Fonts as the page loaded them (next/font hashes the family names). */
export function pageFonts(): Fonts {
  const sans = getComputedStyle(document.body).fontFamily;
  const mono = getComputedStyle(document.querySelector("time") ?? document.body).fontFamily;
  return { sans, mono };
}

/** `RAMP` as numbers, for sampling on the CPU. */
const RAMP_RGB = RAMP.map(([at, hex]) => [
  at,
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
]);

export function rampAt(h: number): [number, number, number] {
  for (let i = 1; i < RAMP_RGB.length; i++) {
    const [b, br, bg, bb] = RAMP_RGB[i];
    if (h <= b || i === RAMP_RGB.length - 1) {
      const [a, ar, ag, ab] = RAMP_RGB[i - 1];
      const k = Math.min(1, Math.max(0, (h - a) / (b - a)));
      return [ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k];
    }
  }
  return [0, 0, 0];
}

/** Deterministic 0..1 noise from integer coordinates — identical on every repaint. */
export function hash2(x: number, y: number) {
  let n = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  n = (n ^ (n >>> 13)) >>> 0;
  return n / 4294967296;
}

/** One blob, in canvas-fraction space: x, y, rx, ry, angle, amp, flat-core radius. */
export type Blob = readonly [number, number, number, number, number, number, number];

/**
 * Fill the whole canvas with the colour field. `lo`/`hi` remap the summed heat
 * onto a slice of the ramp — the full 0..1 runs black -> colour -> black;
 * a foil wants only the bright middle. `grain` is the film-grain amplitude.
 */
export function paintThermal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  blobs: readonly Blob[],
  { lo = 0, hi = 1, grain = 22 }: { lo?: number; hi?: number; grain?: number } = {},
) {
  const img = ctx.createImageData(w, h);
  const bs = blobs.map(([x, y, rx, ry, a, amp, core]) => ({
    x, y, irx: 1 / rx, iry: 1 / ry, c: Math.cos(a), s: Math.sin(a), amp, core,
  }));
  const aspect = h / w;
  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      let heat = 0;
      for (const b of bs) {
        const dx = u - b.x;
        const dy = (v - b.y) * aspect;
        const bu = (b.c * dx + b.s * dy) * b.irx;
        const bv = (-b.s * dx + b.c * dy) * b.iry;
        const r = Math.max(Math.hypot(bu, bv) - b.core, 0);
        heat += b.amp * Math.exp(-r * r);
      }
      const [r, g, bl] = rampAt(lo + (hi - lo) * Math.min(1, Math.max(0, heat)));
      const n = (hash2(px, py) - 0.5) * grain;
      const o = (py * w + px) * 4;
      img.data[o] = r + n;
      img.data[o + 1] = g + n;
      img.data[o + 2] = bl + n;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Paper stock: a flat tone with fine grain, for printed pieces. */
export function paintPaper(ctx: CanvasRenderingContext2D, w: number, h: number, tone: [number, number, number], grain = 10) {
  const img = ctx.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const n = (hash2(px, py) - 0.5) * grain;
      const o = (py * w + px) * 4;
      img.data[o] = tone[0] + n;
      img.data[o + 1] = tone[1] + n;
      img.data[o + 2] = tone[2] + n;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
