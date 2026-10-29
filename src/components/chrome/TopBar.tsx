"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
 *
 * Below lg the links fold into a menu (client request): a round button
 * beside the mode toggle opens a full-screen sheet with the same links,
 * large and centred. Escape, a link, or the button again closes it.
 */
export function TopBar() {
  const scrollTo = useScrollTo();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
          <ul className="pointer-events-auto hidden items-center lg:flex gap-x-2.5 sm:gap-x-3 lg:gap-x-7">
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
        <button
          ref={button}
          type="button"
          className="menu-toggle pointer-events-auto"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((was) => !was)}
        >
          <span className="menu-toggle__bar" />
          <span className="menu-toggle__bar" />
        </button>
      </div>
      {/* A tap on the sheet's empty space closes it too. */}
      <div
        id="site-menu"
        className="menu-sheet"
        data-open={open || undefined}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <nav aria-label="Menu">
          <ul className="menu-sheet__list">
            {nav.map((item, index) => (
              <li key={item.href}>
                <a
                  ref={index === 0 ? firstLink : undefined}
                  href={item.href}
                  onClick={(event) => {
                    setOpen(false);
                    scrollTo(event, item.href);
                  }}
                  className="menu-sheet__link"
                  style={{ "--i": index } as CSSProperties}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
