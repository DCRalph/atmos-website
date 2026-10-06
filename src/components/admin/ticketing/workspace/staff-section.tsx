"use client";

import { useState } from "react";
import { ScanLine, Trash2, UserPlus } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PickerSelect } from "~/components/ui/picker-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { StaffRole } from "./draft";
import type { EventDraftState } from "./use-event-draft";

/**
 * Who can work this door. Being on the list is what grants door access;
 * managers can also override a duplicate scan and undo an admission. Part of
 * the draft, so adding someone and saving is one Save like everything else.
 */
export function StaffSection({
  state,
  eventId,
}: {
  state: EventDraftState;
  eventId: string | undefined;
}) {
  const { draft, update } = state;
  const [pick, setPick] = useState<{
    userId: string;
    name: string;
    email: string;
  } | null>(null);
  const [role, setRole] = useState<StaffRole>("SCANNER");

  const setRoleFor = (userId: string, next: StaffRole) =>
    update(
      "staff",
      draft.staff.map((row) =>
        row.userId === userId ? { ...row, role: next } : row,
      ),
    );

  const add = () => {
    if (!pick || draft.staff.some((row) => row.userId === pick.userId)) return;
    update("staff", [
      ...draft.staff,
      {
        userId: pick.userId,
        role,
        user: { name: pick.name, email: pick.email },
      },
    ]);
    setPick(null);
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Door staff</CardTitle>
        <CardDescription>
          Assigned staff open the scanner on their own phone and only see their
          events. Admins and event organisers can already scan every event.
          Managers can also override a duplicate scan and undo an admission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft.staff.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Nobody assigned yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {draft.staff.map((row) => (
              <li
                key={row.userId}
                className="flex items-center gap-3 px-3 py-2"
              >
                <ScanLine
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {row.user?.name ?? "Unknown user"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.user?.email}
                  </p>
                </div>
                <Select
                  value={row.role}
                  onValueChange={(value) =>
                    setRoleFor(row.userId, value as StaffRole)
                  }
                >
                  <SelectTrigger size="sm" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCANNER">Scanner</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.user?.name ?? "staff member"}`}
                  onClick={() =>
                    update(
                      "staff",
                      draft.staff.filter((r) => r.userId !== row.userId),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <PickerSelect
              endpoint={api.pickers.doorStaff}
              filter={eventId ? { excludeEventId: eventId } : undefined}
              value={pick?.userId ?? null}
              onChange={(userId, option) =>
                setPick(
                  userId && option
                    ? {
                        userId,
                        name: option.label,
                        email: option.description ?? "",
                      }
                    : null,
                )
              }
              placeholder="Choose someone"
              searchPlaceholder="Name, or a full email address…"
              emptyText="Nobody matches. Try their full email address."
            />
          </div>
          <Select
            value={role}
            onValueChange={(value) => setRole(value as StaffRole)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SCANNER">Scanner</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" disabled={!pick} onClick={add}>
            <UserPlus className="size-4" /> Add
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          The list shows people who have worked a door before; to add anyone
          else, type their full email address. Nothing changes until you save.
        </p>
      </CardContent>
    </Card>
  );
}
