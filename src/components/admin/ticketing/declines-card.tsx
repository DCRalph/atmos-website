"use client";

import { TriangleAlert } from "lucide-react";

import type { RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { formatNZD } from "~/lib/ticketing/money";
import { formatDuration, formatEventDateTime } from "~/lib/ticketing/dates";
import {
  declineReasonLabel,
  paymentCardLabel,
  type Decline,
} from "~/lib/ticketing/declines";
import { BarList, ChartCard, StatStrip } from "./charts";
import { TimelineDot } from "./order-timeline";

/**
 * Declined payments: how many orders had a card declined, why, whether the
 * buyer came back and paid, and a feed of the latest. On the analytics page
 * for every event in scope, and on the event dashboard for one.
 */
type Report = RouterOutputs["analytics"]["declines"];

/** Where an order opens: the event's Orders, with that order's dialog up. */
export type OrderHref = (eventId: string, orderId: string) => string;

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";

export function DeclinesCard({
  report,
  orderHref,
  className,
}: {
  report: Report;
  orderHref: OrderHref;
  className?: string;
}) {
  const { summary } = report;

  if (summary.declined === 0) {
    return (
      <ChartCard title="Declined payments" className={className}>
        <p className="text-muted-foreground text-sm">
          No cards declined across {report.tries}{" "}
          {report.tries === 1 ? "try" : "tries"} at paying.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Declined payments" className={className}>
      <StatStrip
        items={[
          {
            label: "Declined at least once",
            value: String(summary.declined),
            sub: `of ${report.orders} orders · ${percent(summary.declined, report.orders)}`,
          },
          {
            label: "Came back and paid",
            value: `${summary.cameBack} of ${summary.declined}`,
            sub: `${summary.retried} retried · ${summary.newOrder} new ${summary.newOrder === 1 ? "order" : "orders"}`,
            accent: "revenue",
          },
          {
            label: "Lost to declines",
            value: formatNZD(summary.lostCents),
            sub: `${formatNZD(summary.recoveredCents)} recovered`,
          },
          {
            label: "Back within",
            value:
              summary.secondsBack === null
                ? "–"
                : formatDuration(summary.secondsBack),
            sub: "median, decline to paid",
          },
        ]}
      />

      <div className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-2 text-sm">Why</p>
          <BarList
            rows={summary.reasons.map((reason) => ({
              key: reason.label,
              label: reason.label,
              value: reason.n,
              detail: String(reason.n),
            }))}
          />
        </div>
        {summary.cameBack > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-sm">
              How they paid in the end
            </p>
            <BarList
              max={summary.cameBack}
              rows={[
                {
                  key: "same",
                  label: "Same card again",
                  value: summary.sameCard,
                },
                {
                  key: "switched",
                  label: "Another card or method",
                  value: summary.switched,
                },
              ].map((row) => ({ ...row, detail: String(row.value) }))}
            />
          </div>
        )}
      </div>

      <p className="text-muted-foreground mt-4 mb-2 text-sm">Recent declines</p>
      <ol>
        {report.recent.map((decline) => (
          <li
            key={decline.orderId}
            className="relative pb-3 pl-5 text-sm last:pb-0"
          >
            <TimelineDot
              tone={
                decline.outcome === "no_tickets"
                  ? "bad"
                  : decline.outcome === "lost"
                    ? undefined
                    : "ok"
              }
            />
            <div className="flex justify-between gap-3">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {decline.buyerName ?? decline.email ?? "No name"} ·{" "}
                {paymentCardLabel(decline.declined)} ·{" "}
                {declineReasonLabel(decline.reason)}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums">
                {formatEventDateTime(decline.declinedAt)}
              </span>
            </div>
            <p className="text-muted-foreground">
              <span
                className={cn(
                  decline.outcome === "no_tickets" && "text-destructive",
                )}
              >
                {outcomeText(decline)}
              </span>{" "}
              ·{" "}
              <a
                href={orderHref(decline.eventId, decline.orderId)}
                className="font-mono underline-offset-4 hover:underline"
              >
                {decline.orderNumber}
              </a>
            </p>
          </li>
        ))}
      </ol>
    </ChartCard>
  );
}

function outcomeText(decline: Decline): string {
  const later = decline.paidAt
    ? `${formatDuration((decline.paidAt.getTime() - decline.declinedAt.getTime()) / 1000)} later`
    : "";
  const card = decline.switched ? " on another card" : "";
  switch (decline.outcome) {
    case "retried":
      return `Tried again, paid ${later}${card}`;
    case "new_order":
      return `New order, paid ${later}${card}`;
    case "no_tickets":
      return `Paid ${later}${card}, but no tickets were issued`;
    case "lost":
      return "Never paid";
  }
}

/**
 * Stripe took the money and the order has no tickets. Shown above everything
 * else until it's refunded in Stripe, which the refund webhook records.
 */
export function NoTicketsAlert({
  stranded,
  orderHref,
}: {
  stranded: Report["stranded"];
  orderHref: OrderHref;
}) {
  if (stranded.length === 0) return null;
  return (
    <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-lg border p-3 text-sm">
      {stranded.map((order) => (
        <div
          key={order.orderId}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="flex items-center gap-2">
            <TriangleAlert className="text-destructive size-4 shrink-0" />
            <span>
              <span className="font-medium">
                Stripe took {formatNZD(order.amountCents)} on{" "}
                <span className="font-mono">{order.orderNumber}</span> but no
                tickets were issued.
              </span>{" "}
              <span className="text-muted-foreground">
                Refund it from the order&apos;s Stripe link.
              </span>
            </span>
          </p>
          <Button size="sm" variant="outline" asChild>
            <a href={orderHref(order.eventId, order.orderId)}>Open order</a>
          </Button>
        </div>
      ))}
    </div>
  );
}
