"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { CodeForm, CodesTable } from "~/components/admin/ticketing/codes";

/**
 * Global discount codes: a percentage or fixed amount off, on any event.
 *
 * Codes for one event, including the keys that unlock its hidden tiers for a
 * presale or a guest list, live on that event's Codes page instead.
 */
export default function DiscountCodesPage() {
  const [creating, setCreating] = useState(false);
  const utils = api.useUtils();
  const codes = api.discountCodes.list.useQuery();
  const refresh = () => void utils.discountCodes.list.invalidate();

  const create = api.discountCodes.create.useMutation({
    onSuccess: () => {
      toast.success("Code created");
      refresh();
      setCreating(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const setActive = api.discountCodes.setActive.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });

  const remove = api.discountCodes.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <AdminSection
      title="Discount codes"
      description="Codes that work on any event. Codes for one event, and the ones that unlock hidden tiers, are on that event's Codes page."
      actions={
        <Button onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="size-4" aria-hidden /> New code
        </Button>
      }
    >
      {creating && (
        <CodeForm
          pending={create.isPending}
          onCancel={() => setCreating(false)}
          // Without `hiddenTiers` the form never sets the unlock fields, and
          // the global endpoint drops them.
          onSubmit={(values) => create.mutate(values)}
        />
      )}

      <div className="mt-4">
        <CodesTable
          rows={codes.data ?? []}
          isLoading={codes.isPending}
          isFetching={codes.isFetching}
          storageKey="admin-discount-codes"
          onSetActive={(id, isActive) => setActive.mutate({ id, isActive })}
          onDelete={(id) => remove.mutate({ id })}
          deleting={remove.isPending}
        />
      </div>
    </AdminSection>
  );
}
