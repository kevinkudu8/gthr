import { socials } from "@/content/site";

/** Brand glyphs, 24-unit boxes, filled with the current ink. */
const ICONS: Record<(typeof socials)[number]["id"], string> = {
  telegram:
    "M21.43 3.26 2.65 10.5c-1.28.51-1.27 1.23-.23 1.55l4.82 1.5 11.15-7.03c.53-.32 1.01-.15.61.2l-9.03 8.15-.35 5.02c.49 0 .71-.23.99-.5l2.37-2.3 4.93 3.64c.91.5 1.56.24 1.79-.84l3.24-15.26c.33-1.33-.51-1.93-1.51-1.37Z",
  x: "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12Z",
};

/** Bottom-right social links. The bar around them is inert; these are not. */
export function Socials() {
  return (
    <ul className="pointer-events-auto flex items-center gap-x-4">
      {socials.map((s) => (
        <li key={s.id}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            className="block text-ink-1 transition-opacity hover:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d={ICONS[s.id]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
