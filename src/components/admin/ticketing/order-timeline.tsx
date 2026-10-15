"use client";

import type { ReactNode } from "react";

import type { RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { formatNZD } from "~/lib/ticketing/money";
import { ticketCount } from "~/lib/ticketing/capacity";
import {
  declineReasonLabel,
  paymentCardLabel,
  type PaymentCard,
} from "~/lib/ticketing/declines";
import {
  formatDuration,
  formatEventDate,
  formatEventDateTime,
  formatEventTime,
} from "~/lib/ticketing/dates";
import {
  paidWithLabel,
  paymentMethodLabel,
} from "~/lib/ticketing/payment-methods";

/**
 * What happened to an order, in order: the hold, every try at paying with
 * the declines and why, the tickets going out, names, refunds, and for a
 * declined order the one they came back and paid on. Each step carries the
 * time since the one before, which is most of the story ("declined, back in
 * 40 seconds"). In the order dialog.
 */
type Order = RouterOutputs["ticketAdmin"]["order"];

type Tone = "bad" | "ok" | "next";
type Step = { at: Date; label: string; detail?: ReactNode; tone?: Tone };

const sameCard = (a: PaymentCard, b: PaymentCard) =>
  a.paidWith === b.paidWith && a.cardLast4 === b.cardLast4;

function steps(order: Order, openOrder: (id: string) => void): Step[] {
  const online =
    (order.paymentMethod === "STRIPE" || order.paymentMethod === "FREE") &&
    !order.soldByUserId;
  const held = ticketCount(order.items);
  const list: Step[] = [
    {
      at: order.createdAt,
      label: online
        ? `Held ${held} ${held === 1 ? "ticket" : "tickets"}`
        : `Sold · ${paymentMethodLabel(order.paymentMethod)}`,
    },
  ];

  let lastDeclined: PaymentCard | null = null;
  for (const attempt of order.paymentAttempts) {
    if (attempt.status === "FAILED") {
      list.push({
        at: attempt.attemptedAt,
        label: "Declined",
        detail: `${paymentCardLabel(attempt)} · ${declineReasonLabel(attempt.declineReason ?? attempt.failureCode)}`,
        tone: "bad",
      });
      lastDeclined = attempt;
    } else if (attempt.status === "SUCCEEDED") {
      const card = paymentCardLabel(attempt);
      list.push({
        at: attempt.attemptedAt,
        label: `Paid ${formatNZD(attempt.amountCents)}`,
        detail: (
          <>
            {lastDeclined
              ? sameCard(lastDeclined, attempt)
                ? "Same card, tried again"
                : `${card}, after the decline`
              : card}
            {order.decline?.outcome === "no_tickets" ? (
              <span className="text-destructive">
                {" "}
                · but no tickets were issued. Refund it in Stripe.
              </span>
            ) : null}
          </>
        ),
        tone: "ok",
      });
    } else {
      list.push({ at: attempt.attemptedAt, label: "Payment processing" });
    }
  }

  // Door sales, comps, and orders paid before tries were recorded.
  if (
    order.paidAt &&
    !order.paymentAttempts.some((a) => a.status === "SUCCEEDED")
  ) {
    list.push({
      at: order.paidAt,
      label:
        order.totalCents > 0 ? `Paid ${formatNZD(order.totalCents)}` : "Issued",
      detail: order.paidWith ? paidWithLabel(order.paidWith) : undefined,
      tone: "ok",
    });
  }

  const emailed = order.emails
    .filter((email) => email.type === "CONFIRMATION" && email.status === "sent")
    .at(-1);
  if (emailed) list.push({ at: emailed.createdAt, label: "Tickets emailed" });

  if (order.detailsCompletedAt) {
    list.push({ at: order.detailsCompletedAt, label: "Named their tickets" });
  }

  if (order.refundedAt) {
    list.push({
      at: order.refundedAt,
      label:
        order.refundedCents >= order.totalCents
          ? "Refunded"
          : `Refunded ${formatNZD(order.refundedCents)}`,
    });
  }

  const decline = order.decline;
  if (decline?.outcome === "new_order" && decline.nextOrder && decline.paidAt) {
    const next = decline.nextOrder;
    list.push({
      at: decline.paidAt,
      label: "Came back and paid",
      detail: (
        <>
          On{" "}
          <button
            type="button"
            onClick={() => openOrder(next.id)}
            className="text-foreground font-mono underline underline-offset-4"
          >
            {next.orderNumber}
          </button>
          {decline.switched === null
            ? null
            : decline.switched
              ? " · another card"
              : " · same card"}
        </>
      ),
      tone: "next",
    });
  }

  return list.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function OrderTimeline({
  order,
  onOpenOrder,
}: {
  order: Order;
  /** Opens another order in the same dialog. */
  onOpenOrder: (orderId: string) => void;
}) {
  const timeZone = order.event.timezone;
  const list = steps(order, onOpenOrder);

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Timeline</p>
      <ol>
        {list.map((step, index) => {
          const before = list[index - 1];
          const sameDay =
            before &&
            formatEventDate(before.at, timeZone) ===
              formatEventDate(step.at, timeZone);
          return (
            <li
              key={`${step.label}-${step.at.getTime()}`}
              className="relative pb-3 pl-5 text-sm last:pb-0"
            >
              {index < list.length - 1 && (
                <span
                  className="bg-border absolute top-4 bottom-0 left-[3.5px] w-px"
                  aria-hidden
                />
              )}
              <TimelineDot tone={step.tone} />
              <div className="flex justify-between gap-3">
                <span>
                  {step.label}
                  {before && (
                    <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
                      +
                      {formatDuration(
                        (step.at.getTime() - before.at.getTime()) / 1000,
                      )}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                  {sameDay
                    ? formatEventTime(step.at, timeZone)
                    : formatEventDateTime(step.at, timeZone)}
                </span>
              </div>
              {step.detail && (
                <p className="text-muted-foreground">{step.detail}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A step's dot: red for a decline, the accent for money in. */
export function TimelineDot({ tone }: { tone?: Tone }) {
  return (
    <span
      className={cn(
        "absolute top-[7px] left-0 size-2 rounded-full",
        !tone && "bg-muted-foreground",
        tone === "bad" && "bg-destructive",
        tone === "next" && "border",
      )}
      style={
        tone === "ok"
          ? { background: "var(--ticket-series-revenue)" }
          : tone === "next"
            ? { borderColor: "var(--ticket-series-revenue)" }
            : undefined
      }
      aria-hidden
    />
  );
}
