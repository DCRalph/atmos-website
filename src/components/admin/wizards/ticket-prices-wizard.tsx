"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";
import { EventGate } from "./gates";
import { eventLabel, type AdminEvent } from "./event-common";
import { Caution, DiffList, Loading, type DiffRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "tiers", label: "Ticket types" },
  { key: "review", label: "Review" },
] as const;

type SavedTier = AdminEvent["tiers"][number];

/** A tier as typed. `saved` is the stored row, absent on a new one. */
type TierRow = {
  key: string;
  saved?: SavedTier;
  name: string;
  price: string;
  allocation: string;
  isActive: boolean;
};

const fromSaved = (tier: SavedTier): TierRow => ({
  key: tier.id,
  saved: tier,
  name: tier.name,
  price: (tier.priceCents / 100).toFixed(2),
  allocation: tier.allocation.toString(),
  isActive: tier.isActive,
});

const committed = (tier: SavedTier) => tier.soldCount + tier.heldCount;

/** The first thing wrong with a tier, in the full editor's words. */
function tierError(tier: TierRow): string | null {
  const label = tier.name.trim() || "An unnamed tier";
  if (!tier.name.trim()) return "Give every tier a name";
  if (parsePriceToCents(tier.price) === null) {
    return `${label} needs a price, like 25.00`;
  }
  if (!/^\d+$/.test(tier.allocation.trim())) {
    return `${label} needs a whole-number allocation`;
  }
  if (tier.saved && Number(tier.allocation) < committed(tier.saved)) {
    return `${committed(tier.saved)} already sold or held in ${label}; its allocation can't go below that`;
  }
  return null;
}

/** Change ticket prices: reprice, resize, close, add or remove a tier. */
export function TicketPricesWizard() {
  return (
    <EventGate wizard="ticket-prices">
      {(eventId) => <Loaded eventId={eventId} />}
    </EventGate>
  );
}

function Loaded({ eventId }: { eventId: string }) {
  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  if (event.isPending) {
    return (
      <WizardShell wizard="ticket-prices">
        <Loading />
      </WizardShell>
    );
  }
  if (!event.data) {
    return (
      <WizardShell wizard="ticket-prices">
        <p className="text-sm">That event is gone.</p>
      </WizardShell>
    );
  }
  return <Steps event={event.data} />;
}

