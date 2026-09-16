/**
 * Placeholder square artwork in brand colours. Deterministic per `seed`, so it
 * never shifts between renders. Swap for a real image when one exists.
 */

type Props = {
  seed?: number;
  label?: string;
  className?: string;
};

/** Small LCG so the composition is stable for a given seed. */
function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function AbstractVisual({
  seed = 1,
  label = "Abstract placeholder artwork",
  className = "",
}: Props) {
  const next = random(seed);
  const size = 400;

  const arcs = Array.from({ length: 5 }, (_, index) => {
    const radius = 60 + next() * 150;
    const cx = size * (0.3 + next() * 0.4);
    const cy = size * (0.3 + next() * 0.4);
    const start = next() * Math.PI * 2;
    const sweep = Math.PI * (0.4 + next() * 0.9);
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(start + sweep);
    const y2 = cy + radius * Math.sin(start + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      width: 6 + next() * 22,
      tone: index === 0 ? "brand" : index === 1 ? "accent" : "ink",
    };
  });

  const discX = size * (0.55 + next() * 0.25);
  const discY = size * (0.2 + next() * 0.25);
  const discR = 24 + next() * 36;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className={`block h-full w-full ${className}`}
    >
      <rect width={size} height={size} fill="var(--paper-elevated)" />
      {arcs.map((arc, index) => (
        <path
          key={index}
          d={arc.d}
          fill="none"
          stroke={
            arc.tone === "brand"
              ? "var(--brand)"
              : arc.tone === "accent"
                ? "var(--accent)"
                : "var(--ink-4)"
          }
          strokeWidth={arc.width}
          strokeLinecap="butt"
        />
      ))}
      <circle cx={discX} cy={discY} r={discR} fill="var(--brand)" />
    </svg>
  );
}
