@AGENTS.md

# GTHR

Single-page site for GTHR, an end-to-end creative collaborator for events —
"pitch to post". Layout and interaction model are borrowed from
https://haoqi.design/ (a solo portfolio); the copy, name, and fonts are ours.

## Standing rules

- **Two faces, one page.** A toggle in the top bar switches between `party`
  (default) and `business`. Sections and copy are **identical**; the finish
  changes: white ground, **black** ink (it was a corporate green `#1D3A2E`
  until the client asked for black), a `GTHR` wordmark set in the platform UI
  face (`--font-system`, which *is* SF Pro on Apple hardware — closer than any
  webfont lookalike), no stickers, no marque beside the wordmark, and a centred
  hero over the dot terrain. A `GATHER` spelling with 8-bit `A`/`E`
  glyphs was tried here and reverted. The mode lives in a module store
  (`mode/ModeProvider.tsx`) rather than context, so it can be seeded
  synchronously on the client and still be read from *inside* the R3F Canvas —
  React context does not cross the reconciler. It is published as a `data-mode`
  attribute on `<html>` (CSS tokens), via `useMode()` (components), and as
  `scrollState.business` / `businessMix` (the WebGL frame loop). A boot script
  in `layout.tsx` stamps the attribute before paint, so `<html>` carries
  `suppressHydrationWarning` on purpose.
- **One page.** Sections in order: Hero → Intro → Statement (sticky) →
  Statement (scrolls over it) → Services `#services` → About `#about` →
  Contact `#contact`.
  Nav links are in-page anchors. Don't add routes or sections without asking.
- **Copy lives in `src/content/`** (`site.ts`, `services.ts`). Components never
  hard-code user-facing strings. Three lines are client-supplied and verbatim:
  the intro paragraph and both statements. `hero.line` is a draft.
- **Services** are client copy (`services.ts`). The VIP Experiences description
  is a draft. Keep the `{ number, title, description }` shape; rows stay compact.
- **Business tokens** live in one `:root[data-mode="business"]` block in
  `globals.css`. Everything already reads `--paper` / `--ink-rgb` / `--brand`,
  so the whole DOM reskins from those four lines; `.glass` is the one thing
  that needs an override, because a frosted white card is invisible on white.
- **Light, airbrushed — mostly paper.** Warm paper (`#F4F3EE`) with the poster
  palette moving behind it at low intensity (hero 0.42, wide vignette); ink is the old dark green-black (`11,16,14`). Tokens live at the
  top of `src/app/globals.css`: `--paper`, `--ink-rgb` (+ the 1 / .6 / .32 /
  .18 / .12 opacity scale), `--brand` (`#04EA98`), `--accent` (`#E2603C`).
  No `dark:` variants, no theme toggle. **Legibility rule:** text-heavy
  sections keep backdrop intensity low (`scrollState.ts`), the backdrop's
  vignette holds the gutters near paper, and anything dense over colour goes
  in a `.glass` card.
- **Type:** Syne (variable, 800 for `.display`) and Martian Mono for nav, clock,
  numbers, eyebrows. Display type is viewport-sized (`text-[Nsvw]`), uppercase,
  `leading-[0.9]`.
- **Grid:** every section is `grid grid-cols-12 px-4 lg:px-14 py-18 lg:py-24`.
- **Motion:** the page scrolls inside a fixed viewport-sized wrapper
  (`.scroll-wrapper`, `SmoothScroll.tsx`) driven by a hand-made Lenis instance
  exposed via `useLenisInstance()` (and `lenisRef` for the scene). Fixed
  chrome renders *outside* the wrapper via the `chrome` prop so it never
  curves. Anything that reacts to scroll listens to `document` `scroll` in the
  capture phase (works for the wrapper and, under reduced motion — no Lenis,
  native scrolling — too). Scroll reveals are `<Reveal>` (CSS transitions armed
  by JS; `lines` splits a string and rises it line by line). No preloader, no sound.
