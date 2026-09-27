/**
 * Flat 2D stickers, drawn as SVG strings and rasterised to textures at
 * runtime (see Stickers.tsx). GTHR's own sheet: things from a show day —
 * a wristband, a crew pass, the run of show, a speaker stack, a disco ball —
 * in the party face's colours (mint `--brand`, terracotta `--accent`, plus a
 * violet, a pink and an acid yellow), with black line work and mono labels.
 * `w`/`h` are the design's aspect box; world size is decided by the caller.
 *
 * The SVG is drawn into an <img>, which cannot see the page's webfonts, so
 * text is set in system faces.
 */

export type StickerDef = { id: string; w: number; h: number; svg: string };

const MONO = "ui-monospace, Menlo, monospace";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const INK = "#0b100e";
const MINT = "#04ea98";
const CORAL = "#ff7a45";
const VIOLET = "#8b5cff";
const PINK = "#ff4fa3";
const ACID = "#e6ff2f";

const wrap = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 3}" height="${h * 3}">${body}</svg>`;

/** Pixel rows ("X" = filled) as one path, for the 8-bit pieces. */
const pixels = (rows: string[], px: number, off = 0) =>
  rows
    .flatMap((r, y) => [...r].map((c, x) => (c === "X" ? `M${off + x * px} ${off + y * px}h${px}v${px}h-${px}z` : "")))
    .join("");

/** Festival wristband: mint strip, repeating print, a snap at the end. */
const wristband: StickerDef = {
  id: "wristband",
  w: 360,
  h: 72,
  svg: wrap(360, 72, `
    <rect x="4" y="4" width="352" height="64" rx="14" fill="#ffffff"/>
    <rect x="10" y="10" width="340" height="52" rx="10" fill="${MINT}"/>
    <g fill="${INK}" opacity="0.14">${Array.from({ length: 16 }, (_, i) => `<rect x="${18 + i * 18}" y="10" width="6" height="52" transform="skewX(-20)"/>`).join("")}</g>
    <text x="26" y="44" font-family="${MONO}" font-size="19" font-weight="700" fill="${INK}" letter-spacing="2">GTHR · ALL ACCESS · 26</text>
    <circle cx="318" cy="36" r="17" fill="#ffffff" stroke="${INK}" stroke-width="4"/>
    <circle cx="318" cy="36" r="6" fill="${INK}"/>`),
};

/** Crew pass: terracotta card with a punched slot. */
const crew: StickerDef = {
  id: "crew",
  w: 180,
  h: 240,
  svg: wrap(180, 240, `
    <path fill-rule="evenodd" fill="${CORAL}" d="M22 0h136a22 22 0 0 1 22 22v196a22 22 0 0 1-22 22H22A22 22 0 0 1 0 218V22A22 22 0 0 1 22 0Z M64 18h52a8 8 0 0 1 0 16H64a8 8 0 0 1 0-16Z"/>
    <rect x="18" y="56" width="144" height="4" fill="${INK}"/>
    <text x="90" y="138" text-anchor="middle" font-family="${SANS}" font-size="58" font-weight="900" fill="${INK}" letter-spacing="-1">CREW</text>
    <text x="90" y="170" text-anchor="middle" font-family="${MONO}" font-size="15" font-weight="700" fill="${INK}" letter-spacing="2">GTHR / 2026</text>
    <rect x="18" y="192" width="144" height="30" fill="${INK}"/>
    <text x="90" y="213" text-anchor="middle" font-family="${MONO}" font-size="14" font-weight="700" fill="${CORAL}" letter-spacing="3">BACKSTAGE</text>`),
};

