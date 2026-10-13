"use client";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { TicketEventsTabs } from "~/components/admin/ticketing/ticket-events-table";

export default function OrganiserEventsPage() {
  const events = api.ticketEvents.list.useQuery({ includeArchived: true });

  return (
    <AdminSection
      title="Ticketed events"
      description="Read-only event details, sales, attendance, orders, and exports."
    >
      <TicketEventsTabs
        rows={events.data ?? []}
        basePath="/organiser/events"
        isLoading={events.isPending}
        isFetching={events.isFetching}
        storageKey="organiser-ticket-events"
      />
    </AdminSection>
  );
}
