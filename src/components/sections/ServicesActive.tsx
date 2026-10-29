"use client";

import { useEffect } from "react";

/**
 * On touch screens there is no hover, so the service row crossing the middle
 * of the screen is the active one (`data-active`), and gets the mint marker
 * behind its title as it scrolls through. With a mouse, `:hover` does it in
 * CSS and this does nothing.
 */
export function ServicesActive() {
  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) return;
    const rows = Array.from(document.querySelectorAll<HTMLElement>("#services ol > li"));
    if (!rows.length) return;
    const inBand = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = entry.target as HTMLElement;
          if (entry.isIntersecting) inBand.add(row);
          else inBand.delete(row);
        }
        // One at a time: the first row in the band, in page order.
        const active = rows.find((row) => inBand.has(row));
        for (const row of rows) {
          if (row === active) row.dataset.active = "";
          else delete row.dataset.active;
        }
      },
      // A thin band across the middle of the screen.
      { rootMargin: "-46% 0px -46% 0px" },
    );
    rows.forEach((row) => observer.observe(row));
    return () => {
      observer.disconnect();
      rows.forEach((row) => delete row.dataset.active);
    };
  }, []);

  return null;
}