/** Acid starburst price-tag: "24/7". */
const burst: StickerDef = (() => {
  const n = 18;
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 78 : 98;
    return `${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
  return {
    id: "burst",
    w: 200,
    h: 200,
    svg: wrap(200, 200, `
      <polygon points="${pts}" fill="${ACID}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <text x="100" y="116" text-anchor="middle" font-family="${SANS}" font-size="52" font-weight="900" fill="${INK}" letter-spacing="-2">24/7</text>
      <text x="100" y="140" text-anchor="middle" font-family="${MONO}" font-size="13" font-weight="700" fill="${INK}" letter-spacing="2">ON SITE</text>`),
  };
})();

/** The site's own 8-bit arrow cursor, as a sticker. */
const cursor: StickerDef = (() => {
  const rows = [
    "X.........",
    "XX........",
    "XOX.......",
    "XOOX......",
    "XOOOX.....",
    "XOOOOX....",
    "XOOOOOX...",
    "XOOOOOOX..",
    "XOOOOOOOX.",
    "XOOOOXXXXX",
    "XOOXOX....",
    "XOX.XOX...",
    "XX..XOX...",
    "X....XOX..",
    ".....XXX..",
  ];
  const px = 14;
  const off = 12;
  const all = pixels(rows.map((r) => r.replace(/O/g, "X")), px, off);
  const fill = pixels(rows.map((r) => r.replace(/X/g, ".").replace(/O/g, "X")), px, off);
  const w = 10 * px + off * 2;
  const h = rows.length * px + off * 2;
  return {
    id: "cursor",
    w,
    h,
    svg: wrap(w, h, `
      <path d="${all}" fill="#ffffff" stroke="#ffffff" stroke-width="18" stroke-linejoin="round"/>
      <path d="${all}" fill="${INK}"/>
      <path d="${fill}" fill="${CORAL}"/>`),
  };
})();

/** Disco ball: a tiled sphere with a glint. */
const disco: StickerDef = (() => {
  const tiles: string[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const shade = ["#d9dce4", "#b7bcc9", "#f4f5f8", "#9aa0b0"][(x * 3 + y * 5 + ((x * y) % 3)) % 4];
      tiles.push(`<rect x="${24 + x * 16}" y="${24 + y * 16}" width="15" height="15" fill="${shade}"/>`);
    }
  }
  return {
    id: "disco",
    w: 210,
    h: 210,
    svg: wrap(210, 210, `
      <defs><clipPath id="ball"><circle cx="104" cy="104" r="78"/></clipPath></defs>
      <circle cx="104" cy="104" r="92" fill="${VIOLET}"/>
      <circle cx="104" cy="104" r="80" fill="${INK}"/>
      <g clip-path="url(#ball)">${tiles.join("")}</g>
      <circle cx="104" cy="104" r="78" fill="none" stroke="${INK}" stroke-width="4"/>
      <path d="M160 18 L166 38 L186 44 L166 50 L160 70 L154 50 L134 44 L154 38Z" fill="#ffffff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`),
  };
})();

/** Speaker stack: black cabinet, two cones, white die-cut edge. */
const speaker: StickerDef = {
  id: "speaker",
  w: 150,
  h: 220,
  svg: wrap(150, 220, `
    <rect x="3" y="3" width="144" height="214" rx="18" fill="#ffffff"/>
    <rect x="11" y="11" width="128" height="198" rx="12" fill="${INK}"/>
    <g fill="none" stroke="${MINT}" stroke-width="5">
      <circle cx="75" cy="62" r="30"/><circle cx="75" cy="62" r="12"/>
      <circle cx="75" cy="148" r="44"/><circle cx="75" cy="148" r="26"/><circle cx="75" cy="148" r="8"/>
    </g>
    <circle cx="30" cy="28" r="4" fill="${MINT}"/><circle cx="120" cy="28" r="4" fill="${MINT}"/>`),
};

/** A scannable-looking square: hashed cells, three finder eyes. */
const qr: StickerDef = (() => {
  const n = 13;
  const cell = 8;
  const off = 14;
  const finder = (x: number, y: number) => x < 4 && y < 4 || x > n - 5 && y < 4 || x < 4 && y > n - 5;
  const cells: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      const on = ((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995) % 7 < 3;
      if (on) cells.push(`M${off + x * cell} ${off + y * cell}h${cell}v${cell}h-${cell}z`);
    }
  }
  const eye = (x: number, y: number) =>
    `<rect x="${off + x * cell}" y="${off + y * cell}" width="${cell * 3}" height="${cell * 3}" fill="none" stroke="${INK}" stroke-width="5"/>
     <rect x="${off + x * cell + 8}" y="${off + y * cell + 8}" width="8" height="8" fill="${INK}"/>`;
  const s = n * cell + off * 2;
  return {
    id: "qr",
    w: s,
    h: s + 26,
    svg: wrap(s, s + 26, `
      <rect width="${s}" height="${s + 26}" rx="14" fill="#ffffff"/>
      <path d="${cells.join("")}" fill="${INK}"/>
      ${eye(0, 0)}${eye(n - 3, 0)}${eye(0, n - 3)}
      <text x="${s / 2}" y="${s + 12}" text-anchor="middle" font-family="${MONO}" font-size="11" font-weight="700" fill="${INK}" letter-spacing="2">SCAN IN</text>`),
  };
})();

