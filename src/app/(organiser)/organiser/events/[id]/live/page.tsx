"use client";

import { useParams } from "next/navigation";
import { LiveDoorAnalytics } from "~/components/admin/ticketing/live-door-analytics";

export default function OrganiserLiveDoorPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <LiveDoorAnalytics eventId={id} backHref={`/organiser/events/${id}`} />
  );
}