- **WebGL layer:** one fixed full-viewport R3F `<Canvas>` behind the page
  (`components/three/`), like the reference. Every section is transparent so
  it shows through the whole page. Scenes read the
  mutable `scrollState` each frame — never React state at 60fps. Reduced motion
  freezes time-based motion but keeps scroll-driven placement.
  - `CloudBackdrop` — full-screen airbrushed blob shader (after the "Give Us
    Our Flowers" poster): sky, lime, mint, orange, sun, pink on paper.
    **Opaque** so it stays in the opaque pass — that also means Three's
    transmission pass captures it, which is what the glass letters refract.
    Strength/warmth per section from `scrollState`.
    It also draws the **hairline grid** (a line at each gutter and at the
    thirds, an 11px + at every crossing, fading out as services arrives). That
    lives here rather than in the DOM because the grid has to sit *behind* the
    3D objects — the glass letters, the badge — and this backdrop is the only
    thing in the scene that renders before them. A DOM layer cannot get behind
    it either: the quad is opaque and covers the viewport, which also means
    **this quad is the page background**. `uBusinessPaper` and the `--paper`
    token have to be kept in step, and it is passed as raw sRGB, not a
    `THREE.Color` — a near-white converted into linear working space lands
    several shades darker, which is visible.
  - `HeroLetters` — the wordmark as one connected cursive word, lowercase
    `gthr` in Pacifico. `pacifico-gthr.typeface.json` holds the four glyphs
    **unioned into one outline** (glyph key `w`; rebuild with the scratch
    `union-word.py` + shapely if the word changes) so letter joins have no
    internal walls or doubled bevels showing through the glass. The outline is
    polylines only — flattened adaptively and DP-simplified to sub-pixel
    deviation — so `curveSegments` does nothing: smoothness comes from
    `toCreasedNormals` on the extruded geometry. (drei's `smooth` prop is a
    vertex-weld *distance*, not a crease angle, and does not reshade;
    ExtrudeGeometry ships flat face normals, which is what made the bevel
    read as faceted.) Bevels stay modest — deep/inset bevels tear the thin
    strokes, tried and reverted. Material is drei `MeshTransmissionMaterial`;
    three settings matter, each got wrong once:
      * `clearcoat` stays **0** — at roughness 0 it is a mirror layer, and it
        reflected the studio environment as opaque white plastic.
      * `thickness` stays **small** (~0.22 x size) — it is the refraction ray
        length, so a large value samples the pale backdrop far away instead
        of the sticker directly behind the letter.
      * `envMapIntensity` stays **low** (0.3) — high read as brushed metal.
    The look is clear-with-rainbow-edges, after the reference render: the body
    is near-colourless (`color` `#eef5ff`, long `attenuationDistance`) and the
    colour lives on the edges, from `chromaticAberration` 0.4 (the R/G/B
    refraction rays are spread by it, so it paints the bevel) plus thin-film
    `iridescence` 1, which is strongest at glancing angles and so lands on the
    bevel too. Dispersion bands at low sample counts — hence `samples` 14
    (8 on mobile).
    **Cost:** this material re-renders the scene into its own buffer every
    frame, and does it however small the mesh is — so the word is hidden
    outright (`visible = false`) once the business face has taken over, not
    merely scaled to nothing. A zero-scale word was still paying for the pass,
    which is what made the business face feel heavy under the mouse.
    No `backside` (it smeared the extrusion side walls), no sparkles, no 3D
    orbiters. Glass has no value of its own, so the word needs shading to be legible.
    That comes from the mesh's **own** shadow, not a silhouette behind it:
    the Canvas has `shadows`, the key light in `Lighting.tsx` is the single
    caster, and the word (one connected mesh) both casts and receives, so a
    stroke crossing another darkens it. This only works because `transmission`
    sits at 0.9 rather than 1 — at 1 there is no diffuse term for a shadow to
    darken and the letterforms render flat, so 0.9 is the clarity ceiling. A stack of offset flat-ink copies
    behind the word was tried first and rejected: the transmission pass
    captures them, so they refracted through the strokes as grey streaks.
  - `BendImages` — the reference's "curved screen": every `[data-bend]`
    element with `data-src` gets a WebGL plane drawn over its DOM rect,
    textured with the same image. With scroll velocity the planes are
    wrapped onto a **concave** cylinder across the viewport (edges lean in
    toward the viewer; radius shrinks with speed, flat at rest) plus a small
    bow — images near the top/bottom edges tilt
    and recede as they enter/leave, the reference's curved screen. The DOM `<img>` keeps `.bend-source`
    (opacity 0) for layout and alt text. `data-gray` → mono, `data-radius` →
    rounded corners in px; `data-frame` paints the whole polaroid (frame,
    photo, caption, measured from the DOM) so the frame bends too;
    `data-fade-statements` fades the plane out as the statements block
    arrives. Used by the intro image and both polaroids.
  - `DotTerrain` — the business face's hero image, and it is two things at once.
    At rest it is a **digital mountain range**, drawn as a *stipple* the way the
    reference engraving is. Three things make it read as 3D, and it looked flat
    until all three were right:
      * **Depth.** The points render with `depthTest` and `depthWrite` on, so
        near ridges occlude the ground behind them. Safe because nothing else
        here writes depth (the cloud backdrop runs with both off) and the
        lattice is emitted near-row-first, so dots arrive front to back. The
        fragment discard has to stay *low* — a surviving fragment writes depth,
        but cutting high deletes the far half of the range, which is faint by
        design.
      * **Tone as density.** Dots are near solid and tone is carried by how
        many there are and how big — a dropout probability and a size scale,
        both driven by shading. Carrying tone in *alpha* is what forced the
        depth buffer off in the first place.
        **`aScale` is a fraction of the lattice spacing, not a size in pixels**,
        and `uSize` is one cell projected to CSS pixels at unit distance,
        derived per frame from the live viewport and camera. So 1.0 is dots
        exactly touching: the top of the range overlaps them into solid ink and
        the bottom is an open stipple. With a *tuned constant* instead, the dots
        covered ~5.7% of their cell at every distance and every tone — the range
        could not be darker than 6% grey however the shading was tuned, which is
        why it read as a pale haze. If it ever looks washed out again, check
        this ratio before touching the lighting.
      * **Ink is darkness.** Bare paper where the sun lands, dense ink where it
        does not — the opposite of the halftone globe's "ink stands in for
        light". Reading it the other way round was most of why it looked flat.
    Lighting is a sky term plus a **low sun** with **real cast shadows**,
    marched over the heightfield (8 samples, stride 3) and thresholded against
    the sun's own slope. The sun has to be low: at the original 0.74 elevation
    nothing in a range this broad was steep enough to block it and the shadow
    pass found *precisely nothing*. The sky term is the surface's upward-facing
    fraction, which reaches 0 on a vertical wall — floored at 0.5 (the usual
    `0.5 + 0.5 * up` wrap) nothing could ever go dark.
    Height is big massifs carrying fine detail, the detail scaled *by* the
    massif. The detail band runs at a high frequency (0.5, four octaves) because
    it sets how **steep** the ground gets, and slope is all the shading has to
    work with — at a gentler 0.19 the range was near enough upward-facing
    everywhere. Four octaves, not six: the finest would land under the lattice
    spacing and turn to noise.
    Shading is differenced from each dot's *neighbours* in the lattice rather
    than by re-sampling the noise. ~460k lattice, ~265k dots kept, ~110ms — of
    which the shadow march is about a third. `noise.ts` hashes with an integer
    bit-mix rather than `fract(sin(...))` for this: same job, ~1.6x faster, and
    at this density that is the difference between a dense field and a hitch.
    **`pass()` carves a valley where the type sits**, and it is what lets the
    mountains be tall at all. Holding the whole field below the wordmark
    flattened the range out of the frame entirely (the complaint was "I don't
    see the mountains any more"); only the middle is ever *behind* the type, so
    only the middle has to keep its head down. It is a flat floor plus a ramp,
    not a single ramp from the centre — a plain ramp was still only ~35% carved
    at the edge of the text and let peaks through — and it widens with distance,
    because the type holds the same share of the screen however far away the
    ground is.
    **The geometry is solved, not chosen.** A dot's ndcY is
    `y / ((6 - z) * tan20)`, so distant peaks sit far higher on screen than
    their world y suggests. `GROUND_Y`/`RELIEF` were swept until the highest dot
    *within the type's band* clears ndcY -0.26 (the text runs +0.09 to -0.22)
    while the flanking peaks reach -0.05, about halfway up the frame. Also:
    `Z_NEAR` must stay strictly nearer than the camera at z = 6, or the first
    row sits on the lens. Redo the sweep if the depth, the carve or the hero's
    type size changes.
    **`WATER` is tested against the natural elevation, not the carved one.**
    Keyed to the carved height it drowned the whole pass floor — 40% of the
    field, and the middle of the frame went blank — because the carve pushes
    everything there down by design.
    **Interaction:** the cursor tints what it passes toward the spectrum *and*
    moves the ground — a swell with ripples running out of it, measured from
    each dot's resting place so the swell sits still under the cursor instead of
    chasing ground it just lifted. The cursor is placed by **ray-marching the
    real heightfield** (`raycastTerrain`, analytic, with a few bisections). A
    flat plane at mid-relief was tried first and put the swell visibly *below*
    the cursor: the plane sits above the real surface almost everywhere, so the
    ray met it early, and dots at those coordinates — at their true, lower
    height — projected further down the screen. It is one ray per frame, not one
    per dot, so the accurate version costs nothing worth saving.
    **Hover the GTHR wordmark and the field gathers into the letterforms.**
    The target is measured: the word is rasterised into a canvas using the *live
    computed font* of the DOM wordmark, with the baseline derived from real
    metrics — `line-height: 1` centres the text in its line box by half-leading,
    so the baseline sits at `(boxHeight - (ascent + descent)) / 2 + ascent`.
    Sampled pixels map canvas → screen → world. Re-measured on `fonts.ready`
    and by a `ResizeObserver`. Read the word's *direct text nodes only* —
    `textContent` picks up the sheen overlay nested inside it and rasterises the
    word twice over.
    The dots fade out **completely** before they land: they sit behind the DOM
    word, and any residue at all stipples the glyph edges and the word reads as
    noisy. The hover itself is owned by `sections/WordSheen.tsx` and published
    through `scrollState.wordmark`.
    The morph is staggered per dot and bowed toward the viewer at the midpoint,
    so the field arcs into the word rather than sliding flat. It only fires once
    the text positions exist.
    **Scrolling gathers it too**, so the range collects itself into the word on
    the way out rather than just fading — and the word answers by drawing back
    (`WordSheen` scales and fades it in step). The gathered positions therefore
    track a *moving* target: `uTextShift` carries the page scroll and the
    recession, `uTextScale`/`uTextCenter` the shrink, or the dots would converge
    on where the type used to be. The field's own fade is timed *after* the
    gather (0.42 → 0.88 of `hero`) so the flight is visible before anything
    disappears.
    `.hero-lockup__word` carries `pointer-events: auto` for this — the lockup
    around it stays inert, and the span is shrink-to-fit so the target is the
    word only.
    Five predecessors filled this slot: `HalftoneGlobe`, `DotField` (a stippled
    landscape with two figures), `DotGlobe`, `ParticlePlane` and `LiquidSphere`
    (a lumpy transmission blob that dented under the cursor — dropped partly
    for cost). Copies are in the session scratchpad only.
  - `WordSheen` (sections/) — the spectral sweep on the business wordmark, and
    the DOM half of the hover above. A second copy of the word laid exactly over
    the first, painted with five spectral blobs through `background-clip: text`.
    The base word underneath is **never touched**, so the type itself cannot go
    wrong; the sheen just fades in on top of it, which is what makes the onset
    gradual rather than a switch. Blob positions are driven from a rAF loop
    rather than CSS keyframes, because they answer to the **pointer** as well as
    to the clock and the two cannot share `background-position`; the loop runs
    only while the word is hovered, plus long enough afterwards to fade out.
    The layers drift on deliberately incommensurate frequencies so the pattern
    never visibly repeats — a single linear sweep read as far too mechanical —
    and a tight prismatic `drop-shadow` is the part that escapes the glyphs.
    Disabled outright under reduced motion, not merely frozen.
  - The **business hero layout** is one centred column — lockup, then
    `hero.line` small underneath — set by overriding `display` on `#hero`
    under `[data-mode="business"]`, which makes the section's grid utilities go
    inert without touching the markup. The party face keeps the grid.
    The lockup is **absolutely placed on the middle of the viewport**, not
    centred as a column: centring the column puts the wordmark above the middle,
    because the line underneath is part of what gets centred. It measures
    `50dvh` (`50vh` at `lg`, matching the canvas's own `h-screen`) rather than
    `50%` of the section, because the grid it has to line up with is painted on
    the fixed canvas at thirds of the *viewport*. The line sits under it from
    `--lockup-half`.
    **These rules are deliberately unlayered.** Tailwind declares
    `@layer theme, base, components, utilities`, and **layer order beats
    specificity** — so `display: block` written inside `@layer components` loses
    to the plain `grid` utility class on the section, however specific the
    selector. That is exactly what happened: the business hero silently stayed a
    grid and the wordmark stayed in row 1. Anything here that has to beat a
    utility class on the same element (the hero's `display`, the line's
    `max-width` and colour) must live outside the layer.
    The word itself is a hover target — see `DotTerrain`.
  - `Stickers` — flat 2D stickers (SVG strings in `stickerDefs.ts`,
    rasterised to textures once) on unlit planes behind the glass: the whole
    sheet wanders the hero on per-sticker simplex-noise paths, passing behind
    the wordmark, which refracts them. Hero props stay flat.
    **They can be grabbed and thrown.** The noise path is only a *target* now —
    the authoritative position is per-sticker runtime state, which is what lets
    a thrown one carry its own momentum, bounce off the frame, and then wander
    back onto its path (the pull toward it starts weak and firms up, so it
    drifts home rather than snapping). Velocity is measured from the drag
    itself, so a flick throws and a slow release drops.
    Picking is done by hand from `window` pointer events, *not* R3F's raycaster:
    the canvas is `pointer-events-none` and `main` covers it, so nothing ever
    reaches the scene. The hit test undoes the root group's scroll offset and
    scale and the sticker's own rotation, and takes the frontmost hit. Party
    face only, and pointer-downs on anything interactive are ignored.
  - `Badge` — the one 3D prop for the statements block: a lanyard badge
    (canvas-painted face, printed strap, ring + swivel hook into a punched
    hole) whose pivot travels upper-left -> close past the camera -> lower
    right on `scrollState.statement`, nearest the camera before half-way and
    receding as it exits. It is *present* early (`thermal > 0.02`) but parked
    far off-screen left (travel starts at -2.3 x half-width) so it slides in
    rather than popping — a high visibility threshold made it appear
    mid-frame instead. The card hangs as a clamped simulated pendulum
    (gravity, damping, driven by the pivot's own acceleration).
  - The letters carry a soft pointer lean (wide, low vertex displacement
    injected with `onBeforeCompile`) and the backdrop drifts gently toward
    the pointer. Both are deliberately subtle, matching the reference — the
    strong jelly/swirl version was rejected.
  - While the statements block is on screen, `scrollState.thermal` (weighted
    0.55) tints the backdrop toward the thermal bands — deliberately mild.
- **Chrome:** fixed `TopBar` (wordmark + Services/Contact), `BottomBar`
  (visitor-local `Clock` left, animated wireframe `Globe` right),
  `SideScrollbar` (desktop, Lenis-driven), `PixelCursor` (8-bit terracotta
  cursor replacing the OS cursor for fine pointers; hidden over text fields).
  All `pointer-events-none` with only the controls re-enabled.
- **Statements:** `.statement` (Syne 700, caps), both panels
  transparent so the backdrop shows; `StickyFade` fades the pinned one as the
  next slides over.
- **About:** eyebrow + the client's description, then each person as a
  border-only polaroid (`TeamCard`; the photo is the bending WebGL copy, B/W)
  beside their name/role/bio — Polly left, Kevin right. No coloured panels.
  The mono is **neutral** and the frame is the `--frame` token: both were warm
  (a sepia mono multiplier, a `#f7f5ef` frame) and read as a sand cast, which
  the client rejected. `--frame` is painted into the WebGL copy as well, read
  from the computed style, so a mode change re-keys and repaints the polaroid.
- **Contact:** centered form → `app/actions/contact.ts` server action → Resend
  REST. Needs `RESEND_API_KEY` (see `.env.example`); without it the form says
  so and points to the email. No socials — the globe is the only mark.
- Text on the left gutter needs an 8px inset (`px-2` / `outline-box` padding)
  so it clears the grid overlay's gutter line.
- The intro square uses `public/intro.jpg` (or .png/.webp) when present,
  checked server-side in `Intro.tsx`; otherwise the generated `AbstractVisual`.
  Text is vertically centred against it.

## Structure

```
src/app/            layout.tsx (fonts, chrome, canvas), page.tsx (section order), globals.css (tokens, reveal + grid CSS)
src/components/
  chrome/           TopBar, BottomBar, Clock, Globe, SmoothScroll, ModeToggle, SideScrollbar, PixelCursor
  sections/         Hero, WordSheen, Intro, Statement, StickyFade, Services, About, TeamCard, Contact, ContactForm
  three/            SceneCanvas → Scene (Canvas + tracker), CloudBackdrop (+ the grid),
                    HeroLetters, DotTerrain, Stickers + stickerDefs, Badge, BendImages,
                    Lighting, noise, scrollState
  ui/               AbstractVisual, Reveal
src/app/actions/    contact.ts — server action for the form
src/hooks/          usePrefersReducedMotion, useMediaQuery
src/content/        site.ts, services.ts — all copy
```

## Verify

`npm run dev`, walk the page at 375 / 768 / 1440. `npm run build && npm run lint`
must be clean. Check reduced-motion, keyboard focus order through the fixed bars,
and that the console shows no hydration warnings (the clock renders `--:--:--`
on the server on purpose).
