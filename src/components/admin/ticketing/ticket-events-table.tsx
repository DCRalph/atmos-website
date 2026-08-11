"use client";

import { useRouter } from "next/navigation";

import { Badge } from "~/components/ui/badge";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import type { RouterOutputs } from "~/trpc/react";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";

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

const statusLabel = (status: string) => status.replace("_", " ").toLowerCase();

const faceValueCents = (event: TicketEventRow) =>
  event.tiers.reduce((sum, tier) => sum + tier.soldCount * tier.priceCents, 0);

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
}: {
  rows: TicketEventRow[];
  /** Row click destination, e.g. `/admin/events`. */
  basePath: string;
  isLoading?: boolean;
  isFetching?: boolean;
  storageKey: string;
}) {
  const router = useRouter();

  const columns: DataTableColumn<TicketEventRow>[] = [
    {
      id: "name",
      header: "Event",
      accessor: (row) => row.name,
      className: "font-medium",
    },
    {
      id: "status",
      header: "Status",
      type: "badge",
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
      accessor: (row) => row.startsAt,
      cell: (row) => formatEventDateTime(row.startsAt, row.timezone),
    },
    {
      id: "venue",
      header: "Venue",
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
      onRowClick={(row) => router.push(`${basePath}/${row.id}`)}
      storageKey={storageKey}
      emptyMessage="No ticketed events yet."
    />
  );
}
