@AGENTS.md

# GTHR

Single-page site for GTHR, an end-to-end creative collaborator for events —
"pitch to post". Layout and interaction model are borrowed from
https://haoqi.design/ (a solo portfolio); the copy, name, and fonts are ours.

## Standing rules

- **Switching faces is sequenced**, not a straight crossfade:
  `partyPresence()` (scrollState) shrinks the glass word and the stickers out
  over the first ~0.55 of `businessMix`; the business wordmark's CSS fade-up is
  quick (0.1s delay, ~0.4s) and starts as they finish (and leaves fast the other way); and
  `ModeProvider` sets `data-switching` on `<html>` for 0.9s so the hero line
  hides across its layout jump.
- **Two faces, one page.** A toggle in the top bar switches between `business`
  (the default, listed first) and `party`. Sections and copy are **identical**;
  the business finish is: a plain light-grey ground (`--paper` `#e7e7e7`, kept
  in step with CloudBackdrop's `uBusinessPaper`), very dark neutral ink rather
  than pure black, a `GTHR` wordmark set in the platform UI face
  (`--font-system`, which *is* SF Pro on Apple hardware — closer than any
  webfont lookalike), no stickers, no marque beside the wordmark, and a hero
  laid out as a poster after the client's NVIDIA reference (see the business
  hero layout, below). A `GATHER` spelling with 8-bit `A`/`E`
  glyphs was tried here and reverted. The mode lives in a module store
  (`mode/ModeProvider.tsx`) rather than context, so it can be seeded
  synchronously on the client and still be read from *inside* the R3F Canvas —
  React context does not cross the reconciler. It is published as a `data-mode`
  attribute on `<html>` (CSS tokens), via `useMode()` (components), and as
  `scrollState.business` / `businessMix` (the WebGL frame loop). A boot script
  in `layout.tsx` stamps the attribute before paint, so `<html>` carries
  `suppressHydrationWarning` on purpose.
- **One page.** Sections in order: Hero → Who are we `#about` → Statement
  (sticky) → Statement (scrolls over it) → Services `#services` → Contact
  `#contact`. The intro section (paragraph + image) was removed at the
  client's request.
  Nav links are in-page anchors. Don't add routes or sections without asking.
- **Copy lives in `src/content/`** (`site.ts`, `services.ts`). Components never
  hard-code user-facing strings. Client-supplied and verbatim: both statements,
  the line under the contact form, `hero.line`, and everything in `about`.
- **Services** are client copy (`services.ts`). The VIP Experiences description
  is a draft. Keep the `{ number, title, description }` shape; rows stay compact.
- **Business tokens** live in one `:root[data-mode="business"]` block in
  `globals.css`. Everything already reads `--paper` / `--ink-rgb` / `--brand`,
  so the whole DOM reskins from those four lines; `.glass` is the one thing
  that needs an override, because a frosted white card is invisible on white.
