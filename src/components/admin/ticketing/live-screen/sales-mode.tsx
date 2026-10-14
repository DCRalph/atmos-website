"use client";

import { useEffect } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { TimeSeriesChart } from "~/components/admin/ticketing/charts";
import {
  CAMPAIGN_SOURCE_LABELS,
  CAMPAIGN_TYPE_LABELS,
  campaignSourceOf,
  campaignTypeOf,
} from "~/lib/ticketing/campaigns";
import {
  formatCountdown,
  formatDuration,
  formatEventDateTime,
  formatTimeAgo,
} from "~/lib/ticketing/dates";
import { DAY_MS } from "~/lib/ticketing/lead-time";
import {
  formatNZD,
  formatNZDCompact,
  formatNZDWhole,
} from "~/lib/ticketing/money";
import {
  paidWithLabel,
  paymentMethodShort,
} from "~/lib/ticketing/payment-methods";
import {
  Card,
  Cell,
  Count,
  Feed,
  Flow,
  KeyValues,
  Loading,
  Ranks,
  shortAgo,
  useNow,
  useSize,
} from "./parts";

type Sales = RouterOutputs["ticketAnalytics"]["salesOverTime"];

/**
 * Sales mode: six headline figures, the week's curve against the average
 * past event, what's in checkout right now, and the tiers, latest orders and
 * campaign-wide shares along the bottom.
 */
export function SalesMode({
  eventId,
  timezone,
  onUpdated,
}: {
  eventId: string;
  timezone: string;
  onUpdated: (at: Date) => void;
}) {
  const overview = api.ticketAnalytics.overview.useQuery(
    { eventId },
    { refetchInterval: 30_000 },
  );
  const sales = api.ticketAnalytics.salesOverTime.useQuery(
    { eventId, range: "7d" },
    { refetchInterval: 30_000 },
  );
  const live = api.ticketAnalytics.salesLive.useQuery(
    { eventId },
    { refetchInterval: 10_000 },
  );
  const discounts = api.ticketAnalytics.discountPerformance.useQuery(
    { eventId },
    { refetchInterval: 60_000 },
  );
  const now = useNow(1000);

  useEffect(() => {
    if (live.dataUpdatedAt) onUpdated(new Date(live.dataUpdatedAt));
  }, [live.dataUpdatedAt, onUpdated]);

  if (!overview.data || !live.data) return <Loading />;
  return (
    <SalesView
      overview={overview.data}
      sales={sales.data ?? null}
      live={live.data}
      discounts={discounts.data ?? []}
      timezone={timezone}
      now={now}
    />
  );
}

export type SalesViewProps = {
  overview: RouterOutputs["ticketAnalytics"]["overview"];
  sales: Sales | null;
  live: RouterOutputs["ticketAnalytics"]["salesLive"];
  discounts: RouterOutputs["ticketAnalytics"]["discountPerformance"];
  timezone: string;
  now: Date;
};

