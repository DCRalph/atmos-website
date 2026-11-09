"use client";

import { api, type RouterOutputs } from "~/trpc/react";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { STATUS_BADGE } from "./status";

type Row = RouterOutputs["mailouts"]["list"][number];

/** Every mailout, newest first. A row opens its editor or its results. */
export function MailoutsTable() {
  const mailouts = api.mailouts.list.useQuery();
  const lists = api.mailingLists.list.useQuery();
  const listName = (id: string) =>
    lists.data?.find((list) => list.id === id)?.name ?? "Deleted list";

  const columns: DataTableColumn<Row>[] = [
    {
      id: "subject",
      header: "Subject",
      sortable: true,
      accessor: (row) => row.subject,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.subject || (
              <span className="text-muted-foreground">No subject</span>
            )}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {row.listIds.map(listName).join(", ") || "No lists"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      type: "badge",
      sortable: true,
      accessor: (row) => row.status,
      badge: (_, row) => STATUS_BADGE[row.status],
    },
    {
      id: "sent",
      header: "Sent",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.sent,
      cell: (row) => (row.recipients ? `${row.sent} of ${row.recipients}` : ""),
    },
    {
      id: "when",
      header: "When",
      type: "date",
      sortable: true,
      accessor: (row) => row.startedAt ?? row.scheduledFor ?? row.createdAt,
      cell: (row) => {
        const at = row.startedAt ?? row.scheduledFor;
        return at ? (
          formatEventDateTime(at)
        ) : (
          <span className="text-muted-foreground">
            Made {formatEventDateTime(row.createdAt)}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={mailouts.data ?? []}
      getRowId={(row) => row.id}
      isLoading={mailouts.isPending}
      isFetching={mailouts.isFetching}
      getRowHref={(row) => `/admin/mailouts/${row.id}`}
      storageKey="admin-mailouts"
      emptyMessage="No mailouts yet."
    />
  );
}
