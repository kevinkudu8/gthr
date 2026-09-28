/**
 * The name a visitor has put on the business hero's badge, shared by the
 * field that takes it (sections/BadgeNameField.tsx), the badge that prints it
 * (three/Badge.tsx, which repaints its face when `version` moves), and the
 * contact form, which carries it into its Name field. A module store, like
 * scrollState, so the WebGL frame loop can read it without React.
 */

/** Longest name the card's pass line can take at a readable size. */
export const BADGE_NAME_MAX = 24;

const listeners = new Set<() => void>();

export const badgeState = {
  name: "",
  /** Bumped on every change; Badge repaints when it moves. */
  version: 0,
  /** Bumped when a name is confirmed; Badge spins the card, as a new pass. */
  stamps: 0,
};

export function setBadgeName(name: string) {
  const next = name.slice(0, BADGE_NAME_MAX);
  if (next === badgeState.name) return;
  badgeState.name = next;
  badgeState.version++;
  listeners.forEach((listener) => listener());
}

export function stampBadge() {
  badgeState.stamps++;
}

export function subscribeBadgeName(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
