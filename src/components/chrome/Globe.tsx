/**
 * Wireframe globe, line art like the reference's. The two meridians animate
 * their width out of phase, which reads as a slow spin. SMIL, so no JS.
 */
export function Globe({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10.5" />
      <line x1="1.5" y1="12" x2="22.5" y2="12" />
      <ellipse cx="12" cy="12" rx="10.5" ry="4.2" />
      <ellipse cx="12" cy="12" rx="4.5" ry="10.5">
        <animate
          attributeName="rx"
          values="10.5;0.3;10.5"
          dur="7s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        />
      </ellipse>
      <ellipse cx="12" cy="12" rx="10.5" ry="10.5">
        <animate
          attributeName="rx"
          values="0.3;10.5;0.3"
          dur="7s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        />
      </ellipse>
    </svg>
  );
}
