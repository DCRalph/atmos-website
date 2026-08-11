"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanLine, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
 * Being DOOR_STAFF only makes someone eligible; they still have to be assigned
 * here, per event. Managers can additionally override a duplicate scan and undo
 * a mistaken admission.
 */
export function StaffPanel({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();
  const eligible = api.ticketEvents.eligibleStaff.useQuery();
  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState<"SCANNER" | "MANAGER">("SCANNER");

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

  const assignedIds = new Set(event.staff.map((entry) => entry.userId));
  const available =
    eligible.data?.filter((user) => !assignedIds.has(user.id)) ?? [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Door staff</h2>
        <p className="text-muted-foreground text-sm">
          They open <code>/door</code> on their own phone and only see the events
          they&apos;re on.
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
            <Badge variant={assignment.role === "MANAGER" ? "default" : "outline"}>
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
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose someone" />
            </SelectTrigger>
            <SelectContent>
              {available.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} — {user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {available.length === 0 && eligible.data && (
        <p className="text-muted-foreground text-sm">
          Everyone with the Door staff role is already on this event. Give
          someone the role from{" "}
          <Link href="/admin/users" className="underline">
            Users
          </Link>{" "}
          to add more.
        </p>
      )}
    </div>
  );
}
