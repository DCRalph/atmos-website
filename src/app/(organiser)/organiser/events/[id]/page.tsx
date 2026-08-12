"use client";

import Link from "next/link";
import { ExternalLink, ScanLine } from "lucide-react";
import { useParams } from "next/navigation";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { EventOverview } from "~/components/admin/ticketing/event-overview";
import { OrdersPanel } from "~/components/admin/ticketing/orders-panel";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatEventDateTime } from "~/lib/ticketing/dates";

export default function OrganiserEventPage() {
  const { id } = useParams<{ id: string }>();
  const event = api.ticketEvents.byId.useQuery({ id }, { enabled: !!id });

  if (event.isPending) {
    return <Skeleton className="m-8 h-96 w-auto" />;
  }
  if (!event.data) return <div className="p-8">Event not found.</div>;

  const data = event.data;
  return (
    <AdminSection
      title={data.name}
      subtitle={`${formatEventDateTime(data.startsAt, data.timezone)}${
        data.venueName ? ` · ${data.venueName}` : ""
      }`}
      backLink={{ href: "/organiser/events", label: "← Events" }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{data.status.toLowerCase()}</Badge>
          <Button variant="outline" asChild>
            <Link href={`/events/${data.slug}`} target="_blank">
              <ExternalLink className="size-4" /> Public page
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/door/${id}`} target="_blank">
              <ScanLine className="size-4" /> Scanner
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/organiser/events/${id}/live`}>Live door</Link>
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Analytics</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <EventOverview
            eventId={id}
            liveHref={`/organiser/events/${id}/live`}
          />
        </TabsContent>
        <TabsContent value="orders" className="mt-6">
          <OrdersPanel eventId={id} readOnly />
        </TabsContent>
      </Tabs>
    </AdminSection>
  );
}
