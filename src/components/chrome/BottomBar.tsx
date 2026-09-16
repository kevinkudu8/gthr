import { Clock } from "./Clock";
import { Globe } from "./Globe";

/** Fixed bottom strip. Non-interactive, so it never blocks the page beneath. */
export function BottomBar() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-between px-4 py-4 lg:px-14 lg:py-7"
      aria-hidden="true"
    >
      {/* Inset 8px so the content clears the grid overlay's gutter lines. */}
      <div className="px-2">
        <Clock />
      </div>
      <div className="px-2 text-ink-1">
        <Globe className="h-6 w-6" />
      </div>
    </div>
  );
}
