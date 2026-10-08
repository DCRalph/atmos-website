"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CodeForm, CodesTable } from "~/components/admin/ticketing/codes";
import type { AdminEvent } from "~/components/admin/ticketing/workspace/draft";

/**
 * This event's own codes. Like a global code they can take money off; unlike
 * one they can unlock the event's hidden tiers, which is how a presale or a
 * guest list is handed out. Live, not part of the event draft: a code works
 * the moment it is created.
 */
export function EventCodesPanel({ event }: { event: AdminEvent }) {
  const [creating, setCreating] = useState(false);
  const utils = api.useUtils();
  const codes = api.eventCodes.list.useQuery({ eventId: event.id });
  const refresh = () => void utils.eventCodes.list.invalidate();

  const tierName = new Map(event.tiers.map((tier) => [tier.id, tier.name]));
  const hiddenTiers = event.tiers
    .filter((tier) => tier.isHidden)
    .map((tier) => ({ id: tier.id, name: tier.name }));

  const create = api.eventCodes.create.useMutation({
    onSuccess: () => {
      toast.success("Code created");
      refresh();
      setCreating(false);
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
        <Button onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="size-4" aria-hidden /> New code
        </Button>
      </div>

      {creating && (
        <CodeForm
          hiddenTiers={hiddenTiers}
          pending={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => create.mutate({ ...values, eventId: event.id })}
        />
      )}

      <CodesTable
        rows={codes.data ?? []}
        isLoading={codes.isPending}
        isFetching={codes.isFetching}
        storageKey="admin-event-codes"
        extraColumns={[
          {
            id: "unlocks",
            header: "Unlocks",
            cell: (row) =>
              !row.unlocksHiddenTiers ? (
                <span className="text-muted-foreground">—</span>
              ) : row.tierIds.length === 0 ? (
                <Badge variant="outline">All hidden tiers</Badge>
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
        onDelete={(id) => remove.mutate({ id })}
        deleting={remove.isPending}
      />
    </div>
  );
}
