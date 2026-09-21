import { Clock } from "./Clock";
import { Socials } from "./Socials";

/**
 * Fixed bottom strip. Non-interactive, so it never blocks the page beneath —
 * except the social links, which re-enable pointer events for themselves.
 */
export function BottomBar() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-between px-4 py-4 lg:px-14 lg:py-7"
    >
      {/* Inset 8px so the content clears the grid overlay's gutter lines. */}
      <div className="px-2" aria-hidden="true">
        <Clock />
      </div>
      <nav aria-label="Social" className="px-2">
        <Socials />
      </nav>
    </div>
  );
}
