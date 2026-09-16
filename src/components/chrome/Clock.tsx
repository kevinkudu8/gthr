"use client";

import { useEffect, useState } from "react";

const PLACEHOLDER = "--:--:--";

/**
 * Visitor's local time with a short timezone label (e.g. "EST 14:32:07").
 * Renders the placeholder on the server and first paint so the HTML never
 * disagrees with the client.
 */
export function Clock() {
  const [time, setTime] = useState(PLACEHOLDER);
  const [zone, setZone] = useState("");

  useEffect(() => {
    const timeFormat = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const zoneFormat = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    });

    const tick = () => {
      const now = new Date();
      setTime(timeFormat.format(now));
      const zonePart = zoneFormat
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName");
      setZone(zonePart?.value ?? "");
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time
      className="flex items-center gap-3 font-mono text-xs tabular-nums text-ink-2 lg:text-sm"
      aria-live="off"
    >
      {zone ? <span className="text-ink-3">{zone}</span> : null}
      <span>{time}</span>
    </time>
  );
}