- **Party face is DARK**, and its ground is the client's reference artwork
  **rebuilt as a field** in `CloudBackdrop`, not the image itself: the source is
  low-res, and the ground has to run the length of the page. It is nine
  flat-topped, rotated, tapered gaussian blobs summed into one scalar, pushed
  through a ramp whose **hues** come from the client's second reference image
  (black → green → teal → blue → violet → magenta → coral) and whose
  **luminance curve is the first ramp's**: it peaks mid-way and then runs a
  long dark tail *back to black*, so the mass's dark core is its hottest
  point. Both halves matter — taking the new reference's own luminance (it
  ends at cream) kept the hues but lit up the middle of every screen, and the
  statements, the about copy and the contact form lost the dark ground they
  are set on. Match the curve, swap the hues. The blob parameters were **fitted**, not eyeballed:
  colour-space least squares against a blurred copy of the reference. That is
  the fix for the first procedural attempt, which matched the image's
  statistics and missed its composition. (Those statistics misled for another
  reason too: the image is *bimodal*, 43% near-black against a bright half at
  median saturation 0.93, so averaging bands gave muddy rust. Never
  characterise a high-contrast image by its means.) Refit if the reference
  changes.
  **It scrolls** at `PARALLAX` 0.75 of the page. The first screen is the
  reference. Below it the page is a vertical *mirror fold* of it (`FOLD`),
  with the field held constant in y past `EXTEND` so the fold lines have
  nothing to crease, plus a meander that grows in below the hero. Stacking
  copies was tried first and read as tiles: the fitted mass closes just under
  the frame, so each copy became an island with a black gap under it.
  `public/backdrop.jpg` is no longer loaded.
  **The ground is not interactive** — the pointer swirl and lean are gone, and
  with them the noise fields, `uPointer`, `uSwirl` and `uWarm`.
  Ink is white (`255,255,255`) with the 1 / .66 / .4 / .22 / .14 opacity scale;
  `--brand` (`#04EA98`) unchanged, `--accent` lifted to `#FF7A45`.
  **`--shadow-rgb` is separate from `--ink-rgb`** and stays black on both
  faces: they used to be one value, which only worked while ink was dark — with
  white ink every box-shadow became a glow. `color-scheme` is set per face
  there too, so native fields and the OS scrollbar follow.
  Two things had to invert with the face, and will again if the palette
  moves: `.glass` (a white wash blew out and took the white type with it — it
  is smoked now, with a light rim for the edge) and the backdrop's grid
  hairlines (white on this face, black on business).
  No `dark:` variants and no theme toggle — the two faces *are* the toggle.
  **Legibility rule:** the vignette holds the gutters darker, and anything
  dense over colour goes in a `.glass` card.
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
- **Shaders are JS template literals**, and two things in them fail *silently*
  — the quad simply stops drawing, and you see the page background instead of
  a console-obvious error:
  a **backtick in a comment** ends the literal, and a **redeclared variable**
  is a GLSL compile error. Both have happened here; the second one took the
  backdrop *and* the hairline grid out at once, because the grid is drawn in
  that same shader. Before blaming layering or z-index when something WebGL
  disappears, check the shader compiles: duplicate declarations in a scope,
  stray backticks, and uniforms declared but not supplied.
  A third trap, in full-screen shaders: **`uResolution` must be in device
  pixels**, because `gl_FragCoord` is. Divided by the CSS size, uv spans
  0..dpr and on a retina screen the drawing lands off-centre at half size —
  invisible in any test at dpr 1, which is how a centred ring survived three
  rounds of "still not centred". CloudBackdrop does it right (`size * dpr`).
  **Test full-screen shaders at dpr 2.**
