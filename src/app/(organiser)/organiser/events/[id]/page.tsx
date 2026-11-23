"use client";

import { useParams } from "next/navigation";

import { ReadOnlyEvent } from "~/components/admin/ticketing/read-only-event";

export default function OrganiserEventPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ReadOnlyEvent
      eventId={id}
      basePath={`/organiser/events/${id}`}
      backLink={{ href: "/organiser/events", label: "Events" }}
      showScanner
    />
  );
}
