"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DoorTotalsPanel } from "~/components/admin/ticketing/door-totals-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatNZD, venueFeePerTicketCents } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";
import { newCost, type AdminEvent, type CostDraft } from "./draft";
import type { EventDraftState } from "./use-event-draft";
import { sellOutPlan } from "./sell-out";
import { Field, Toggle } from "./fields";

/**
 * What the night costs to put on, and the fees buyers pay on top. Venue hire
 * and the booking fee come first, because buyers see them; everything else is
 * internal, and only feeds profit and break even on Overview. The summary
 * runs off the draft (see `sellOutPlan`), so it moves as prices and costs are
 * typed.
 */
export function CostsSection({
  state,
  event,
}: {
  state: EventDraftState;
  event: AdminEvent | undefined;
}) {
  const { draft, update, errors } = state;

  const {
    capacity,
    siteFee,
    venueFee,
    hireCents,
    otherCents,
    campaignCents,
    costsCents: totalCents,
    perTicket,
    breakEven,
    sellable,
    revenue,
  } = sellOutPlan(draft, event);
  const sellOutRevenue = perTicket === null ? null : revenue.totalCents;

  const setCosts = (costs: CostDraft[]) => update("costs", costs);
  const patchCost = (key: string, patch: Partial<CostDraft>) =>
    setCosts(
      draft.costs.map((cost) =>
        cost.key === key ? { ...cost, ...patch } : cost,
      ),
    );

  return (
    <div className="space-y-4">
      {event?.hasEnded ? (
        <DoorTotalsPanel
          key={event.id}
          eventId={event.id}
          totals={event.doorTotals}
          timezone={event.timezone}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Venue hire</CardTitle>
          <CardDescription>What the room costs for the night.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="event-venue-hire"
              label="Hire cost"
              error={errors.venueHire}
            >
              <Input
                id="event-venue-hire"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.venueHire}
                onChange={(e) => update("venueHire", e.target.value)}
                aria-invalid={Boolean(errors.venueHire)}
              />
            </Field>
            <Field
              id="event-venue-capacity"
              label="Capacity"
              hint="Set in Details."
            >
              <Input
                id="event-venue-capacity"
                value={capacity ?? "No cap"}
                readOnly
                disabled
              />
            </Field>
          </div>
          <div className="rounded-lg border p-3">
            <Toggle
              label="Pass it on as a venue booking fee"
              description={
                !hireCents
                  ? "Enter a hire cost to pass it on."
                  : !capacity
                    ? "Set a capacity in Details first: the fee is the hire split across the cap."
                    : `${formatNZD(hireCents)} ÷ ${capacity} cap = ${formatNZD(
                        venueFeePerTicketCents({
                          venueHireCents: hireCents,
                          passVenueHire: true,
                          capacity,
                        }),
                      )} per ticket, shown at checkout as its own line with an explainer.`
              }
              checked={draft.passVenueHire}
              onChange={(value) => update("passVenueHire", value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking fee</CardTitle>
          <CardDescription>
            {siteFee
              ? `Leave both blank for the site default, ${formatNZD(siteFee.fixedCents)} + ${siteFee.percentBp / 100}%.`
              : "Leave both blank for the site default."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field
            id="event-fee-fixed"
            label="Fixed, per ticket"
            error={errors.feeFixed}
          >
            <Input
              id="event-fee-fixed"
              inputMode="decimal"
              placeholder={
                siteFee ? (siteFee.fixedCents / 100).toFixed(2) : "0.00"
              }
              value={draft.feeFixed}
              onChange={(e) => update("feeFixed", e.target.value)}
            />
          </Field>
          <Field
            id="event-fee-percent"
            label="Percent of subtotal"
            error={errors.feePercent}
          >
            <Input
              id="event-fee-percent"
              inputMode="decimal"
              placeholder={siteFee ? (siteFee.percentBp / 100).toString() : "0"}
              value={draft.feePercent}
              onChange={(e) => update("feePercent", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Other costs</CardTitle>
              <CardDescription>
                For the dashboard only. Buyers never see these.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setCosts([...draft.costs, newCost()])}
            >
              <Plus className="size-4" /> Cost
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {draft.costs.map((cost) => (
            <div
              key={cost.key}
              className="grid grid-cols-[minmax(0,1fr)_8.5rem_auto] items-center gap-2"
            >
              <Input
                aria-label="What it's for"
                placeholder="Sound tech, security, posters…"
                value={cost.label}
                onChange={(e) => patchCost(cost.key, { label: e.target.value })}
              />
              <Input
                aria-label={`${cost.label || "Cost"} amount`}
                inputMode="decimal"
                placeholder="0.00"
                value={cost.amount}
                onChange={(e) =>
                  patchCost(cost.key, { amount: e.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${cost.label || "cost"}`}
                onClick={() =>
                  setCosts(draft.costs.filter((c) => c.key !== cost.key))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {draft.costs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing yet. Artist fees, sound, security and promo all belong
              here.
            </p>
          ) : null}
          {errors.costs ? (
            <p className="text-destructive text-xs">{errors.costs}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <dl className="space-y-1.5 text-sm">
            <Row label="Venue hire" value={formatNZD(hireCents)} />
            <Row label="Other costs" value={formatNZD(otherCents)} />
            {campaignCents > 0 ? (
              <Row label="Campaigns" value={formatNZD(campaignCents)} />
            ) : null}
            <div className="flex justify-between gap-3 border-t pt-1.5 font-semibold">
              <dt>Total costs</dt>
              <dd className="tabular-nums">{formatNZD(totalCents)}</dd>
            </div>
            <Row
              label="Break even"
              value={
                breakEven === null
                  ? "Needs a priced tier"
                  : `${breakEven} ${breakEven === 1 ? "ticket" : "tickets"}`
              }
            />
            {sellOutRevenue !== null ? (
              <>
                <Row
                  label={`Revenue if all ${sellable} sell`}
                  value={formatNZD(sellOutRevenue)}
                />
                <div className="flex justify-between gap-3 font-semibold">
                  <dt>Profit if it sells out</dt>
                  <dd
                    className={cn(
                      "tabular-nums",
                      sellOutRevenue - totalCents < 0
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {formatNZD(sellOutRevenue - totalCents)}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          {perTicket !== null && totalCents > 0 ? (
            <p className="text-muted-foreground mt-3 text-xs">
              At {formatNZD(perTicket)} a ticket on average, booking
              {venueFee > 0 ? " and venue fees" : " fee"} included, with the
              tiers selling as planned.
              {breakEven !== null && capacity !== null && breakEven > capacity
                ? " That's more than the room holds."
                : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