- **WebGL layer:** one fixed full-viewport R3F `<Canvas>` behind the page
  (`components/three/`), like the reference. Every section is transparent so
  it shows through the whole page. Scenes read the
  mutable `scrollState` each frame — never React state at 60fps. Reduced motion
  freezes time-based motion but keeps scroll-driven placement.
  - `CloudBackdrop` — full-screen colour field shader (see the party face,
    above). On the business face it paints the poster's ground in
    the hero (`businessRoom`: a deep green glow top-right, fading through
    mint to near-white at the bottom, after the NVIDIA reference), settling to
    one calm grey below it (`uRoom`, hero 0.3–0.85 → `uBusinessPaper` /
    `--paper` `#e7e7e7`), and the grid over it.
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
      * `thickness` is the refraction ray length. It was held small (~0.22 x
        size) while the ground was pale, because a long ray only reached more
        flat paper; against the dark field there is structure to bend, so it
        now runs to ~0.44 x size (eased 15% from 0.52 on request).
      * `envMapIntensity` stays **low** (0.3) — high read as brushed metal.
    The look is clear-with-rainbow-edges, after the reference render: the body
    is near-colourless (`color` `#eef5ff`, long `attenuationDistance`) and the
    colour lives on the edges, from `chromaticAberration` 0.72 (the R/G/B
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
  - (Removed: `LensWord`, a G behind fluted glass. It was the business hero —
    resolving into GTHR on scroll, with a hover reveal — then a static
    backdrop behind the contact form; the client dropped both. In git
    history. Other rejected business heroes: a warm cream/peach redesign, the
    whole word behind glass, an LED wall and audience, a conference stage,
    rings, a meadow and a stippled mountain range.)
  - `WordSheen` (sections/) — the spectral sweep on the business wordmark, and
    the DOM half of the hover above. A second copy of the word laid exactly over
    the first, painted with five blobs in the **party face's thermal colours**
    (teal, blue, violet, magenta, coral) through `background-clip: text`.
    It is a moment, not a hover state, and a *sweep* rather than a fade: a
    moving `mask-image` with two soft edges crosses the word left to right —
    the leading edge brings the colour in (`SHEEN_IN` 0.2s, `REVEAL` 0.8s, so
    it lands with the dots), it holds (`HOLD`), then the trailing edge clears
    it back to black, also left to right (`CLEAR`), even if the pointer stays;
    leaving early starts the clear at once. First background layer paints on
    top, so teal/blue lead (magenta first buried the rest) and the blobs are
    tight so they don't average into brown.
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
    On the business face the lockup and the hero line are now hidden, and the
    hero is **`.hero-poster`** instead (Hero.tsx, copy is `poster` in
    `site.ts`), after the client's NVIDIA poster: absolutely filling `#hero`
    as a four-row grid — the headline top-left in thin white caps on two
    natural lines, evenly tracked (0.14em) — *not* justified: spreading the
    poster's one-word lines ("YOUR", "ONE.") letter by letter read badly —
    a middle row `01\ | label | paragraph` on the 12 columns, and a huge
    left-aligned `GTHR` along the bottom, clear of the bottom bar.
    The
    ground is `businessRoom` in CloudBackdrop. `hero.businessTagline` is no
    longer used.
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
    Bounds are the frustum half-extent **at each sticker's own z**, not at
    z = 0. They sit at z -1.2..-2.4 where the frustum is up to 40% wider, so
    measuring against `viewport` walled a thrown one in at ~75% of the visible
    width — it bounced off nothing, short of the edge. The *drift* path is
    deliberately tighter than that (0.58/0.52 of the extent) plus a weak pull
    back toward the middle while thrown: at rest they belong near the wordmark,
    where the glass picks them up and refracts them, and only a throw takes
    them out to the edges.
    Picking is done by hand from `window` pointer events, *not* R3F's raycaster:
    the canvas is `pointer-events-none` and `main` covers it, so nothing ever
    reaches the scene. The hit test undoes the root group's scroll offset and
    scale and the sticker's own rotation, and takes the frontmost hit. Party
    face only, and pointer-downs on anything interactive are ignored.
    They **fade out** over the first half of the hero's scroll (opacity on
    every sticker material) rather than riding up and vanishing, and cannot
    be grabbed once mostly faded.
  - `Ticket` — the **party** face's prop for the statements block (Scene
    mounts `Ticket` on party, `Badge` on business). An event ticket after the
    client's reference: a holographic stub (the thermal field's bright middle,
    `paintThermal` lo/hi 0.4–0.8, plus `iridescence`) over a printed paper
    body. Copy is `ticket` in `site.ts`. Centred, 0.667 of the viewport tall.
    **It is ripped, not split.** Each piece is a subdivided plane rather than
    an extrusion, because the tear has to bend the paper and an extruded face
    has no interior vertices. So `tearMaterial` splices into the stock
    materials: the die-cut outline (per-corner radii, perforation notches,
    punched holes) and the **perforation** are a signed distance cut in the
    fragment shader. It parts *along the perforation*, not like free paper (a
    ragged, fibrous edge was tried first and rejected): real holes run the
    line (each piece cuts its half of every circle, so it reads as one row
    before the tear), and behind the tear front each snapped bridge leaves a
    small nub on one side — complementary between the pieces — with a white
    hairline of bare stock; the **curl** is a vertex lift near the torn edge, only behind the
    tear front, kept small because ticket stock lifts rather than rolls.
    **One continuous motion** over `statement` 0 → 0.69, never parked (a
    rise / stop / rip / leave version read as three moves): it rises turned
    ~15° and unwinding, on an ease-out that lands on a slow constant drift so
    it never stops; `uFront` runs right to left along the perforation *while
    it is still rising*; the halves hinge open about the point still
    attached (position = P − R(a)P), fold toward the viewer, and before the
    rip is done start flying (eased *in*) past opposite corners — stub
    top-left, body bottom-right — and 4 units back, crossing the frame edge
    just before services comes up (~0.667). The sideways travel (2.4
    half-extents) has to outrun the frame widening with depth or the halves
    shrink into the middle instead of leaving. The back face
    is plain stock (`gl_FrontFacing`).
  - `canvasPaint.ts` — shared by the baked textures: `pageFonts`, the thermal
    ramp on the CPU (`rampAt`, `paintThermal`), `paintPaper`, `hash2`.
  - `Badge` — the **business** face's prop for the statements block: a lanyard badge
    (canvas-painted face, printed strap). The clasp follows the client's
    reference photo, in black metal on both faces: strap folded round the bar
    of a D-ring, a swivel eye and barrel, and a snap hook (one tube loop,
    closed all the way round — an open J with a separate gate rod read as broken
    from behind) turned `HOOK_TURN` off the card so its loop threads a
    *real* hole. The strap canvas has the proportions of the strip one texture
    repeat covers (`STRAP_TILE`), and its labels are measured to fit their slot
    — it was squashed to ~65% width and the labels overlapped. The card is one
    `ExtrudeGeometry` — rounded outline + hole — with the face art UV-mapped
    onto its front cap (texture repeat 1/W, 1/H, offset 0.5), so corner radius
    and hole come from the geometry, never the art. A RoundedBox + textured
    plane before it had two radii that disagreed and showed at the corners.
    The face is **the hero poster in miniature** (the NVIDIA reference), mixed
    with the earlier black ID card's working parts: the hero's ground (the
    same stops as `businessRoom`, green glow top-right), `badge.headline` in
    thin tracked white caps top-left, a `01\ | FOCUS | text` row, a rule,
    handle and name, a small hashed QR block and reference line, and `GTHR.`
    fitted to the card's width along the bottom (copy is `badge` in
    `site.ts`). Light edge stock, a slot punch, and **deep-green woven tape**;
    the clasp stays black metal. Textures are *baked* once. (The previous
    face was black stock printed in speckled off-white.)
    **The statement type stays legible over the strap by inversion.**
    Statement ink is black on this face, so it would vanish over the dark
    strap. Each statement carries a white twin (`.statement-invert`, same
    grid cell, business only) and Badge's frame loop projects the strap to
    viewport pixels and sets it as the twin's `clip-path: path(...)` — so
    letters turn white exactly where they cross it. The card is light now,
    so black type reads on it and it is no longer part of the clip (when the
    card was black, its rounded outline was clipped too). CSS `mix-blend-mode` cannot do this: the page scrolls inside a
    fixed wrapper, a separate stacking context, so blending never sees the
    canvas. The twin's reveal is keyed off the base copy
    (`.reveal.is-in + .statement-invert`): Chrome counts the clip against
    IntersectionObserver, so its own reveal only fired once the badge
    overlapped it.
    The matrix pattern is hashed from the cell index, not `Math.random()`, or it
    would shimmer on every repaint. Placeholder artwork until the client's own
    lands. whose pivot travels upper-left -> close past the camera -> lower
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
  - The statements block used to get its own moving treatment (the backdrop
    remapped through thermal-camera bands). **Removed at the client's
    request** — it keeps the same ground as the rest of the page.
    `scrollState.thermal` is still published, because `Badge` gates its
    visibility on it.
