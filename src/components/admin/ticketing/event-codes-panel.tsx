"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  CodeForm,
  CodesTable,
  EVENT_CODE_TYPES,
} from "~/components/admin/ticketing/codes";
import type { AdminEvent } from "~/components/admin/ticketing/workspace/draft";

/**
 * This event's own codes. Like a global code they can take money off, scoped
 * to some tiers if need be; unlike one they can be an unlock code, which opens
 * the event's hidden tiers and is how a presale or a guest list is handed out.
 * Live, not part of the event draft: a code works the moment it is created.
 */
type Code = RouterOutputs["eventCodes"]["list"][number];

export function EventCodesPanel({ event }: { event: AdminEvent }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Code | null>(null);
  const utils = api.useUtils();
  const codes = api.eventCodes.list.useQuery({ eventId: event.id });
  const refresh = () => void utils.eventCodes.list.invalidate();

  const tierName = new Map(event.tiers.map((tier) => [tier.id, tier.name]));

  const create = api.eventCodes.create.useMutation({
    onSuccess: () => {
      toast.success("Code created");
      refresh();
      setCreating(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const update = api.eventCodes.update.useMutation({
    onSuccess: () => {
      toast.success("Code saved");
      refresh();
      setEditing(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const setActive = api.eventCodes.setActive.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });

  const remove = api.eventCodes.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Codes for this event only. Global codes are under Discount codes.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          disabled={creating}
        >
          <Plus className="size-4" aria-hidden /> New code
        </Button>
      </div>

      {creating && (
        <CodeForm
          types={EVENT_CODE_TYPES}
          tiers={event.tiers}
          pending={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => create.mutate({ ...values, eventId: event.id })}
        />
      )}

      {editing && (
        <CodeForm
          key={editing.id}
          types={EVENT_CODE_TYPES}
          tiers={event.tiers}
          initial={editing}
          pending={update.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(values) => update.mutate({ ...values, id: editing.id })}
        />
      )}

      <CodesTable
        rows={codes.data ?? []}
        isLoading={codes.isPending}
        isFetching={codes.isFetching}
        storageKey="admin-event-codes"
        extraColumns={[
          {
            id: "tiers",
            header: "Tiers",
            cell: (row) =>
              row.tierIds.length === 0 ? (
                <span className="text-muted-foreground">All tiers</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {row.tierIds.map((id) => (
                    <Badge key={id} variant="outline">
                      {tierName.get(id) ?? "Deleted tier"}
                    </Badge>
                  ))}
                </div>
              ),
          },
        ]}
        onSetActive={(id, isActive) => setActive.mutate({ id, isActive })}
        onEdit={(row) => {
          setCreating(false);
          setEditing(row);
        }}
        onDelete={(id) => remove.mutate({ id })}
        deleting={remove.isPending}
      />
    </div>
  );
}
