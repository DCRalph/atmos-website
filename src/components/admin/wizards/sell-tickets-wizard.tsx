"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Layers, Ticket, Trash2 } from "lucide-react";
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
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Input } from "~/components/ui/input";
import {
  VenuePicker,
  type PickedVenue,
} from "~/components/admin/venues/venue-picker";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";
import { wizardHref } from "./catalog";
import { GigGate } from "./gates";
import { gigEditorHref, gigLabel, type EditorGig } from "./gig-common";
import { Caution, Field, Loading, SummaryRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "details", label: "Event details" },
  { key: "tickets", label: "Tickets" },
  { key: "sales", label: "Sales" },
  { key: "review", label: "Review" },
] as const;

/** One ticket type as typed: price in dollars, allocation as text. */
type TierRow = {
  key: string;
  name: string;
  price: string;
  allocation: string;
  releaseAfterPrevious: boolean;
};

type Shape = "single" | "early" | "free";

const row = (fields: Omit<TierRow, "key">): TierRow => ({
  key: crypto.randomUUID(),
  ...fields,
});

/** The three ways most nights sell, as starting tiers to edit. */
const SHAPES: Record<
  Shape,
  {
    title: string;
    description: string;
    icon: typeof Ticket;
    tiers: () => TierRow[];
  }
> = {
  single: {
    title: "One price",
    description: "Everyone pays the same",
    icon: Ticket,
    tiers: () => [
      row({
        name: "General admission",
        price: "25.00",
        allocation: "200",
        releaseAfterPrevious: false,
      }),
    ],
  },
  early: {
    title: "Early bird, then general",
    description: "Cheaper first tickets; general opens when they sell out",
    icon: Layers,
    tiers: () => [
      row({
        name: "Early bird",
        price: "20.00",
        allocation: "50",
        releaseAfterPrevious: false,
      }),
      row({
        name: "General admission",
        price: "30.00",
        allocation: "150",
        releaseAfterPrevious: true,
      }),
    ],
  },
  free: {
    title: "Free RSVP",
    description: "No charge, but a ticket at the door",
    icon: Gift,
    tiers: () => [
      row({
        name: "RSVP",
        price: "0.00",
        allocation: "200",
        releaseAfterPrevious: false,
      }),
    ],
  },
};

const isWhole = (value: string, min: number) =>
  /^\d+$/.test(value.trim()) && Number(value) >= min;

/** Sell tickets for a gig: a ticketed event made from it, in four steps. */
export function SellTicketsWizard() {
  return (
    <GigGate
      wizard="sell-tickets"
      hint={(gig) => (gig.hasTickets ? null : "No tickets yet")}
    >
      {(gigId) => <Loaded gigId={gigId} />}
    </GigGate>
  );
}

function Loaded({ gigId }: { gigId: string }) {
  const gig = api.gigs.getForEditor.useQuery({ id: gigId });
  if (gig.isPending) {
    return (
      <WizardShell wizard="sell-tickets">
        <Loading />
      </WizardShell>
    );
  }
  if (!gig.data) {
    return (
      <WizardShell wizard="sell-tickets">
        <p className="text-sm">That gig is gone.</p>
      </WizardShell>
    );
  }
  return <Steps gig={gig.data} />;
}

