"use client";

import { useState } from "react";
import { ScanLine, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { PickerSelect } from "~/components/ui/picker-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];
type StaffRow = AdminEvent["staff"][number];

/**
 * Who can work this door.
 *
 * Assignment here grants access to this event's door. Managers can additionally
 * override a duplicate scan and undo a mistaken admission.
 */
export function StaffPanel({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();
  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState<"SCANNER" | "MANAGER">("SCANNER");

  // Search, paging and the "already assigned" exclusion all live in the
  // `doorStaff` picker — see `~/server/api/routers/pickers.ts`.

  const assign = api.ticketEvents.assignStaff.useMutation({
    onSuccess: () => {
      toast.success("Added to the door.");
      setUserId("");
      void utils.ticketEvents.byId.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = api.ticketEvents.removeStaff.useMutation({
    onSuccess: () => void utils.ticketEvents.byId.invalidate(),
  });

  const columns: DataTableColumn<StaffRow>[] = [
    {
      id: "name",
      header: "Staff",
      accessor: (row) => row.user?.name ?? "",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <ScanLine
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.user?.name ?? "Unknown user"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {row.user?.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      type: "badge",
      accessor: (row) => row.role.toLowerCase(),
      badge: (value, row) => ({
        label: String(value),
        variant: row.role === "MANAGER" ? "default" : "outline",
      }),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${row.user?.name ?? "staff member"}`}
          onClick={() =>
            remove.mutate({ eventId: event.id, userId: row.userId })
          }
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Door staff</h2>
        <p className="text-muted-foreground text-sm">
          Assigned staff open <code>/door</code> on their own phone and only see
          their events. Admins and event organisers have unrestricted door
          access at every event.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={event.staff}
        getRowId={(row) => row.id}
        storageKey="admin-event-staff"
        emptyMessage="Nobody assigned yet."
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <PickerSelect
            endpoint={api.pickers.doorStaff}
            filter={{ excludeEventId: event.id }}
            value={userId || null}
            onChange={(next) => setUserId(next ?? "")}
            placeholder="Choose someone"
            searchPlaceholder="Name, or a full email address…"
            emptyText="Nobody matches. Try their full email address."
          />
        </div>

        <Select
          value={role}
          onValueChange={(value) => setRole(value as "SCANNER" | "MANAGER")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SCANNER">Scanner</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
          </SelectContent>
        </Select>

        <Button
          disabled={!userId || assign.isPending}
          onClick={() => assign.mutate({ eventId: event.id, userId, role })}
        >
          <UserPlus className="size-4" /> Add
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        Being assigned here is what grants door access — organisers and admins
        can already scan every event. The list shows people who have worked a
        door before; to add anyone else, type their full email address.
      </p>
    </div>
  );
}
