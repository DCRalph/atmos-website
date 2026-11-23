"use client";

import Link from "next/link";
import { ExternalLink, ScanLine } from "lucide-react";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { EventOverview } from "~/components/admin/ticketing/event-overview";
import { OrdersPanel } from "~/components/admin/ticketing/orders-panel";
import { TicketsPanel } from "~/components/admin/ticketing/tickets-panel";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTabParam } from "~/hooks/use-tab-param";
import { formatEventDateTime } from "~/lib/ticketing/dates";

/**
 * One event, read-only: analytics, orders and tickets. The organiser's event
 * page, and what a share link opens. `basePath` is the page's own URL, which
 * the live screen sits under as `/live`.
 */
export function ReadOnlyEvent({
  eventId: id,
  basePath,
  backLink,
  showScanner = false,
}: {
  eventId: string;
  basePath: string;
  backLink?: { href: string; label: string };
  /** Offer the scanner to an organiser. Never on a share link. */
  showScanner?: boolean;
}) {
  const event = api.ticketEvents.byId.useQuery({ id });
  const tab = useTabParam(["overview", "orders", "tickets"]);
  // The door is for organisers and rostered staff, not someone granted this
  // event's sales or holding a share link.
  const me = api.user.me.useQuery();
  const isOrganiser =
    me.data?.effectivePermissions.includes("EVENT_ORGANISER") ?? false;

  if (event.isPending) {
    return <Skeleton className="m-6 h-96 w-auto" />;
  }
  if (!event.data) return <div className="p-6">Event not found.</div>;

  const data = event.data;
  return (
    <AdminSection
      title={data.name}
      subtitle={`${formatEventDateTime(data.startsAt, data.timezone)}${
        data.venueName ? ` · ${data.venueName}` : ""
      }`}
      backLink={backLink}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{data.status.toLowerCase()}</Badge>
          <Button variant="outline" asChild>
            <Link href={`/events/${data.slug}`} target="_blank">
              <ExternalLink className="size-4" /> Public page
            </Link>
          </Button>
          {showScanner && isOrganiser && (
            <Button variant="outline" asChild>
              <Link href={`/door/${id}`} target="_blank">
                <ScanLine className="size-4" /> Scanner
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href={`${basePath}/live`}>Live screen</Link>
          </Button>
        </div>
      }
    >
      <Tabs value={tab.value} onValueChange={tab.onValueChange}>
        <TabsList>
          <TabsTrigger value="overview">Analytics</TabsTrigger>
          <TabsTrigger value="orders">
            Orders
            <span className="text-muted-foreground tabular-nums">
              {data.counts.orders}
            </span>
          </TabsTrigger>
          <TabsTrigger value="tickets">
            Tickets
            <span className="text-muted-foreground tabular-nums">
              {data.counts.tickets}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-2">
          <EventOverview
            eventId={id}
            liveHref={`${basePath}/live`}
            ordersHref={`${basePath}?tab=orders`}
          />
        </TabsContent>
        <TabsContent value="orders" className="mt-2">
          <OrdersPanel eventId={id} readOnly />
        </TabsContent>
        <TabsContent value="tickets" className="mt-2">
          <TicketsPanel eventId={id} readOnly />
        </TabsContent>
      </Tabs>
    </AdminSection>
  );
}
