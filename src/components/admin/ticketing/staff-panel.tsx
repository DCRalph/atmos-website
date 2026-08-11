"use client";

import { useState } from "react";
import { ScanLine, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { PickerSelect } from "~/components/ui/picker-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];

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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Door staff</h2>
        <p className="text-muted-foreground text-sm">
          Assigned staff open <code>/door</code> on their own phone and only
          see their events. Admins and event organisers have unrestricted door
          access at every event.
        </p>
      </div>

      <ul className="divide-y rounded-lg border">
        {event.staff.length === 0 && (
          <li className="text-muted-foreground p-6 text-center text-sm">
            Nobody assigned yet.
          </li>
        )}
        {event.staff.map((assignment) => (
          <li
            key={assignment.id}
            className="flex items-center gap-3 p-3.5 text-sm"
          >
            <ScanLine className="text-muted-foreground size-4" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {assignment.user?.name ?? "Unknown user"}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {assignment.user?.email}
              </p>
            </div>
            <Badge
              variant={assignment.role === "MANAGER" ? "default" : "outline"}
            >
              {assignment.role.toLowerCase()}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${assignment.user?.name ?? "staff member"}`}
              onClick={() =>
                remove.mutate({
                  eventId: event.id,
                  userId: assignment.userId,
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

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
