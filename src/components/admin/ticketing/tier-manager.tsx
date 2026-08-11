"use client";

import { useState } from "react";
import { EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { useConfirm } from "~/components/confirm-provider";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];
type Tier = AdminEvent["tiers"][number];

/**
 * Tiers.
 *
 * A tier is buyable when it's active, inside its sale window, and has stock —
 * which is what makes "50 early bird then general admission" work without
 * anyone having to flip a switch at midnight.
 */
export function TierManager({ event }: { event: AdminEvent }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ticket tiers</h2>
          <p className="text-muted-foreground text-sm">
            Sold in order. When one runs out the next takes over on its own.
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="size-4" /> Add tier
        </Button>
      </div>

      {event.tiers.length === 0 && !adding && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          No tiers yet. An event needs at least one before it can be published.
        </p>
      )}

      <div className="space-y-3">
        {event.tiers.map((tier) => (
          <TierRow key={tier.id} tier={tier} />
        ))}

        {adding && (
          <TierRow
            eventId={event.id}
            onDone={() => setAdding(false)}
            sortOrder={event.tiers.length}
          />
        )}
      </div>
    </div>
  );
}

function TierRow({
  tier,
  eventId,
  onDone,
}: {
  tier?: Tier;
  eventId?: string;
  onDone?: () => void;
  sortOrder?: number;
}) {
  const utils = api.useUtils();
  const confirm = useConfirm();

  const [name, setName] = useState(tier?.name ?? "");
  const [description, setDescription] = useState(tier?.description ?? "");
  const [price, setPrice] = useState(
    tier ? (tier.priceCents / 100).toFixed(2) : "0.00",
  );
  const [allocation, setAllocation] = useState(
    tier?.allocation.toString() ?? "100",
  );
  const [maxPerOrder, setMaxPerOrder] = useState(
    (tier?.maxPerOrder ?? 10).toString(),
  );
  const [maxPerEmail, setMaxPerEmail] = useState(
    tier?.maxPerEmail?.toString() ?? "",
  );
  const [salesStartAt, setSalesStartAt] = useState<Date | undefined>(
    tier?.salesStartAt ?? undefined,
  );
  const [salesEndAt, setSalesEndAt] = useState<Date | undefined>(
    tier?.salesEndAt ?? undefined,
  );
  const [isActive, setIsActive] = useState(tier?.isActive ?? true);
  const [isHidden, setIsHidden] = useState(tier?.isHidden ?? false);
  const [requiresApproval, setRequiresApproval] = useState(
    tier?.requiresApproval ?? false,
  );
  const [expanded, setExpanded] = useState(!tier);

  const invalidate = () => {
    void utils.ticketEvents.byId.invalidate();
    void utils.ticketAnalytics.overview.invalidate();
  };

  const create = api.ticketEvents.createTier.useMutation({
    onSuccess: () => {
      toast.success("Tier added");
      invalidate();
      onDone?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const update = api.ticketEvents.updateTier.useMutation({
    onSuccess: () => {
      toast.success("Tier saved");
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = api.ticketEvents.deleteTier.useMutation({
    onSuccess: () => {
      toast.success("Tier deleted");
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const payload = {
    name,
    description: description || null,
    priceCents: parsePriceToCents(price) ?? 0,
    allocation: Number.parseInt(allocation, 10) || 0,
    maxPerOrder: Number.parseInt(maxPerOrder, 10) || 10,
    maxPerEmail: maxPerEmail ? Number.parseInt(maxPerEmail, 10) : null,
    salesStartAt: salesStartAt ?? null,
    salesEndAt: salesEndAt ?? null,
    isActive,
    isHidden,
    requiresApproval,
  };

  const sold = tier?.soldCount ?? 0;
  const held = tier?.heldCount ?? 0;
  const remaining = tier ? Math.max(0, tier.allocation - sold - held) : 0;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setExpanded((value) => !value)}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{name || "New tier"}</span>
            <span className="text-muted-foreground">
              {(parsePriceToCents(price) ?? 0) === 0
                ? "Free"
                : formatNZD(parsePriceToCents(price) ?? 0)}
            </span>
            {tier && !tier.isActive && <Badge variant="outline">Paused</Badge>}
            {tier?.isHidden && (
              <Badge variant="outline">
                <EyeOff className="size-3" /> Hidden
              </Badge>
            )}
            {tier?.requiresApproval && (
              <Badge variant="outline">Needs approval</Badge>
            )}
          </div>
          {tier && (
            <p className="text-muted-foreground mt-1 text-sm">
              {sold} sold
              {held > 0 ? ` · ${held} held in checkout` : ""} · {remaining} left
              of {tier.allocation}
            </p>
          )}
        </button>

        {tier && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${tier.name}`}
            disabled={remove.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${tier.name}?`,
                description:
                  "Only possible while no tickets have been issued in this tier.",
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) remove.mutate({ id: tier.id });
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-5 grid gap-4 border-t pt-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Price (NZD, GST inclusive)</Label>
            <Input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              0 makes it a free tier — Stripe is skipped entirely.
            </p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — shown under the tier name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Allocation</Label>
            <Input
              type="number"
              min={0}
              value={allocation}
              onChange={(e) => setAllocation(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Max per order</Label>
            <Input
              type="number"
              min={1}
              value={maxPerOrder}
              onChange={(e) => setMaxPerOrder(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Max per email</Label>
            <Input
              type="number"
              min={1}
              value={maxPerEmail}
              onChange={(e) => setMaxPerEmail(e.target.value)}
              placeholder="No limit"
            />
            <p className="text-muted-foreground text-xs">
              Only enforceable on free tiers, where we know the email before
              issuing.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Sale starts</Label>
            <DateTimePicker
              date={salesStartAt}
              onDateChange={setSalesStartAt}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sale ends</Label>
            <DateTimePicker date={salesEndAt} onDateChange={setSalesEndAt} />
          </div>

          <div className="flex items-center justify-between gap-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm">On sale</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isHidden} onCheckedChange={setIsHidden} />
              <span className="text-sm">Hidden until unlocked by a code</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={requiresApproval}
                onCheckedChange={setRequiresApproval}
              />
              <span className="text-sm">Approve each request</span>
            </div>
          </div>

          <div className="flex gap-2 md:col-span-2">
            <Button
              disabled={create.isPending || update.isPending}
              onClick={() => {
                if (tier) update.mutate({ id: tier.id, ...payload });
                else if (eventId) create.mutate({ eventId, ...payload });
              }}
            >
              {create.isPending || update.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : tier ? (
                "Save tier"
              ) : (
                "Add tier"
              )}
            </Button>
            {onDone && (
              <Button variant="ghost" onClick={onDone}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
