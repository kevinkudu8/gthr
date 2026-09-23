"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { ModeToggle } from "@/components/chrome/ModeToggle";
import { nav, site } from "@/content/site";
import { useLenisInstance } from "./SmoothScroll";

/**
 * Fixed top strip: wordmark left, small ink section links right. Links are
 * real anchors so they work without JS; with Lenis running they smooth-scroll.
 * Lenis honours each section's `scroll-margin-top` itself, so no offset here.
 *
 * `data-on-green` marks while the business hero's green ground is still
 * behind the bar; the bar's ink turns white for it (globals.css). The ground
 * fades to paper over hero scroll 0.3–0.85 (CloudBackdrop's `uRoom`), so the
 * bar flips back at the middle of that fade.
 */
const GREEN_UNTIL = 0.575;

export function TopBar() {
  const lenis = useLenisInstance();
  const [onGreen, setOnGreen] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const update = () => {
      const top = hero?.getBoundingClientRect().top ?? 0;
      setOnGreen(-top / Math.max(1, window.innerHeight) < GREEN_UNTIL);
    };
    update();
    document.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollTo = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!lenis) return;
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target);
    history.replaceState(null, "", href);
  };

  return (
    <header
      data-on-green={onGreen || undefined}
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
