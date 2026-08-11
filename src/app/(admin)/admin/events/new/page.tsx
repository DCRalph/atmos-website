"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { EventForm } from "~/components/admin/ticketing/event-form";

export default function NewTicketEventPage() {
  return (
    <AdminSection
      title="New ticketed event"
      description="Create the event first, then add tiers before publishing."
      backLink={{ href: "/admin/events", label: "← Events" }}
      maxWidth="max-w-4xl"
    >
      <EventForm />
    </AdminSection>
  );
}
