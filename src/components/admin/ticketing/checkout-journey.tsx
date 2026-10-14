"use client";

import type { RouterOutputs } from "~/trpc/react";
import { formatDuration } from "~/lib/ticketing/dates";
import { ChartCard, FunnelChart, type FunnelStage } from "./charts";

/**
 * The checkout journey as a funnel: how many visits reached each checkpoint
 * and how long the typical one took to get there from the step before. On
 * the analytics page for every event in scope, and on the event dashboard
 * for one. It ends at naming the tickets; the door is weeks away and has its
 * own numbers.
 */
type Journey = RouterOutputs["analytics"]["funnel"];

const visits = (n: number) => (n === 1 ? "visit" : "visits");
const time = (seconds: number | null) =>
  seconds === null ? undefined : formatDuration(seconds);

/**
 * Stages that have nothing yet are left out rather than drawn empty: the
 * basket checkpoint only exists from when the buy panel started sending it,
 * and naming only where an event asks for names.
 */
export function journeyStages(journey: Journey): FunnelStage[] {
  return [
    ...(journey.viewed > 0
      ? [
          {
            key: "viewed",
            label: "Saw the page",
            value: journey.viewed,
            unit: visits(journey.viewed),
          },
        ]
      : []),
    ...(journey.added > 0
      ? [
          {
            key: "added",
            label: "Added a ticket",
            value: journey.added,
            unit: visits(journey.added),
            time: time(journey.seconds.toAdd),
          },
        ]
      : []),
    {
      key: "held",
      label: "Pressed hold and pay",
      value: journey.held,
      unit: visits(journey.held),
      time: journey.added > 0 ? time(journey.seconds.toHold) : undefined,
    },
    {
      key: "paid",
      label: "Paid",
      value: journey.paid,
      unit: visits(journey.paid),
      time: time(journey.seconds.toPay),
    },
    ...(journey.named > 0
      ? [
          {
            key: "named",
            label: "Named their tickets",
            value: journey.named,
            unit: visits(journey.named),
            time: time(journey.seconds.toName),
          },
        ]
      : []),
  ];
}

export function CheckoutJourney({
  journey,
  title = "Checkout journey",
}: {
  journey: Journey;
  title?: string;
}) {
  return (
    <ChartCard title={title}>
      <FunnelChart stages={journeyStages(journey)} />
      {journey.viewed > 0 && journey.held > journey.viewed ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Page views have been counted since 15 Oct 2026. Checkouts from before
          then have no view behind them, so the first steps read low.
        </p>
      ) : null}
    </ChartCard>
  );
}
