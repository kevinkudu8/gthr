"use client";

import { poster } from "@/content/site";
import { useScrollTo } from "@/components/chrome/SmoothScroll";

/**
 * The business hero's call to action: a mint pill that eases down to the
 * contact form. Split out of Hero so the section itself stays a server
 * component — only the click handler needs the client, and it is the same
 * `useScrollTo` the top bar's nav uses, so the two behave identically.
 *
 * A real `href` either way: without Lenis (reduced motion, or before it
 * mounts) the hook stands aside and the browser takes the anchor.
 *
 * Business face only — `.hero-poster` is `display: none` on party, which
 * takes this with it.
 */
export function HeroCta() {
  const scrollTo = useScrollTo();

  return (
    <a
      href={poster.cta.href}
      onClick={(event) => scrollTo(event, poster.cta.href)}
      className="cta hero-poster__cta pointer-events-auto"
    >
      {poster.cta.label}
      <span className="cta__arrow" aria-hidden="true">
        &rarr;
      </span>
    </a>
  );
}
