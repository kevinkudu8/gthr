/**
 * Flat 2D stickers, drawn as SVG strings and rasterised to textures at
 * runtime (see Stickers.tsx). In the spirit of a printed sticker sheet:
 * solid fills, black line work, mono labels, a few pixel pieces.
 * `w`/`h` are the design's aspect box; world size is decided by the caller.
 */

export type StickerDef = { id: string; w: number; h: number; svg: string };

const MONO = "ui-monospace, Menlo, 'Martian Mono', monospace";

const wrap = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 3}" height="${h * 3}">${body}</svg>`;

/** Rounded blob with three coil rings. */
const coil: StickerDef = {
  id: "coil",
  w: 200,
  h: 200,
  svg: wrap(200, 200, `
    <rect width="200" height="200" rx="64" fill="#ff7a3d"/>
    <g fill="none" stroke="#0b100e" stroke-width="6">
      <ellipse cx="100" cy="62" rx="72" ry="26"/>
      <ellipse cx="100" cy="100" rx="72" ry="26"/>
      <ellipse cx="100" cy="138" rx="72" ry="26"/>
    </g>`),
};

/** Rounded triangle with an asterisk. */
const asterisk: StickerDef = {
  id: "asterisk",
  w: 200,
  h: 180,
  svg: wrap(200, 180, `
    <path d="M100 10 Q114 10 121 22 L192 146 Q199 160 190 170 Q184 176 172 176 L28 176 Q16 176 10 170 Q1 160 8 146 L79 22 Q86 10 100 10Z" fill="#3d8dff"/>
    <g stroke="#0b100e" stroke-width="16" stroke-linecap="round">
      <line x1="100" y1="66" x2="100" y2="146"/>
      <line x1="66" y1="86" x2="134" y2="126"/>
      <line x1="134" y1="86" x2="66" y2="126"/>
    </g>`),
};

/** Pixel invader with a white sticker outline. */
const invader: StickerDef = (() => {
  const rows = [
    "..X.....X..",
    "...X...X...",
    "..XXXXXXX..",
    ".XX.XXX.XX.",
    "XXXXXXXXXXX",
    "X.XXXXXXX.X",
    "X.X.....X.X",
    "...XX.XX...",
  ];
  const px = 16;
  const off = 12;
  const rects = rows
    .flatMap((r, y) => [...r].map((c, x) => (c === "X" ? `M${off + x * px} ${off + y * px}h${px}v${px}h-${px}z` : "")))
    .join("");
  const w = 11 * px + off * 2;
  const h = 8 * px + off * 2;
  return {
    id: "invader",
    w,
    h,
    svg: wrap(w, h, `
      <path d="${rects}" fill="#ffffff" stroke="#ffffff" stroke-width="18" stroke-linejoin="round"/>
      <path d="${rects}" fill="#0b100e"/>`),
  };
})();

/** Magenta label. */
const label: StickerDef = {
  id: "label",
  w: 340,
  h: 84,
  svg: wrap(340, 84, `
    <rect width="340" height="84" fill="#ff2fd0"/>
    <text x="22" y="57" font-family="${MONO}" font-size="34" font-weight="700" fill="#0b100e" letter-spacing="1">GTHR  X  2026</text>`),
};

/** Stacked green file-name labels. */
const files: StickerDef = (() => {
  const lines = ["RUN_OF_SHOW_V7", "GUESTLIST_FINAL", "FINAL_V9_(PLS_WORK)", "LOAD_IN_06:00   .AEP"];
  const rowH = 30;
  const body = lines
    .map((t, i) => {
      const x = [0, 18, 6, 0][i];
      const w = 250 + t.length * 3;
      return `<rect x="${x}" y="${i * rowH}" width="${w}" height="${rowH}" fill="#1f8a4c"/>
      <text x="${x + 12}" y="${i * rowH + 21}" font-family="${MONO}" font-size="16" font-weight="600" fill="#06331b" letter-spacing="1">${t}</text>`;
    })
    .join("");
  return { id: "files", w: 330, h: rowH * lines.length, svg: wrap(330, rowH * lines.length, body) };
})();

/** Yellow rounded square with a ring of dots. */
const dots: StickerDef = {
  id: "dots",
  w: 200,
  h: 200,
  svg: wrap(200, 200, `
    <rect width="200" height="200" rx="34" fill="#e6ff2f"/>
    <g fill="#0b100e">${Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return `<circle cx="${(100 + Math.cos(a) * 58).toFixed(1)}" cy="${(100 + Math.sin(a) * 58).toFixed(1)}" r="9"/>`;
    }).join("")}</g>`),
};

/** White round sticker: smiling globe, line art. */
const globeFace: StickerDef = {
  id: "globe",
  w: 220,
  h: 220,
  svg: wrap(220, 220, `
    <circle cx="110" cy="110" r="106" fill="#ffffff"/>
    <g fill="none" stroke="#0b100e" stroke-width="5">
      <circle cx="110" cy="110" r="78"/>
      <ellipse cx="110" cy="110" rx="34" ry="78"/>
      <ellipse cx="110" cy="110" rx="78" ry="30"/>
      <line x1="32" y1="110" x2="188" y2="110"/>
      <path d="M72 128 Q110 162 148 128" stroke-width="7" stroke-linecap="round"/>
    </g>
    <g fill="#0b100e">
      <ellipse cx="86" cy="96" rx="7" ry="10"/>
      <ellipse cx="134" cy="96" rx="7" ry="10"/>
    </g>`),
};

/** Vertical colour bars. */
const bars: StickerDef = {
  id: "bars",
  w: 44,
  h: 220,
  svg: wrap(44, 220, `
    <rect y="0" width="44" height="55" fill="#e6ff2f"/>
    <rect y="55" width="44" height="55" fill="#1a2bff"/>
    <rect y="110" width="44" height="55" fill="#ff1a1a"/>
    <rect y="165" width="44" height="55" fill="#ffffff"/>`),
};

/** Red/white checker. */
const checker: StickerDef = {
  id: "checker",
  w: 90,
  h: 90,
  svg: wrap(90, 90, `
    <rect width="90" height="90" fill="#ffffff"/>
    <rect width="45" height="45" fill="#ff1a1a"/>
    <rect x="45" y="45" width="45" height="45" fill="#ff1a1a"/>`),
};

/** Black → teal gradient bar. */
const gradient: StickerDef = {
  id: "gradient",
  w: 320,
  h: 56,
  svg: wrap(320, 56, `
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#0b100e"/><stop offset="1" stop-color="#04d6c0"/></linearGradient></defs>
    <rect width="320" height="56" fill="url(#g)"/>`),
};

/** Stepped white pixel diamond. */
const diamond: StickerDef = (() => {
  const rows = [".X.", "XXX", ".X."];
  const px = 60;
  const path = rows
    .flatMap((r, y) => [...r].map((c, x) => (c === "X" ? `M${x * px} ${y * px}h${px}v${px}h-${px}z` : "")))
    .join("");
  return { id: "diamond", w: 180, h: 180, svg: wrap(180, 180, `<path d="${path}" fill="#ffffff"/>`) };
})();

export const STICKERS: Record<string, StickerDef> = {
  coil,
  asterisk,
  invader,
  label,
  files,
  dots,
  globe: globeFace,
  bars,
  checker,
  gradient,
  diamond,
};
