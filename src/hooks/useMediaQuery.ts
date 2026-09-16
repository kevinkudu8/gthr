"use client";

import { useSyncExternalStore } from "react";

/** Live media-query match. False on the server and during hydration. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below Tailwind's `lg` breakpoint. */
export const useIsMobile = () => useMediaQuery("(max-width: 63.99rem)");