/** Violet pill: doors time. */
const doors: StickerDef = {
  id: "doors",
  w: 300,
  h: 72,
  svg: wrap(300, 72, `
    <rect width="300" height="72" rx="36" fill="${VIOLET}"/>
    <circle cx="38" cy="36" r="10" fill="${ACID}"/>
    <text x="62" y="46" font-family="${MONO}" font-size="28" font-weight="700" fill="#ffffff" letter-spacing="1">DOORS 19:00</text>`),
};

/** Pink round sticker: a stage mic. */
const mic: StickerDef = {
  id: "mic",
  w: 200,
  h: 200,
  svg: wrap(200, 200, `
    <circle cx="100" cy="100" r="96" fill="${PINK}"/>
    <g transform="rotate(-24 100 100)">
      <rect x="80" y="36" width="40" height="64" rx="20" fill="#ffffff" stroke="${INK}" stroke-width="6"/>
      <g stroke="${INK}" stroke-width="4"><line x1="86" y1="56" x2="114" y2="56"/><line x1="86" y1="68" x2="114" y2="68"/><line x1="86" y1="80" x2="114" y2="80"/></g>
      <path d="M68 86 Q68 124 100 124 Q132 124 132 86" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
      <line x1="100" y1="124" x2="100" y2="156" stroke="${INK}" stroke-width="6"/>
      <line x1="78" y1="158" x2="122" y2="158" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    </g>`),
};

/** Four-point sparkle, white with a black keyline. */
const sparkle: StickerDef = {
  id: "sparkle",
  w: 140,
  h: 140,
  svg: wrap(140, 140, `
    <path d="M70 6 Q78 58 134 70 Q78 82 70 134 Q62 82 6 70 Q62 58 70 6Z" fill="#ffffff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`),
};

/** A run-of-show card, half ticked off. */
const runsheet: StickerDef = (() => {
  const items = ["LOAD IN", "SOUNDCHECK", "DOORS", "HEADLINE", "LOAD OUT"];
  const rows = items
    .map((t, i) => {
      const y = 70 + i * 34;
      const done = i < 3;
      return `<rect x="22" y="${y - 16}" width="20" height="20" rx="4" fill="${done ? MINT : "#ffffff"}" stroke="${INK}" stroke-width="3"/>
        ${done ? `<path d="M26 ${y - 6} l5 5 l9 -11" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
        <text x="54" y="${y}" font-family="${MONO}" font-size="16" font-weight="700" fill="${INK}" letter-spacing="1"${done ? ' opacity="0.45"' : ""}>${t}</text>
        ${done ? `<line x1="52" y1="${y - 6}" x2="${60 + t.length * 11}" y2="${y - 6}" stroke="${INK}" stroke-width="2.5"/>` : ""}`;
    })
    .join("");
  return {
    id: "runsheet",
    w: 230,
    h: 250,
    svg: wrap(230, 250, `
      <rect width="230" height="250" rx="12" fill="#f3efe6"/>
      <rect width="230" height="36" rx="12" fill="${INK}"/><rect y="24" width="230" height="12" fill="${INK}"/>
      <text x="22" y="24" font-family="${MONO}" font-size="14" font-weight="700" fill="${ACID}" letter-spacing="3">RUN OF SHOW</text>
      ${rows}`),
  };
})();

export const STICKERS: Record<string, StickerDef> = {
  wristband,
  crew,
  burst,
  cursor,
  disco,
  speaker,
  qr,
  doors,
  mic,
  sparkle,
  runsheet,
};
