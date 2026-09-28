"use client";

import { useRef, useSyncExternalStore } from "react";
import {
  BADGE_NAME_MAX,
  badgeState,
  setBadgeName,
  stampBadge,
  subscribeBadgeName,
} from "@/components/three/badgeState";
import { poster } from "@/content/site";

const read = () => badgeState.name;

/**
 * Beside the hero CTA: type a name and the badge in the hero prints it on
 * its pass line as you go (three/Badge.tsx repaints from badgeState). Enter,
 * or leaving the field with a name in it, confirms it and the card spins
 * round, as a new pass being issued. The contact form picks the name up for
 * its Name field.
 *
 * Hidden unless the badge is on screen (`data-badge-shown`, set by Badge):
 * on a phone, or where the card does not fit, there is nothing to print on.
 */
export function BadgeNameField() {
  const name = useSyncExternalStore(subscribeBadgeName, read, () => "");
  // One spin per new name: Enter and the blur that follows it, or a second
  // blur with nothing changed, do not spin it again.
  const stamped = useRef("");
  const confirm = () => {
    const value = name.trim();
    if (!value || value === stamped.current) return;
    stamped.current = value;
    stampBadge();
  };

  return (
    <label className="badge-name pointer-events-auto">
      <span className="sr-only">{poster.badgeName.label}</span>
      <svg className="badge-name__icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 13.5 3.6 10.9 10.8 3.7a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L6.1 13.4Z" />
      </svg>
      <input
        type="text"
        value={name}
        maxLength={BADGE_NAME_MAX}
        placeholder={poster.badgeName.placeholder}
        autoComplete="name"
        spellCheck={false}
        onChange={(event) => setBadgeName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            confirm();
            event.currentTarget.blur();
          }
        }}
        onBlur={confirm}
        className="badge-name__input"
      />
    </label>
  );
}
