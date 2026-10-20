"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { useConfirm } from "~/components/confirm-provider";
import { VenueDialog } from "./venue-dialog";
import { VenueLogo, type PickedVenue } from "./venue-picker";

/** The venues table on /admin/venues, with create, edit and delete. */
export function VenuesManager() {
  const confirm = useConfirm();
  const utils = api.useUtils();
  // `undefined` while closed, `null` for a new venue, the row when editing.
  const [editing, setEditing] = useState<PickedVenue | null | undefined>();

  const venues = api.venues.list.useQuery();
  const deleteVenue = api.venues.delete.useMutation({
    onSuccess: () => {
      toast.success("Venue deleted");
      void utils.venues.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = venues.data ?? [];
  type VenueRow = (typeof rows)[number];
  const columns: DataTableColumn<VenueRow>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      accessor: (row) => row.name,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <VenueLogo venue={row} size={32} />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      id: "address",
      header: "Address",
      sortable: true,
      accessor: (row) => row.address,
      cell: (row) => row.address ?? "—",
    },
    {
      id: "used",
      header: "Used on",
      sortable: true,
      accessor: (row) => row._count.gigs + row._count.ticketEvents,
      cell: (row) =>
        `${row._count.gigs} gigs, ${row._count.ticketEvents} events`,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteVenue.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${row.name}?`,
                description:
                  "Its gigs and events lose the venue and its logo. Events keep the name and address as text.",
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) deleteVenue.mutate({ id: row.id });
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex justify-end">
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add venue
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={venues.isLoading}
          isFetching={venues.isFetching}
          storageKey="admin-venues"
          emptyMessage="No venues yet"
        />
      </CardContent>

      <VenueDialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        venue={editing ?? undefined}
        onSaved={() => setEditing(undefined)}
      />
    </Card>
  );
}