- **Chrome:** fixed `TopBar` (wordmark + Services/Contact; on business its
  ink is **white while the hero's green is behind it** — `data-on-green`,
  flipping back to black at hero scroll 0.575, the middle of `uRoom`'s fade —
  done by redeclaring the ink tokens on `.top-bar`, since the derived ones
  resolve at `:root`), `BottomBar`
  (visitor-local `Clock` left, Telegram + X links right),
  `SideScrollbar` (desktop, Lenis-driven), `PixelCursor` (8-bit terracotta
  cursor replacing the OS cursor for fine pointers; hidden over text fields).
  All `pointer-events-none` with only the controls re-enabled.
- **Statements:** `.statement` (Syne 700, caps), both panels
  transparent so the backdrop shows; `StickyFade` fades the pinned one as the
  next slides over.
- **Who are we** (`About.tsx`, id `about`; phones show `About` in the nav
  because the full label overflows the header), identical on both faces:
  eyebrow, the client's about paragraph, a row of four **stats**, and a
  founder line — all client copy in `about` (`site.ts`). The founder cards
  (polaroids, photos, roles, bios) were removed at the client's request, and
  with them `TeamCard`, `BendImages` (the WebGL layer that painted them), the
  polaroid CSS, the `--frame` token and `public/team/`.
  The stats are the section's anchor now there are no photographs. Each sits
  in a **frosted card** after the client's reference — label top-left in the
  mono, the number large and centred, an index (`01`–`04`) bottom-left — on
  the page's 12-column grid, four across (3 columns each) on desktop, two by
  two below `lg`. The cards are the site's own `.glass`, so each face styles
  them: smoked on party; on business `.stat-card` makes them a white frosted
  panel *lighter* than the paper, as the reference's are — the business
  `.glass` is a faint grey wash, darker than the paper, and read as a hole.
  (The stats first opened on a hairline with a `+`; the client had that
  removed.) The numbers count up once
  (`ui/CountUp`), armed the way `Reveal` arms its transitions: the server
  renders the final value, JS only takes it back to zero if it is still below
  the fold, reduced motion leaves it alone, and the final value is laid out
  invisibly underneath so the width never shifts as digits change. `value`
  and `suffix` are kept apart in the copy so nothing parses strings back into
  numbers.
