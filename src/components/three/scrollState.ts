/**
 * One mutable object the WebGL scene reads every frame. Written by
 * <SceneTracker /> from scroll position, section rects, and the pointer;
 * kept outside React state so nothing re-renders at 60fps.
 */
export const scrollState = {
  /** window.scrollY */
  y: 0,
  vw: 1,
  vh: 1,
  /** 0 with the hero fully in view → 1 once it has scrolled off. */
  hero: 0,
  /** Cloud backdrop strength for whatever is on screen, 0..1. */
  backdrop: 1,
  /** How much terracotta the backdrop mixes in, 0..1. */
  warm: 1,
  /** Progress through the #statements block: 0 as it enters → 1 as it leaves. */
  statement: 0,
  /**
   * How much of the viewport the statements block covers, 0..1.
   *
   * No longer tints the backdrop — that section keeps the same ground as the
   * rest of the page now — but Badge still gates its visibility on it and
   * BendImages fades the polaroids out with it, so it stays published.
   */
  thermal: 0,
  /**
   * Hairline grid opacity, 1..0. Fades out as services arrives and stays off
   * below it. Drawn by CloudBackdrop, which is the only thing in the scene
   * that renders behind the 3D objects.
   */
  grid: 1,
  /** Normalised pointer, -1..1 on both axes, y up. */
  pointer: { x: 0, y: 0 },
  /** False until the first real pointer move (touch devices stay false). */
  pointerActive: false,
  /** Pointer world position on the z=0 plane, and a decaying speed (0..1). */
  pointerWorld: { x: 0, y: 0 },
  pointerSpeed: 0,
  /** Lenis scroll velocity, px/frame (0 without Lenis). */
  velocity: 0,
  /**
   * 1 while the business wordmark is hovered. Written by sections/WordSheen.tsx
   * (which owns the DOM listener); read by three/DotTerrain.tsx, which gathers
   * the dot field into the letterforms.
   */
  wordmark: 0,
  /** Target face: 0 = party, 1 = business. Written by ModeProvider. */
  business: 1,
  /** `business`, eased — everything in the scene crossfades on this. */
  businessMix: 1,
  reducedMotion: false,
};

/** Per-section backdrop look. Sections tile the page, so overlaps sum to 1. */
const SECTIONS: { id: string; intensity: number; warm: number; thermal: number }[] = [
  { id: "hero", intensity: 0.42, warm: 0.9, thermal: 0 },
  { id: "about", intensity: 0.4, warm: 0.9, thermal: 0 },
  { id: "statements", intensity: 0.6, warm: 0.6, thermal: 0.55 },
  { id: "services", intensity: 0.28, warm: 0.6, thermal: 0 },
  { id: "contact", intensity: 0.75, warm: 1, thermal: 0 },
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * How present the party face's 3D props (glass word, stickers) are, 1..0.
 * Eased off `businessMix` and done by the time it reaches 0.55, so they have
 * left before the business wordmark fades up in their place (its CSS fade is
 * delayed to match) rather than shrinking underneath it. Symmetric, so the way
 * back grows them in over the same stretch.
 */
export function partyPresence() {
  const t = clamp01(scrollState.businessMix / 0.55);
  return 1 - t * t * (3 - 2 * t);
}
const elements = new Map<string, HTMLElement>();

function sectionElement(id: string) {
  let el = elements.get(id);
  if (!el) {
    el = document.getElementById(id) ?? undefined;
    if (el) elements.set(id, el);
  }
  return el;
}

/** Recomputes the section-driven values. Cheap enough to run per frame. */
export function updateScrollState() {
  if (typeof window === "undefined") return;
  const vh = window.innerHeight;
  scrollState.vw = window.innerWidth;
  scrollState.vh = vh;
  const hero = sectionElement("hero");
  const heroTop = hero ? hero.getBoundingClientRect().top : 0;
  scrollState.y = -heroTop;
  scrollState.hero = clamp01(-heroTop / vh);

  let intensity = 0;
  let warm = 0;
  let thermal = 0;
  for (const section of SECTIONS) {
    const el = sectionElement(section.id);
    if (!el) continue;
    const { top, bottom } = el.getBoundingClientRect();
    const visible = clamp01((Math.min(bottom, vh) - Math.max(top, 0)) / vh);
    intensity += visible * section.intensity;
    warm += visible * section.warm;
    thermal += visible * section.thermal;
    if (section.id === "statements") {
      scrollState.statement = clamp01((vh - top) / (bottom - top + vh));
    }
    if (section.id === "services") {
      // 1 while services is well below the fold, 0 once its top passes 30% of
      // the viewport — and it never comes back further down.
      scrollState.grid = clamp01((top - vh * 0.3) / (vh * 0.5));
    }
  }
  scrollState.backdrop = clamp01(intensity);
  scrollState.warm = clamp01(warm);
  scrollState.thermal = clamp01(thermal);
}
