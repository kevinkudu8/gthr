"use client";

import Link from "next/link";
import { ModeToggle } from "@/components/chrome/ModeToggle";
import { nav, site } from "@/content/site";
import { useScrollTo } from "./SmoothScroll";

/**
 * Fixed top strip: wordmark left, small ink section links right. Links are
 * real anchors so they work without JS; with Lenis running they smooth-scroll.
 *
 * It no longer tracks what is behind it. While the business hero had a green
 * gradient, the bar's ink turned white over it and back to black below —
 * a scroll listener and a `data-on-green` attribute, both gone with that
 * gradient. The business ground is one flat paper colour now.
 */
export function TopBar() {
  const scrollTo = useScrollTo();

  return (
    <header
      className="top-bar pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 py-4 font-mono lg:px-14 lg:py-7"
    >
      <Link
        href="/"
        className="outline-box outline-box--dotted pointer-events-auto text-sm text-ink-1 lg:text-base"
        aria-label={`${site.name} home`}
      >
        {site.name}
        {/* Dropped on narrow headers, where the mode toggle needs the room. */}
        <span className="hidden sm:inline">{site.wordmarkSuffix}</span>
      </Link>
      <div className="flex items-center gap-x-2.5 sm:gap-x-3 lg:gap-x-6">
        <nav aria-label="Sections">
          <ul className="pointer-events-auto flex items-center gap-x-2.5 sm:gap-x-3 lg:gap-x-7">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={(event) => scrollTo(event, item.href)}
                  className="link-min whitespace-nowrap text-[11px] tracking-[0.06em] text-ink-1 lg:text-xs"
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ModeToggle />
      </div>
    </header>
  );
}
