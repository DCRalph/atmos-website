"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

// Client only: the screen is all clocks and countdowns, which can never
// match a server render, and every number on it is fetched in the browser.
const LiveScreen = dynamic(
  () =>
    import("~/components/admin/ticketing/live-screen/live-screen").then(
      (mod) => mod.LiveScreen,
    ),
  { ssr: false },
);

export default function OrganiserLiveScreenPage() {
  const { id } = useParams<{ id: string }>();
  return <LiveScreen eventId={id} backHref={`/organiser/events/${id}`} />;
}
