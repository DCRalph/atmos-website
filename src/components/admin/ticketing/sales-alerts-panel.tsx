"use client";

import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";

type PersonRow = RouterOutputs["salesAlerts"]["forEvent"][number];
type AlertKind = "orders" | "soldOut";

/**
 * Who is pushed about this event's orders and sold-out tiers. The server
 * decides the rows: a superadmin gets every admin and the event's managers,
 * anybody else only themselves. Switches stay off for somebody with no app
 * install, since there is nowhere to send the alert.
 */
export function SalesAlertsPanel({ eventId }: { eventId: string }) {
  const people = api.salesAlerts.forEvent.useQuery({ eventId });
  const setAlert = api.salesAlerts.set.useMutation({
    onSuccess: () => void people.refetch(),
    onError: (error) => toast.error(error.message),
  });

  const alertSwitch = (row: PersonRow, kind: AlertKind) => (
    <Switch
      checked={row[kind]}
      // Off always works, so a lost phone can still be silenced.
      disabled={setAlert.isPending || (row.devices === 0 && !row[kind])}
      onCheckedChange={(enabled) =>
        setAlert.mutate({ eventId, userId: row.id, kind, enabled })
      }
    />
  );

  const columns: DataTableColumn<PersonRow>[] = [
    {
      id: "person",
      header: "Person",
      sortable: true,
      accessor: (row) => row.name || row.email,
      cell: (row) => (
        <span className="flex items-center gap-2 font-medium">
          {row.name || row.email}
          {row.isYou && <Badge variant="outline">You</Badge>}
          {row.isManager && <Badge variant="outline">Manager</Badge>}
        </span>
      ),
    },
    {
      id: "devices",
      header: "Devices",
      align: "right",
      cell: (row) =>
        row.devices === 0 ? (
          <span className="text-xs text-amber-500">No app</span>
        ) : (
          <span className="text-muted-foreground text-xs tabular-nums">
            {row.devices}
          </span>
        ),
    },
    {
      id: "orders",
      header: "Orders",
      align: "right",
      hideable: false,
      cell: (row) => alertSwitch(row, "orders"),
    },
    {
      id: "soldOut",
      header: "Sold out",
      align: "right",
      hideable: false,
      cell: (row) => alertSwitch(row, "soldOut"),
    },
  ];

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Sales alerts</CardTitle>
        <CardDescription>
          Push notifications for every paid order, and when a tier sells its
          last ticket. Sent to each person&apos;s phones with the Atmos app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={people.data ?? []}
          getRowId={(row) => row.id}
          isLoading={people.isLoading}
          storageKey="admin-event-sales-alerts"
          emptyMessage="No admins or managers"
        />
      </CardContent>
    </Card>
  );
}
