"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { TicketEventsTable } from "~/components/admin/ticketing/ticket-events-table";

export default function AdminEventsPage() {
  const events = api.ticketEvents.list.useQuery({ includeArchived: false });

  return (
    <AdminSection
      title="Ticketed events"
      description="Sell tickets, run the door, and see how it went."
      actions={
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus className="size-4" /> New event
          </Link>
        </Button>
      }
    >
      <TicketEventsTable
        rows={events.data ?? []}
        basePath="/admin/events"
        isLoading={events.isPending}
        isFetching={events.isFetching}
        storageKey="admin-ticket-events"
      />
    </AdminSection>
  );
}
