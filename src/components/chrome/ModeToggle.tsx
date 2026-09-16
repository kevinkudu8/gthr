"use client";

import { useMode, type Mode } from "@/components/mode/ModeProvider";
import { modes } from "@/content/site";

/**
 * Segmented control in the top bar. Two real radio inputs under the hood, so
 * it is reachable by keyboard and announced as a group; the sliding indicator
 * is a sibling element positioned from the checked index.
 */
export function ModeToggle() {
  const { mode, setMode } = useMode();
  const index = modes.findIndex((m) => m.id === mode);

  return (
    <fieldset className="mode-toggle pointer-events-auto">
      <legend className="sr-only">Site mode</legend>
      <span
        aria-hidden="true"
        className="mode-toggle__thumb"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {modes.map((m) => (
        <label key={m.id} className="mode-toggle__option">
          <input
            type="radio"
            name="mode"
            value={m.id}
            checked={mode === m.id}
            onChange={() => setMode(m.id as Mode)}
            className="sr-only"
          />
          {/* The full word needs room the narrow header does not have. */}
          <span className="sm:hidden">{m.short}</span>
          <span className="hidden sm:inline">{m.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