/** A gig that already has an event gets pointed at it, not a second one. */
function AlreadySelling({ gig, eventId }: { gig: EditorGig; eventId: string }) {
  return (
    <WizardShell
      wizard="sell-tickets"
      subtitle={gigLabel(gig)}
      editorHref={gigEditorHref(gig.id)}
    >
      <Card>
        <CardHeader>
          <CardTitle>This gig already sells tickets</CardTitle>
          <CardDescription>
            It has a ticketed event. Change its ticket types or open it to see
            everything else.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={wizardHref("ticket-types", { eventId })}>
              Set up ticket types
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/events/${eventId}`}>Open the event</Link>
          </Button>
        </CardContent>
      </Card>
    </WizardShell>
  );
}

function Steps({ gig }: { gig: EditorGig }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);

  const [name, setName] = useState(gig.title);
  const [startsAt, setStartsAt] = useState<Date | undefined>(gig.gigStartTime);
  const [doorsAt, setDoorsAt] = useState<Date | undefined>(undefined);
  const [endsAt, setEndsAt] = useState<Date | undefined>(
    gig.gigEndTime ?? undefined,
  );
  const [venue, setVenue] = useState<PickedVenue | null>(gig.venue);

  const [shape, setShape] = useState<Shape | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);

  const [capacity, setCapacity] = useState("");
  const [opensNow, setOpensNow] = useState(true);
  const [salesOpenAt, setSalesOpenAt] = useState<Date | undefined>(undefined);
  const [salesCloseAt, setSalesCloseAt] = useState<Date | undefined>(undefined);

  const [done, setDone] = useState<{ id: string; onSale: boolean } | null>(
    null,
  );
  const [touched, setTouched] = useState(false);

  const create = api.ticketEvents.create.useMutation();
  const setStatus = api.ticketEvents.setStatus.useMutation();
  const isSaving = create.isPending || setStatus.isPending;

  const detailsError = !name.trim()
    ? "Give the event a name"
    : !startsAt
      ? "A start time is required"
      : endsAt && endsAt < startsAt
        ? "The event can't end before it starts"
        : doorsAt && doorsAt > startsAt
          ? "Doors can't open after the event starts"
          : null;

  const tiersError =
    tiers.length === 0
      ? "Pick how tickets sell"
      : (tiers
          .map((tier) => {
            const label = tier.name.trim() || "An unnamed tier";
            if (!tier.name.trim()) return "Give every tier a name";
            if (parsePriceToCents(tier.price) === null) {
              return `${label} needs a price, like 25.00`;
            }
            if (!isWhole(tier.allocation, 0)) {
              return `${label} needs a whole-number allocation`;
            }
            return null;
          })
          .find(Boolean) ?? null);

  const opensAt = opensNow ? new Date() : salesOpenAt;
  const salesError =
    capacity.trim() && !isWhole(capacity, 1)
      ? "Capacity is a whole number, 1 or more"
      : !opensAt
        ? "Pick when sales open, or choose now"
        : salesCloseAt && salesCloseAt < opensAt
          ? "Sales can't close before they open"
          : null;

  const totalAllocation = tiers.reduce(
    (sum, tier) => sum + (Number(tier.allocation) || 0),
    0,
  );
  const nothingOnSale = !tiers.some((tier) => Number(tier.allocation) > 0);

  const pickShape = (next: Shape) => {
    setShape(next);
    setTiers(SHAPES[next].tiers());
    setTouched(true);
  };

  const patchTier = (key: string, patch: Partial<TierRow>) => {
    setTiers((all) =>
      all.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)),
    );
    setTouched(true);
  };

  const save = async (putOnSale: boolean) => {
    if (!startsAt) return;
    try {
      const event = await create.mutateAsync({
        name: name.trim(),
        gigId: gig.id,
        startsAt,
        doorsAt: doorsAt ?? null,
        endsAt: endsAt ?? null,
        venueId: venue?.id ?? null,
        salesOpenAt: opensNow ? null : (salesOpenAt ?? null),
        salesCloseAt: salesCloseAt ?? null,
        capacity: capacity.trim() ? Number(capacity) : null,
        tiers: tiers.map((tier) => ({
          name: tier.name.trim(),
          priceCents: parsePriceToCents(tier.price) ?? 0,
          allocation: Number(tier.allocation),
          releaseAfterPrevious: tier.releaseAfterPrevious,
        })),
      });
      if (putOnSale) {
        try {
          await setStatus.mutateAsync({ id: event.id, status: "PUBLISHED" });
        } catch (error) {
          toast.error(
            `The event was saved as a draft, but could not go on sale: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
          setDone({ id: event.id, onSale: false });
          return;
        }
      }
      // Done first: the refreshed gig has an event now, and without it this
      // would turn into "already sells tickets".
      setDone({ id: event.id, onSale: putOnSale });
      toast.success(
        putOnSale ? "Tickets are on sale" : "Event saved as a draft",
      );
      void Promise.all([
        utils.gigs.getForEditor.invalidate({ id: gig.id }),
        utils.wizards.gigChoices.invalidate(),
        utils.wizards.eventChoices.invalidate(),
        utils.ticketEvents.list.invalidate(),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  };

  // An archived event does not count: the gig can sell again.
  const existing = gig.ticketEvents.find(
    (event) => event.status !== "ARCHIVED",
  );
  if (existing && !done) {
    return <AlreadySelling gig={gig} eventId={existing.id} />;
  }

  return (
    <WizardShell
      wizard="sell-tickets"
      subtitle={gigLabel(gig)}
      editorHref={gigEditorHref(gig.id)}
      steps={steps}
      isDirty={touched}
      done={
        done ? (
          <DonePanel
            title={done.onSale ? "On sale" : "Event created"}
            description={
              done.onSale
                ? "The gig page shows the buy panel now."
                : "It is a draft, so nobody can buy yet. Put it on sale from the event page when it's ready."
            }
            next={[
              { key: "door-staff", eventId: done.id },
              { key: "guest-list", eventId: done.id },
            ]}
            links={[
              { href: `/admin/events/${done.id}`, label: "Open the event" },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "details" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Event details</CardTitle>
              <CardDescription>
                Copied from the gig. Change anything that differs for the
                ticketed event.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field id="sell-name" label="Event name" required>
                <Input
                  id="sell-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setTouched(true);
                  }}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="sell-starts" label="Starts" required>
                  <DateTimePicker
                    date={startsAt}
                    onDateChange={(value) => {
                      setStartsAt(value);
                      setTouched(true);
                    }}
                    placeholder="Select start time"
                  />
                </Field>
                <Field id="sell-doors" label="Doors open">
                  <DateTimePicker
                    date={doorsAt}
                    onDateChange={(value) => {
                      setDoorsAt(value);
                      setTouched(true);
                    }}
                    placeholder="Not set"
                    clearable
                  />
                </Field>
                <Field id="sell-ends" label="Ends">
                  <DateTimePicker
                    date={endsAt}
                    onDateChange={(value) => {
                      setEndsAt(value);
                      setTouched(true);
                    }}
                    placeholder="No end time"
                    clearable
                  />
                </Field>
              </div>
              <div role="group" aria-label="Venue" className="space-y-2">
                <div className="text-sm font-medium">Venue</div>
                <VenuePicker
                  value={venue}
                  onChange={(next) => {
                    setVenue(next);
                    setTouched(true);
                  }}
                  createLabel="Create & use for this event"
                />
              </div>
            </CardContent>
          </Card>
          <WizardFooter
            onNext={steps.next}
            disabled={Boolean(detailsError)}
            hint={detailsError ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "tickets" ? (
        <>
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(SHAPES) as Shape[]).map((key) => {
                const option = SHAPES[key];
                const Icon = option.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickShape(key)}
                    aria-pressed={shape === key}
                    className={cn(
                      "bg-card border-border hover:bg-secondary/60 flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                      shape === key && "border-primary bg-secondary",
                    )}
                  >
                    <Icon
                      className="text-muted-foreground mt-0.5 size-5 shrink-0"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{option.title}</span>
                      <span className="text-muted-foreground block text-sm">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {tiers.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Prices and how many</CardTitle>
                  <CardDescription>
                    {shape === "early"
                      ? "General admission opens by itself once the early birds sell out."
                      : "Change the names, prices and numbers to suit the night."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-muted-foreground hidden grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_36px] gap-2 px-2 text-xs sm:grid">
                    <span>Name</span>
                    <span>Price</span>
                    <span>How many</span>
                    <span />
                  </div>
                  {tiers.map((tier, index) => (
                    <div
                      key={tier.key}
                      className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_36px] sm:items-center"
                    >
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <Input
                          aria-label="Tier name"
                          placeholder="Tier name"
                          value={tier.name}
                          onChange={(event) =>
                            patchTier(tier.key, { name: event.target.value })
                          }
                          className="h-8"
                        />
                        {tier.releaseAfterPrevious && index > 0 ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            After{" "}
                            {tiers[index - 1]?.name.trim()
                              ? tiers[index - 1]?.name
                              : "the tier above"}
                          </p>
                        ) : null}
                      </div>
                      <Input
                        aria-label="Price"
                        inputMode="decimal"
                        value={tier.price}
                        onChange={(event) =>
                          patchTier(tier.key, { price: event.target.value })
                        }
                        className="h-8"
                      />
                      <Input
                        aria-label="Allocation, in tickets"
                        type="number"
                        min={0}
                        value={tier.allocation}
                        onChange={(event) =>
                          patchTier(tier.key, {
                            allocation: event.target.value,
                          })
                        }
                        className="h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Remove ${tier.name || "tier"}`}
                        disabled={tiers.length === 1}
                        onClick={() => {
                          setTiers((all) =>
                            all
                              .filter((other) => other.key !== tier.key)
                              // The first tier has nothing to wait for.
                              .map((other, at) =>
                                at === 0
                                  ? { ...other, releaseAfterPrevious: false }
                                  : other,
                              ),
                          );
                          setTouched(true);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-muted-foreground text-xs">
                    {totalAllocation} ticket{totalAllocation === 1 ? "" : "s"}{" "}
                    in total. Booking fees, door sales and more are in the full
                    event page once it exists.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={Boolean(tiersError)}
            hint={tiersError ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "sales" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sales</CardTitle>
              <CardDescription>
                When people can buy, and how many the room holds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field
                id="sell-capacity"
                label="Capacity"
                hint={`Optional. Blank means the tickets above, ${totalAllocation}.`}
              >
                <Input
                  id="sell-capacity"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(event) => {
                    setCapacity(event.target.value);
                    setTouched(true);
                  }}
                  placeholder={String(totalAllocation)}
                  className="max-w-40"
                />
              </Field>
              <div className="space-y-2">
                <div className="text-sm font-medium">Sales open</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={opensNow ? "secondary" : "outline"}
                    onClick={() => setOpensNow(true)}
                  >
                    As soon as it&apos;s on sale
                  </Button>
                  <Button
                    type="button"
                    variant={opensNow ? "outline" : "secondary"}
                    onClick={() => setOpensNow(false)}
                  >
                    At a set time
                  </Button>
                </div>
                {!opensNow ? (
                  <DateTimePicker
                    date={salesOpenAt}
                    onDateChange={(value) => {
                      setSalesOpenAt(value);
                      setTouched(true);
                    }}
                    placeholder="Pick when sales open"
                  />
                ) : null}
              </div>
              <Field
                id="sell-close"
                label="Sales close"
                hint="Optional. Left blank, sales run until the night."
              >
                <DateTimePicker
                  date={salesCloseAt}
                  onDateChange={(value) => {
                    setSalesCloseAt(value);
                    setTouched(true);
                  }}
                  placeholder="Not set"
                  clearable
                />
              </Field>
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={Boolean(salesError)}
            hint={salesError ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Nothing is saved until you press Save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="divide-border divide-y text-sm">
                <SummaryRow label="Event" value={name.trim()} />
                <SummaryRow
                  label="Starts"
                  value={startsAt ? formatEventDateTime(startsAt) : "Not set"}
                />
                {doorsAt ? (
                  <SummaryRow
                    label="Doors"
                    value={formatEventDateTime(doorsAt)}
                  />
                ) : null}
                <SummaryRow label="Venue" value={venue?.name ?? "Not set"} />
                <SummaryRow
                  label="Tickets"
                  value={
                    <span className="flex flex-col gap-0.5">
                      {tiers.map((tier) => (
                        <span key={tier.key}>
                          {tier.name.trim()} ·{" "}
                          {formatNZD(parsePriceToCents(tier.price) ?? 0)} ·{" "}
                          {tier.allocation}
                        </span>
                      ))}
                    </span>
                  }
                />
                <SummaryRow
                  label="Capacity"
                  value={capacity.trim() || `${totalAllocation} (the tickets)`}
                />
                <SummaryRow
                  label="Sales open"
                  value={
                    opensNow || !salesOpenAt
                      ? "As soon as it's on sale"
                      : formatEventDateTime(salesOpenAt)
                  }
                />
                {salesCloseAt ? (
                  <SummaryRow
                    label="Sales close"
                    value={formatEventDateTime(salesCloseAt)}
                  />
                ) : null}
              </dl>
              {nothingOnSale ? (
                <Caution>
                  No tier has any tickets to sell. Add some on the Tickets step
                  before putting it on sale.
                </Caution>
              ) : null}
              {!venue ? (
                <Caution>
                  No venue. Tickets and passes will not say where it is.
                </Caution>
              ) : null}
            </CardContent>
          </Card>
          {/* Draft is the safe default, so it is the main button. */}
          <WizardFooter
            onBack={steps.back}
            label="Save as draft"
            onNext={() => void save(false)}
            isPending={isSaving}
            secondary={{
              label: "Save and put on sale",
              onClick: () => void save(true),
              disabled: nothingOnSale,
            }}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
