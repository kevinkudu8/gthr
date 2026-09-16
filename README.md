# GTHR

Single-page site for GTHR — end-to-end creative collaborators for events, from
pitch to post.

Next.js 16 · React 19 · Tailwind v4 · TypeScript · Lenis · Three.js (React Three Fiber).

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Where things live

| Want to change… | Edit |
|---|---|
| Any copy (hero, intro, statements, contact, socials) | `src/content/site.ts` |
| Services rows | `src/content/services.ts` |
| Colours | top of `src/app/globals.css` (`--paper`, `--ink-rgb`, `--brand`, `--accent`) |
| Fonts | `src/app/layout.tsx` |
| Section order | `src/app/page.tsx` |
| Business-face colours | the `:root[data-mode="business"]` block in `src/app/globals.css` |
| Either wordmark's typeface | regenerate a `*.typeface.json` (see Notes), then `FACES` in `src/components/three/HeroLetters.tsx` |
| The intro square image | `public/intro.jpg` (or .png / .webp) — picked up automatically |
| Team photos, names, roles, bios | `public/team/*.jpg` + the `about` block in `src/content/site.ts` |
| 3D letters / arrow / particles | `src/components/three/` |
| Grid overlay, side scrollbar | `src/components/chrome/` |

## Notes

- Light only, no theme toggle. Colour comes from the animated backdrop; text
  is always ink on paper or in a frosted `.glass` card.
- Smooth scroll is Lenis on the document; it switches itself off for
  `prefers-reduced-motion`, and the 3D scene stops animating (scroll placement
  still works).
- There are two faces, switched by the top-bar toggle and remembered in
  `localStorage`: **party** (default) and **business** (white, corporate
  green, metal marque). Same layout and copy in both.
- Each face's 3D wordmark is one glyph baked offline into a
  `*.typeface.json`: `pacifico-gthr` (cursive `gthr`) and `gthr-business`
  (`GTHR`, Inter with a pixel `G` in Silkscreen). Regenerate with the
  fontTools + shapely scripts if a wordmark changes.
- The contact form sends through Resend. Copy `.env.example` to `.env.local`
  and set `RESEND_API_KEY` (plus `CONTACT_TO` / `CONTACT_FROM`). Without a key
  the form tells visitors to email instead.
- VIP Experiences description, the contact headline, and the hero line are drafts.
- `AGENTS.md` is written by `next dev` — leave it.
