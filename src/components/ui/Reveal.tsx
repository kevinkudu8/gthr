"use client";

import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

type Props = {
  as?: "div" | "p" | "h2" | "h3" | "li" | "span";
  className?: string;
  children: ReactNode;
  /** Extra delay in ms before this element starts. */
  delay?: number;
  /**
   * Split a string into words and rise them in line by line. Words on the
   * same rendered line share a delay, so it reads as lines, not words.
   */
  lines?: boolean;
  id?: string;
};

/**
 * Scroll-triggered reveal. Hidden state is only applied once JS has armed the
 * element (`data-armed`), so content is never invisible without JS.
 * Motion is CSS — see `.reveal-*` in globals.css.
 */
export function Reveal({
  as = "div",
  className = "",
  children,
  delay = 0,
  lines = false,
  id,
}: Props) {
  // All allowed tags take the same props; typing as "div" keeps TSX happy.
  const Tag = as as "div";
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const assignLines = () => {
      if (!lines) return;
      let line = -1;
      let lastTop = Number.NEGATIVE_INFINITY;
      el.querySelectorAll<HTMLElement>(".reveal-word").forEach((word) => {
        const top = word.offsetTop;
        if (Math.abs(top - lastTop) > 2) {
          line += 1;
          lastTop = top;
        }
        word.style.setProperty("--i", String(line));
      });
    };

    assignLines();
    el.dataset.armed = "";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-in");
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);

    const resize = lines ? new ResizeObserver(assignLines) : null;
    resize?.observe(el);

    return () => {
      observer.disconnect();
      resize?.disconnect();
    };
  }, [lines]);

  const content =
    lines && typeof children === "string" ? splitWords(children) : children;
  const style = { "--d": `${delay}ms` } as CSSProperties;

  return (
    <Tag
      ref={ref}
      id={id}
      className={`reveal ${lines ? "reveal-lines" : "reveal-block"} ${className}`}
      style={style}
    >
      {content}
    </Tag>
  );
}

function splitWords(text: string) {
  return text.split(/(\s+)/).map((part, index) =>
    /^\s+$/.test(part) ? (
      " "
    ) : (
      <span key={index} className="reveal-word">
        <span className="reveal-word-inner">{part}</span>
      </span>
    ),
  );
}
