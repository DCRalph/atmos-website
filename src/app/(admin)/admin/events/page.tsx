"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  PUBLISHED: "default",
  SALES_PAUSED: "secondary",
  SOLD_OUT: "secondary",
  CANCELLED: "destructive",
  ARCHIVED: "outline",
};

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
      {events.isPending && <Skeleton className="h-40 w-full" />}

      {events.data?.length === 0 && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          No ticketed events yet.
        </p>
      )}

      <div className="space-y-3">
        {events.data?.map((event) => (
          <Link
            key={event.id}
            href={`/admin/events/${event.id}`}
            className="hover:bg-accent/40 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 transition-colors"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{event.name}</span>
                <Badge variant={STATUS_VARIANT[event.status] ?? "outline"}>
                  {event.status.replace("_", " ").toLowerCase()}
                </Badge>
                {event.gig && (
                  <Badge variant="outline">gig: {event.gig.title}</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatEventDateTime(event.startsAt, event.timezone)}
                {event.venueName ? ` · ${event.venueName}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {event.totalSold}
                  <span className="text-muted-foreground font-normal">
                    /{event.totalAllocation}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">sold</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {formatNZD(
                    event.tiers.reduce(
                      (sum, tier) => sum + tier.soldCount * tier.priceCents,
                      0,
                    ),
                  )}
                </p>
                <p className="text-muted-foreground text-xs">face value</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AdminSection>
  );
}
