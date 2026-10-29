"use client";

import dynamic from "next/dynamic";

// Browser-only, like the scene canvas: three + R3F stay out of the server bundle.
export const PhoneBadgeSlot = dynamic(() => import("./PhoneBadge").then((m) => m.PhoneBadge), {
  ssr: false,
});