function Steps({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [tiers, setTiers] = useState<TierRow[]>(() =>
    event.tiers.map(fromSaved),
  );
  const [isDone, setIsDone] = useState(false);

  const update = api.ticketEvents.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ticketEvents.byId.invalidate({ id: event.id }),
        utils.wizards.eventChoices.invalidate(),
      ]);
      toast.success("Ticket prices saved");
      setIsDone(true);
    },
    onError: (error) => toast.error(error.message),
  });

  const patch = (key: string, fields: Partial<TierRow>) =>
    setTiers((all) =>
      all.map((tier) => (tier.key === key ? { ...tier, ...fields } : tier)),
    );

  const error = tiers.map(tierError).find(Boolean) ?? null;

  const rows: DiffRow[] = [];
  for (const tier of tiers) {
    const priceCents = parsePriceToCents(tier.price) ?? 0;
    if (!tier.saved) {
      rows.push({
        label: `New: ${tier.name.trim() || "Unnamed"}`,
        before: "Not set",
        after: `${formatNZD(priceCents)} · ${tier.allocation}`,
      });
      continue;
    }
    const name = tier.saved.name;
    if (tier.name.trim() !== tier.saved.name) {
      rows.push({
        label: `${name} name`,
        before: name,
        after: tier.name.trim(),
      });
    }
    if (priceCents !== tier.saved.priceCents) {
      rows.push({
        label: `${name} price`,
        before: formatNZD(tier.saved.priceCents),
        after: formatNZD(priceCents),
      });
    }
    if (Number(tier.allocation) !== tier.saved.allocation) {
      rows.push({
        label: `${name} allocation`,
        before: String(tier.saved.allocation),
        after: tier.allocation.trim(),
      });
    }
    if (tier.isActive !== tier.saved.isActive) {
      rows.push({
        label: name,
        before: tier.saved.isActive ? "On sale" : "Closed",
        after: tier.isActive ? "On sale" : "Closed",
      });
    }
  }
  const kept = new Set(tiers.map((tier) => tier.saved?.id));
  for (const tier of event.tiers) {
    if (!kept.has(tier.id)) {
      rows.push({
        label: `Removed: ${tier.name}`,
        before: `${formatNZD(tier.priceCents)} · ${tier.allocation}`,
        after: "Removed",
      });
    }
  }

  // The full ordered list, as `update` wants it: saved tiers carry only what
  // changed, new ones everything, and removed ones are simply left out.
  const save = () =>
    update.mutate({
      id: event.id,
      tiers: tiers.map((tier) => {
        const priceCents = parsePriceToCents(tier.price) ?? 0;
        const allocation = Number(tier.allocation);
        const name = tier.name.trim();
        if (!tier.saved) return { name, priceCents, allocation };
        return {
          id: tier.saved.id,
          ...(name !== tier.saved.name ? { name } : {}),
          ...(priceCents !== tier.saved.priceCents ? { priceCents } : {}),
          ...(allocation !== tier.saved.allocation ? { allocation } : {}),
          ...(tier.isActive !== tier.saved.isActive
            ? { isActive: tier.isActive }
            : {}),
        };
      }),
    });

  return (
    <WizardShell
      wizard="ticket-prices"
      subtitle={eventLabel(event)}
      editorHref={`/admin/events/${event.id}?section=tiers`}
      steps={steps}
      isDirty={rows.length > 0}
      done={
        isDone ? (
          <DonePanel
            title="Ticket prices saved"
            description="The buy panel shows the new prices for the next purchase."
            next={[
              { key: "guest-list", eventId: event.id },
              { key: "event-basics", eventId: event.id },
            ]}
            links={[
              {
                href: `/admin/events/${event.id}?section=tiers`,
                label: "See all tier settings",
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "tiers" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ticket types</CardTitle>
              <CardDescription>
                Change a price or how many, close one, or add another. Release
                order, door sales and the rest are in the full event page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tiers.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  No ticket types yet. Add one below.
                </p>
              ) : (
                <div className="text-muted-foreground hidden grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_96px_36px] gap-2 px-2 text-xs sm:grid">
                  <span>Name</span>
                  <span>Price</span>
                  <span>How many</span>
                  <span>On sale</span>
                  <span />
                </div>
              )}
              {tiers.map((tier) => {
                const hasSales = tier.saved ? committed(tier.saved) > 0 : false;
                return (
                  <div
                    key={tier.key}
                    className={cn(
                      "grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_96px_36px] sm:items-center",
                      !tier.isActive && "bg-muted/40",
                    )}
                  >
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <Input
                        aria-label="Tier name"
                        placeholder="Tier name"
                        value={tier.name}
                        onChange={(e) =>
                          patch(tier.key, { name: e.target.value })
                        }
                        className="h-8"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        {tier.saved
                          ? `${tier.saved.soldCount} sold`
                          : "New ticket type"}
                      </p>
                    </div>
                    <Input
                      aria-label="Price"
                      inputMode="decimal"
                      value={tier.price}
                      onChange={(e) =>
                        patch(tier.key, { price: e.target.value })
                      }
                      className="h-8"
                    />
                    <Input
                      aria-label="Allocation, in tickets"
                      type="number"
                      min={tier.saved ? committed(tier.saved) : 0}
                      value={tier.allocation}
                      onChange={(e) =>
                        patch(tier.key, { allocation: e.target.value })
                      }
                      className="h-8"
                    />
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={tier.isActive}
                        onCheckedChange={(isActive) =>
                          patch(tier.key, { isActive })
                        }
                        aria-label={`${tier.name || "Tier"} on sale`}
                      />
                      {tier.isActive ? "On sale" : "Closed"}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remove ${tier.name || "tier"}`}
                      title={
                        hasSales
                          ? "Has sales, so it can be closed but not removed"
                          : undefined
                      }
                      disabled={hasSales}
                      onClick={() =>
                        setTiers((all) =>
                          all.filter((other) => other.key !== tier.key),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
              {tiers.some((tier) => tier.saved && committed(tier.saved) > 0) ? (
                <p className="text-muted-foreground text-xs">
                  A ticket type with sales can be closed but not removed.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setTiers((all) => [
                    ...all,
                    {
                      key: crypto.randomUUID(),
                      name: "",
                      price: "0.00",
                      allocation: "50",
                      isActive: true,
                    },
                  ])
                }
              >
                <Plus className="size-4" aria-hidden />
                Add a ticket type
              </Button>
            </CardContent>
          </Card>
          <WizardFooter
            onNext={steps.next}
            disabled={Boolean(error)}
            hint={error ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList rows={rows} empty="No changes yet. Go back to make some.">
            {event.status === "PUBLISHED" && rows.length > 0 ? (
              <Caution>
                This event is on sale. Price changes apply to the next purchase;
                people who already bought keep what they paid.
              </Caution>
            ) : null}
          </DiffList>
          <WizardFooter
            onBack={steps.back}
            label={`Save ${rows.length} change${rows.length === 1 ? "" : "s"}`}
            onNext={save}
            disabled={rows.length === 0}
            isPending={update.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
