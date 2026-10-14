"use client";

import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTabParam } from "~/hooks/use-tab-param";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import type { RouterOutputs } from "~/trpc/react";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";
import { soldFaceValueCents } from "~/lib/ticketing/tiers";

export type TicketEventRow = RouterOutputs["ticketEvents"]["list"][number];

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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  SALES_PAUSED: "Sales paused",
  SOLD_OUT: "Sold out",
  CANCELLED: "Cancelled",
  ARCHIVED: "Archived",
};

const statusLabel = (status: string) => STATUS_LABELS[status] ?? status;

/** An event's status, the same badge in the list and on the event page. */
export function EventStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {statusLabel(status)}
    </Badge>
  );
}

const faceValueCents = (event: TicketEventRow) =>
  event.tiers.reduce((sum, tier) => sum + soldFaceValueCents(tier), 0);

/**
 * The ticketed events list split into live and archived tabs, so an archived
 * event is out of the way but still one click from being found. Takes every
 * event, archived included.
 */
export function TicketEventsTabs({
  rows,
  ...table
}: Omit<Parameters<typeof TicketEventsTable>[0], "emptyMessage">) {
  const tab = useTabParam(["events", "archived"]);
  const archived = rows.filter((row) => row.status === "ARCHIVED");
  const live = rows.filter((row) => row.status !== "ARCHIVED");

  return (
    <Tabs
      value={tab.value}
      onValueChange={tab.onValueChange}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="events">
          Events
          <span className="text-muted-foreground tabular-nums">
            {live.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="archived">
          Archived
          <span className="text-muted-foreground tabular-nums">
            {archived.length}
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="events">
        <TicketEventsTable {...table} rows={live} />
      </TabsContent>
      <TabsContent value="archived">
        <TicketEventsTable
          {...table}
          rows={archived}
          emptyMessage="Nothing archived. Archive an event from its menu to move it here."
        />
      </TabsContent>
    </Tabs>
  );
}

/**
 * The ticketed events list. Admin and organiser show the same rows and differ
 * only in where a row goes, so they share this rather than each keeping their
 * own copy of the columns.
 */
export function TicketEventsTable({
  rows,
  basePath,
  isLoading,
  isFetching,
  storageKey,
  emptyMessage = "No ticketed events yet.",
}: {
  rows: TicketEventRow[];
  /** Row click destination, e.g. `/admin/events`. */
  basePath: string;
  isLoading?: boolean;
  isFetching?: boolean;
  storageKey: string;
  emptyMessage?: string;
}) {
  const columns: DataTableColumn<TicketEventRow>[] = [
    {
      id: "name",
      header: "Event",
      sortable: true,
      accessor: (row) => row.name,
      className: "font-medium",
    },
    {
      id: "status",
      header: "Status",
      type: "badge",
      sortable: true,
      accessor: (row) => statusLabel(row.status),
      badge: (_value, row) => ({
        label: statusLabel(row.status),
        variant: STATUS_VARIANT[row.status] ?? "outline",
      }),
    },
    {
      id: "startsAt",
      header: "Starts",
      type: "date",
      sortable: true,
      accessor: (row) => row.startsAt,
      cell: (row) => formatEventDateTime(row.startsAt, row.timezone),
    },
    {
      id: "venue",
      header: "Venue",
      sortable: true,
      accessor: (row) => row.venueName,
      cell: (row) => row.venueName ?? "—",
    },
    {
      id: "gig",
      header: "Gig",
      cell: (row) =>
        row.gig ? <Badge variant="outline">{row.gig.title}</Badge> : "—",
    },
    {
      id: "sold",
      header: "Sold",
      type: "number",
      sortable: true,
      align: "right",
      accessor: (row) => row.totalSold,
      cell: (row) => (
        <span className="tabular-nums">
          {row.totalSold}
          <span className="text-muted-foreground">/{row.totalAllocation}</span>
        </span>
      ),
    },
    {
      id: "faceValue",
      header: "Face value",
      type: "number",
      sortable: true,
      align: "right",
      accessor: faceValueCents,
      cell: (row) => (
        <span className="tabular-nums">{formatNZD(faceValueCents(row))}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isFetching={isFetching}
      getRowHref={(row) => `${basePath}/${row.id}`}
      storageKey={storageKey}
      emptyMessage={emptyMessage}
    />
  );
}
