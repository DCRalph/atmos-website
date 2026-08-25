"use client";

import { useMemo } from "react";
import { Plus, SmartphoneNfc, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

/**
 * Who hears a gig's cues.
 *
 * Two pickers over the same list. The gig's is the list; a cue's narrows it,
 * and can only narrow it — a cue cannot reach somebody the gig does not, which
 * is what keeps "who is being told what" answerable from one place.
 *
 * A person with no device registered is shown as such rather than quietly
 * dropped. They are on the list and they hear nothing, and that is worth
 * finding out on a Tuesday rather than at 11pm.
 */

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  devices: number;
};

export function useStaffDirectory() {
  const staff = api.runSheet.staff.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const byId = useMemo(
    () => new Map((staff.data ?? []).map((person) => [person.id, person])),
    [staff.data],
  );
  return { staff: staff.data ?? [], byId, isPending: staff.isPending };
}

/** The gig's list, as removable chips plus a picker. */
export function GigRecipientsField({
  userIds,
  onChange,
  disabled,
}: {
  userIds: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}) {
  const { staff, byId } = useStaffDirectory();
  const selected = new Set(userIds);

  const toggle = (id: string) => {
    onChange(
      selected.has(id)
        ? userIds.filter((candidate) => candidate !== id)
        : [...userIds, id],
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {userIds.map((id) => {
        const person = byId.get(id);
        const silent = person?.devices === 0;
        return (
          <span
            key={id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs",
              silent && "border-amber-500/50 text-amber-500",
            )}
          >
            {person?.name ?? "Unknown"}
            {silent ? <span>no app installed</span> : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggle(id)}
              aria-label={`Remove ${person?.name ?? "this person"}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="h-6 px-2 text-xs"
          >
            <Plus className="h-3 w-3" />
            {userIds.length === 0 ? "Pick who hears this gig" : "Add"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-1">
          <p className="text-muted-foreground px-2 py-1.5 text-xs">
            Admins and event organisers.
          </p>
          {staff.length === 0 ? (
            <p className="text-muted-foreground px-2 py-2 text-sm">
              Nobody has the permission yet.
            </p>
          ) : null}
          {staff.map((person) => (
            <label
              key={person.id}
              className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              <Checkbox
                checked={selected.has(person.id)}
                onCheckedChange={() => toggle(person.id)}
              />
              <span className="min-w-0 flex-1 truncate">{person.name}</span>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 text-[10px]",
                  person.devices === 0
                    ? "text-amber-500"
                    : "text-muted-foreground",
                )}
              >
                <SmartphoneNfc className="h-3 w-3" />
                {person.devices}
              </span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * A cue's override.
 *
 * Empty means "the gig's list", and checking everybody sets it back to empty
 * rather than to a copy of the list. That way a cue narrowed to nobody in
 * particular keeps following the gig when somebody is added to it later.
 */
export function CueRecipientsField({
  gigUserIds,
  value,
  onChange,
  disabled,
}: {
  gigUserIds: string[];
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}) {
  const { byId } = useStaffDirectory();
  const selected = new Set(value.length > 0 ? value : gigUserIds);

  const toggle = (id: string) => {
    const next = selected.has(id)
      ? [...selected].filter((candidate) => candidate !== id)
      : [...selected, id];
    const isEveryone =
      next.length === gigUserIds.length &&
      gigUserIds.every((candidate) => next.includes(candidate));
    onChange(isEveryone ? [] : next);
  };

  const summary =
    value.length === 0
      ? "gig list"
      : value.length === 1
        ? (byId.get(value[0]!)?.name ?? "1 person")
        : `${value.length} people`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!!disabled || gigUserIds.length === 0}
          className={cn(
            "text-muted-foreground h-6 px-1.5 text-xs font-normal",
            value.length > 0 && "text-foreground",
          )}
        >
          {gigUserIds.length === 0 ? "nobody yet" : summary}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <p className="text-muted-foreground px-2 py-1.5 text-xs">
          Narrows the gig&apos;s list for this cue only.
        </p>
        {gigUserIds.map((id) => (
          <label
            key={id}
            className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
          >
            <Checkbox
              checked={selected.has(id)}
              onCheckedChange={() => toggle(id)}
            />
            <span className="min-w-0 flex-1 truncate">
              {byId.get(id)?.name ?? "Unknown"}
            </span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
