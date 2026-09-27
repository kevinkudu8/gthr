"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type Photo = { src: string; alt: string };

type Props = {
  photos: readonly Photo[];
  /** Accessible names: the region, and the two arrows. */
  labels: { region: string; previous: string; next: string };
  /** Ms each photo holds before the next fades in. */
  interval?: number;
  className?: string;
};

/**
 * A stack of photos that crossfade on a timer. Every photo is laid out in the
 * same box and only opacity changes, so nothing shifts. The timer pauses while
 * the pointer or focus is inside and stops under reduced motion, where the
 * arrows still step through. The section sits below the fold, so every photo
 * loads lazily.
 */
export function PhotoSlides({ photos, labels, interval = 4250, className = "" }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const count = photos.length;

  useEffect(() => {
    if (paused || reducedMotion || count < 2) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearTimeout(id);
  }, [index, paused, reducedMotion, count, interval]);

  const step = (by: number) => setIndex((i) => (i + by + count) % count);

  return (
    <div
      className={`group relative overflow-hidden rounded-[1.1rem] lg:rounded-[1.5rem] ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.region}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {photos.map((photo, i) => (
        <Image
          key={photo.src}
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1024px) 42vw, 100vw"
          aria-hidden={i !== index}
          className={`object-cover transition-opacity duration-1000 ease-out motion-reduce:transition-none ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/55 to-transparent p-3 pt-10 text-white lg:p-4 lg:pt-12">
        <span className="eyebrow tabular-nums text-white!" aria-live={paused ? "polite" : "off"}>
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={labels.previous}
            className="grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-md transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-white"
          >
            <span aria-hidden>←</span>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={labels.next}
            className="grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-md transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-white"
          >
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
