/**
 * CPU-side value noise, for geometry and textures that are built once at mount
 * (terrain heights, the letters' iridescence thickness map). Shader noise lives
 * in the shaders that need it; this is deliberately the plain, deterministic,
 * readable version — it never runs per frame.
 */

/**
 * Integer bit-mix rather than the usual `fract(sin(dot(...)))`. Same job, but
 * the terrain evaluates this a few million times at mount and the sine version
 * measured ~1.6x slower — which is the difference between a dense field and a
 * visible hitch. Lattice coordinates are always integers here, so the `|0`
 * coercions are free.
 */
const hash = (x: number, y: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const fade = (t: number) => t * t * (3 - 2 * t);

/**
 * `period` > 0 wraps the lattice, so the field tiles seamlessly over that many
 * units — needed for anything sampled into a repeating texture.
 */
export function valueNoise(x: number, y: number, period = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const wrap = (n: number) => (period > 0 ? ((n % period) + period) % period : n);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const x0 = wrap(xi);
  const x1 = wrap(xi + 1);
  const y0 = wrap(yi);
  const y1 = wrap(yi + 1);
  const a = hash(x0, y0);
  const b = hash(x1, y0);
  const c = hash(x0, y1);
  const d = hash(x1, y1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/** Octaves of `valueNoise`, normalised to 0..1. */
export function fbm(x: number, y: number, octaves = 4, period = 0) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    // The period has to scale with the frequency to stay on the lattice.
    sum += amplitude * valueNoise(x * frequency, y * frequency, period * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}