/** The sales screen itself, given everything it shows. */
export function SalesView({
  overview,
  sales,
  live,
  discounts,
  timezone,
  now,
}: SalesViewProps) {
  const { money, counts, costs, tiers, event } = overview;
  const l = live;

  // Where the average past event stood at this moment, from the pace line.
  const paceTickets = sales?.pace?.points.at(-1)?.tickets;
  const pace =
    paceTickets === undefined
      ? null
      : {
          diff: counts.sold - Math.round(paceTickets),
          daysOut: Math.max(
            0,
            Math.round((event.startsAt.getTime() - now.getTime()) / DAY_MS),
          ),
        };
  const started = counts.orders + counts.abandonedCheckouts;
  const perOrder =
    counts.orders > 0 ? (counts.sold / counts.orders).toFixed(1) : "0";
  const breakEven = costs.breakEvenTickets;
  const toGo = breakEven === null ? null : Math.max(0, breakEven - counts.sold);
  const paidWithTotal = overview.byPaidWith.reduce(
    (sum, row) => sum + row.orders,
    0,
  );
  const codes = discounts.reduce(
    (sum, row) => ({
      uses: sum.uses + row.uses,
      givenCents: sum.givenCents + row.givenCents,
    }),
    { uses: 0, givenCents: 0 },
  );

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-rows-[auto_minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-[1vw]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y py-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-[1vw] lg:py-[0.8vw]">
        <Cell
          index={0}
          label="Tickets sold"
          value={<Count value={counts.sold} />}
          unit={`of ${counts.capacity}`}
          track={{
            share:
              counts.capacity > 0 ? counts.ticketsIssued / counts.capacity : 0,
            tick:
              breakEven !== null && counts.capacity > 0
                ? breakEven / counts.capacity
                : undefined,
          }}
          sub={`${counts.percentSold}% of the room · ${Math.max(0, costs.sellable - counts.sold)} left`}
        />
        <Cell
          index={1}
          label="Net revenue"
          tone="revenue"
          value={<Count value={money.netCents} format={formatNZDWhole} />}
          sub={`${costs.revenuePerTicketCents === null ? "–" : formatNZD(costs.revenuePerTicketCents)} a ticket · ${formatNZDWhole(costs.revenueIfSoldOutCents)} on a sell out`}
        />
        <Cell
          index={2}
          label="Today"
          value={<Count value={l.today.tickets} />}
          unit="tickets"
          sub={`${formatNZDWhole(l.today.revenueCents)} · ${l.today.lastHour} in the last hour · last sale ${l.today.lastSaleAt ? formatTimeAgo(l.today.lastSaleAt, now) : "none yet"}`}
        />
        <Cell
          index={3}
          label="Orders"
          value={<Count value={counts.orders} />}
          sub={`${perOrder} tickets each · ${counts.checkoutConversion ?? 0}% checkout to paid`}
        />
        <Cell
          index={4}
          label="Pace"
          tone={pace ? (pace.diff >= 0 ? "arrivals" : "bad") : undefined}
          value={
            pace ? (
              <Count
                value={pace.diff}
                format={(n) =>
                  `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n))}`
                }
              />
            ) : (
              "–"
            )
          }
          sub={
            pace
              ? `${pace.diff >= 0 ? "ahead of" : "behind"} your average event ${pace.daysOut === 0 ? "on the day" : `at ${pace.daysOut} ${pace.daysOut === 1 ? "day" : "days"} out`}`
              : "no past events to compare against"
          }
        />
        <Cell
          index={5}
          label={costs.totalCents > 0 ? "Profit" : "If it sells out"}
          tone={
            costs.totalCents > 0
              ? costs.profitCents >= 0
                ? "arrivals"
                : "bad"
              : undefined
          }
          value={
            <Count
              value={
                costs.totalCents > 0
                  ? costs.profitCents
                  : costs.revenueIfSoldOutCents
              }
              format={formatNZDWhole}
            />
          }
          sub={
            costs.totalCents > 0
              ? breakEven !== null
                ? toGo && toGo > 0
                  ? `break even at ${breakEven}, ${toGo} to go`
                  : `break even at ${breakEven}, done`
                : `${formatNZDWhole(costs.totalCents)} of costs`
              : "no costs entered yet"
          }
        />
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-[1vw]">
        <Card
          index={1}
          title="Sales, last 7 days"
          meta="running total · dashed is your average event · ticks are campaign launches"
        >
          {sales ? (
            <Curve data={sales} timezone={timezone} breakEven={breakEven} />
          ) : null}
        </Card>
        <Card index={2} title="Right now" meta="last 10 minutes">
          <div className="flex min-h-0 flex-col gap-3 lg:gap-[0.8vw]">
            <Flow
              steps={[
                {
                  key: "viewing",
                  label: "on the page",
                  value: l.rightNow.viewing,
                },
                {
                  key: "basket",
                  label: "in a basket",
                  value: l.rightNow.basket,
                },
                { key: "holding", label: "holding", value: l.rightNow.holding },
                {
                  key: "paid",
                  label: "paid",
                  value: l.rightNow.paid,
                  tone: "arrivals",
                },
              ]}
            />
            <KeyValues
              rows={[
                {
                  key: "held",
                  label: "Tickets on hold",
                  value: `${l.rightNow.ticketsHeld}${
                    l.rightNow.nextExpiry
                      ? ` · next hold expires in ${formatCountdown(l.rightNow.nextExpiry.getTime() - now.getTime())}`
                      : ""
                  }`,
                },
                {
                  key: "approvals",
                  label: "Waiting for approval",
                  value: `${l.rightNow.approvals} guest list ${l.rightNow.approvals === 1 ? "request" : "requests"}`,
                },
                {
                  key: "abandoned",
                  label: "Gave up in the last hour",
                  value: `${l.rightNow.abandonedLastHour} ${l.rightNow.abandonedLastHour === 1 ? "checkout" : "checkouts"}`,
                },
                {
                  key: "typical",
                  label: "Typical checkout today",
                  value:
                    l.rightNow.typicalCheckoutSeconds === null
                      ? "–"
                      : formatDuration(l.rightNow.typicalCheckoutSeconds),
                },
              ]}
            />
            <p className="text-muted-foreground mt-auto border-t pt-2 text-xs lg:pt-[0.5vw] lg:text-[0.85vw]">
              Today&apos;s buyers:{" "}
              {l.sourcesToday.length === 0
                ? "none yet"
                : l.sourcesToday
                    .map(
                      (row) =>
                        `${row.orders} ${sourceLabel(row.source, row.medium)}`,
                    )
                    .join(" · ")}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-3 lg:gap-[1vw]">
        <Card index={3} title="Tiers" meta="sold / on sale">
          <Ranks
            empty="No tiers yet."
            rows={[
              ...tiers.map((tier) => ({
                key: tier.id,
                name: `${tier.name} · ${formatNZDCompact(tier.priceCents)}`,
                detail: `${tier.sold} / ${tier.allocation}${tier.remaining === 0 ? " · sold out" : ""} · ${formatNZDWhole(tier.revenueCents)}`,
                share: tier.allocation > 0 ? tier.sold / tier.allocation : 0,
              })),
              ...(counts.comped > 0 || counts.compAllowance
                ? [
                    {
                      key: "comps",
                      name: "Comps",
                      detail:
                        counts.compAllowance !== null
                          ? `${counts.comped} of ${counts.compAllowance} given`
                          : `${counts.comped} given`,
                      share: counts.compAllowance
                        ? counts.comped / counts.compAllowance
                        : counts.comped > 0
                          ? 1
                          : 0,
                      tone: "arrivals" as const,
                    },
                  ]
                : []),
            ]}
          />
        </Card>
        <Card index={4} title="Latest orders" meta={`${counts.orders} so far`}>
          <Feed
            empty="No orders yet."
            rows={l.latest.map((order) => ({
              key: order.id,
              main: order.items
                .map((item) => `${item.tickets} × ${item.name}`)
                .join(", "),
              sub: `${
                order.paidWith
                  ? paidWithLabel(order.paidWith)
                  : paymentMethodShort(order.paymentMethod)
              } · ${sourceLabel(order.source, order.medium)}`,
              right: `${formatNZDCompact(order.totalCents)} · ${shortAgo(order.paidAt, now)}`,
            }))}
          />
        </Card>
        <Card index={5} title="How it's selling" meta="whole campaign">
          <KeyValues
            rows={[
              {
                key: "started",
                label: "Checkouts started",
                value: `${started} · ${counts.checkoutConversion ?? 0}% paid`,
              },
              {
                key: "phone",
                label: "Bought on a phone",
                value: l.shares.phone === null ? "–" : `${l.shares.phone}%`,
              },
              {
                key: "paidWith",
                label: "Paid with",
                value:
                  paidWithTotal > 0
                    ? overview.byPaidWith
                        .slice(0, 3)
                        .map(
                          (row) =>
                            `${paidWithLabel(row.paidWith)} ${Math.round((row.orders / paidWithTotal) * 100)}%`,
                        )
                        .join(" · ")
                    : "–",
              },
              {
                key: "codes",
                label: "Discount codes used",
                value:
                  codes.uses > 0
                    ? `${codes.uses} · ${formatNZDWhole(codes.givenCents)} given`
                    : "none",
              },
              {
                key: "optIn",
                label: "Marketing opt-in",
                value:
                  l.shares.optIn === null
                    ? "–"
                    : `${l.shares.optIn}% of orders`,
              },
              {
                key: "returning",
                label: "Returning buyers",
                value:
                  l.shares.returning === null
                    ? "–"
                    : `${l.shares.returning}% bought before`,
              },
              {
                key: "spend",
                label: "Campaign spend",
                value:
                  costs.campaignsCents > 0
                    ? `${formatNZDWhole(costs.campaignsCents)} · ${(money.netCents / costs.campaignsCents).toFixed(1)}× back`
                    : "none recorded",
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

/** "Poster / QR" -> "poster / QR": a label read mid-sentence. */
const lowerFirst = (label: string) =>
  label.charAt(0).toLowerCase() + label.slice(1);

/** "Instagram story", "Email newsletter", "ig social", "direct": tags in words. */
function sourceLabel(source: string | null, medium: string | null) {
  if (!source && !medium) return "direct";
  const where = source
    ? campaignSourceOf(source) === "other"
      ? source
      : CAMPAIGN_SOURCE_LABELS[campaignSourceOf(source)]
    : null;
  const type = campaignTypeOf(medium);
  const kind = medium
    ? type === "other"
      ? medium
      : lowerFirst(CAMPAIGN_TYPE_LABELS[type])
    : null;
  return [where, kind].filter(Boolean).join(" ");
}

/**
 * The running total of tickets over the range, filling whatever height the
 * card has left, with the pace line and campaign launches on it.
 */
function Curve({
  data,
  timezone,
  breakEven,
}: {
  data: Sales;
  timezone: string;
  breakEven: number | null;
}) {
  const [ref, size] = useSize();
  let running = data.baseline.tickets;
  const points =
    data.rows.length === 0 && running === 0
      ? []
      : [
          { x: data.from, y: running },
          ...data.rows.map((row) => ({
            x: row.at,
            y: (running += row.tickets),
          })),
          { x: data.to, y: running },
        ];

  return (
    <div ref={ref} className="h-full min-h-[160px] lg:min-h-0">
      {size.height > 0 ? (
        <TimeSeriesChart
          bare
          title="Tickets sold"
          points={points}
          height={size.height}
          formatValue={(value) => String(Math.round(value))}
          formatX={(date) => formatEventDateTime(date, timezone)}
          target={
            breakEven
              ? { value: breakEven, label: `Break even · ${breakEven}` }
              : undefined
          }
          reference={
            data.pace
              ? {
                  label: `Average of ${data.pace.events} past ${data.pace.events === 1 ? "event" : "events"}`,
                  points: data.pace.points.map((point) => ({
                    x: point.at,
                    y: point.tickets,
                  })),
                }
              : undefined
          }
          marks={data.launches.map((launch) => ({
            at: launch.at,
            label: launch.name,
          }))}
        />
      ) : null}
    </div>
  );
}
