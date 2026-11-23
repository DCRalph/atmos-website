"use client";

import dynamic from "next/dynamic";

// Client only, like the organiser's: the screen is all clocks and countdowns,
// which can never match a server render.
export const SharedLiveScreen = dynamic(
  () =>
    import("~/components/admin/ticketing/live-screen/live-screen").then(
      (mod) => mod.LiveScreen,
    ),
  { ssr: false },
);