- **Marks:** `src/app/icon.png` (the client's glowing `G`, round-cropped) is
  the favicon, and `src/app/opengraph-image.png` (the same `G`, 1200x630) is
  the link preview — both cut straight out of the client's photograph, window
  and all, because pasting the glyph onto fresh black left a seam where the
  two blacks disagreed. `opengraph-image.alt.txt` carries the alt text. They
  replaced a generated preview card and the starter `favicon.ico`.
- **Contact:** centered form (two-column filled fields after the client's
  reference: name/email, company (optional)/location, then the message; black
  pill submit) → `app/actions/contact.ts` server action → Resend
  REST. Needs `RESEND_API_KEY` (see `.env.example`); without it the form says
  so and points to the email. Telegram and X sit bottom-right
  (`Socials.tsx`; the handles in `site.ts` are placeholders), and the Telegram
  link is reused in the contact copy.
- Text on the left gutter needs an 8px inset (`px-2` / `outline-box` padding)
  so it clears the grid overlay's gutter line.

## Structure

```
src/app/            layout.tsx (fonts, chrome, canvas), page.tsx (section order), globals.css (tokens, reveal + grid CSS)
src/components/
  chrome/           TopBar, BottomBar, Clock, Socials, SmoothScroll, ModeToggle, SideScrollbar, PixelCursor
  sections/         Hero, WordSheen, Statement, StickyFade, Services, About, Contact, ContactForm
  three/            SceneCanvas → Scene (Canvas + tracker), CloudBackdrop (+ the grid),
                    HeroLetters, Stickers + stickerDefs, Badge, Ticket,
                    canvasPaint, Lighting, noise, scrollState
  ui/               Reveal, CountUp
src/app/actions/    contact.ts — server action for the form
src/hooks/          usePrefersReducedMotion, useMediaQuery
src/content/        site.ts, services.ts — all copy
```

## Verify

`npm run dev`, walk the page at 375 / 768 / 1440. `npm run build && npm run lint`
must be clean. Check reduced-motion, keyboard focus order through the fixed bars,
and that the console shows no hydration warnings (the clock renders `--:--:--`
on the server on purpose).
