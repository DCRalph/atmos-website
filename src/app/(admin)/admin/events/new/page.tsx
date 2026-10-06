"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { EventEditor } from "~/components/admin/ticketing/event-editor";

export default function NewTicketEventPage() {
  return (
    <AdminSection
      title="New ticketed event"
      backLink={{ href: "/admin/events", label: "Events" }}
    >
      <EventEditor />
    </AdminSection>
  );
}
