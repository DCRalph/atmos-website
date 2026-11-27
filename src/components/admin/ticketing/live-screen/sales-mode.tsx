"use client";

import { useEffect, type ReactNode } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { TimeSeriesChart } from "~/components/admin/ticketing/charts";
import { sourceLabel } from "~/lib/ticketing/campaigns";
import {
  eventDayKey,
  formatCountdown,
  formatDuration,
  formatEventDate,
  formatEventDateTime,
  formatEventTime,
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
import { useLive, type LiveDialogProps } from "./context";
import {
  ApprovalsDialog,
  HoldsDialog,
  LiveOrderDialog,
  TierDialog,
} from "./sales-dialogs";
import {
  Card,
  Cell,
  Count,
  DetailSection,
  Feed,
  Flow,
  KeyValues,
  Loading,
  Ranks,
  shortAgo,
  Table,
  Track,
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
  const screen = useLive();
  // The hold and approval queues are the admin's to work.
  const admin = screen?.access.admin ? screen : null;

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

  const sellingRows = [
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
      value: l.shares.optIn === null ? "–" : `${l.shares.optIn}% of orders`,
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
  ];

  const rightNowBody = (
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
            dialog: admin
              ? {
                  label: "Tickets on hold",
                  content: <HoldsDialog {...admin} />,
                }
              : undefined,
          },
          {
            key: "approvals",
            label: "Waiting for approval",
            value: `${l.rightNow.approvals} guest list ${l.rightNow.approvals === 1 ? "request" : "requests"}`,
            dialog: admin
              ? {
                  label: "Waiting for approval",
                  content: <ApprovalsDialog {...admin} />,
                }
              : undefined,
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
              .slice(0, 4)
              .map(
                (row) => `${row.orders} ${sourceLabel(row.source, row.medium)}`,
              )
              .join(" · ")}
      </p>
    </div>
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
          detail={
            sales ? (
              <CurveDetail
                data={sales}
                timezone={timezone}
                breakEven={breakEven}
              />
            ) : null
          }
        >
          {sales ? (
            <Curve data={sales} timezone={timezone} breakEven={breakEven} />
          ) : null}
        </Card>
        <Card
          index={2}
          title="Right now"
          meta="last 10 minutes"
          detail={<RightNowDetail body={rightNowBody} live={l} />}
        >
          {rightNowBody}
        </Card>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-3 lg:gap-[1vw]">
        <Card
          index={3}
          title="Tiers"
          meta="sold / on sale"
          detail={<TiersDetail tiers={tiers} counts={counts} />}
        >
          <Ranks
            empty="No tiers yet."
            rows={[
              ...tiers.map((tier) => ({
                key: tier.id,
                dialog: tierDialog(screen, tier),
                name: `${tier.name} · ${formatNZDCompact(tier.priceCents)}`,
                detail: `${tier.sold} / ${tier.allocation}${tier.moved > 0 ? ` + ${tier.moved} unsold online` : ""}${tier.moved < 0 ? ` · ${-tier.moved} to the door` : tier.remaining === 0 ? " · sold out" : ""} · ${formatNZDWhole(tier.revenueCents)}`,
                share:
                  tier.sold /
                  Math.max(1, tier.allocation + Math.max(0, tier.moved)),
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
        <Card
          index={4}
          title="Latest orders"
          meta={`${counts.orders} so far`}
          detail={
            <OrdersDetail
              orders={l.latest}
              total={counts.orders}
              timezone={timezone}
              now={now}
            />
          }
        >
          <Feed
            empty="No orders yet."
            rows={l.latest.slice(0, 8).map((order) => ({
              key: order.id,
              dialog: orderDialog(screen, order),
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
        <Card
          index={5}
          title="How it's selling"
          meta="whole campaign"
          detail={
            <SellingDetail
              rows={sellingRows}
              byPaidWith={overview.byPaidWith}
              discounts={discounts}
            />
          }
        >
          <KeyValues rows={sellingRows} />
        </Card>
      </div>
    </div>
  );
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

type Overview = SalesViewProps["overview"];

/** What clicking a tier opens, on a real screen. */
const tierDialog = (
  screen: LiveDialogProps | null,
  tier: { id: string; name: string },
) =>
  screen
    ? {
        label: tier.name,
        content: <TierDialog {...screen} tierId={tier.id} />,
      }
    : undefined;

/** What clicking an order opens, on a real screen. */
const orderDialog = (screen: LiveDialogProps | null, order: { id: string }) =>
  screen
    ? {
        label: "Order",
        content: <LiveOrderDialog {...screen} orderId={order.id} />,
      }
    : undefined;
type KeyValueRow = Parameters<typeof KeyValues>[0]["rows"][number];

/** Two columns side by side on a big screen, stacked on a phone. */
function Pair({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-x-[2vw] lg:gap-y-[1.6vw]">
      {children}
    </div>
  );
}

/** The curve at full height, then the week day by day and the launches. */
function CurveDetail({
  data,
  timezone,
  breakEven,
}: {
  data: Sales;
  timezone: string;
  breakEven: number | null;
}) {
  const days = new Map<
    string,
    { at: Date; tickets: number; revenueCents: number }
  >();
  for (const row of data.rows) {
    const key = eventDayKey(row.at, timezone);
    const day = days.get(key) ?? { at: row.at, tickets: 0, revenueCents: 0 };
    day.tickets += row.tickets;
    day.revenueCents += row.revenueCents;
    days.set(key, day);
  }
  return (
    <div className="flex flex-col gap-6 lg:gap-[1.6vw]">
      <div className="h-[45vh] min-h-[240px]">
        <Curve data={data} timezone={timezone} breakEven={breakEven} />
      </div>
      <Pair>
        <DetailSection title="By day" meta="newest first">
          <Table
            columns={[
              { label: "Day" },
              { label: "Tickets", right: true },
              { label: "Revenue", right: true },
            ]}
            empty="No sales in the last 7 days."
            rows={[...days.entries()].reverse().map(([key, day]) => ({
              key,
              cells: [
                formatEventDate(day.at, timezone),
                day.tickets,
                formatNZDWhole(day.revenueCents),
              ],
            }))}
          />
        </DetailSection>
        <DetailSection title="Campaign launches" meta="the ticks on the curve">
          <Table
            columns={[{ label: "When" }, { label: "Campaign" }]}
            empty="No campaigns launched in the last 7 days."
            rows={data.launches.map((launch, i) => ({
              key: `${launch.at.getTime()}-${i}`,
              cells: [formatEventDateTime(launch.at, timezone), launch.name],
            }))}
          />
        </DetailSection>
      </Pair>
    </div>
  );
}

/** The checkout now, then today's figures and where today's buyers came from. */
function RightNowDetail({
  body,
  live,
}: {
  body: ReactNode;
  live: SalesViewProps["live"];
}) {
  const top = Math.max(1, ...live.sourcesToday.map((row) => row.orders));
  return (
    <div className="flex flex-col gap-6 lg:gap-[1.6vw]">
      {body}
      <Pair>
        <DetailSection title="Today">
          <KeyValues
            rows={[
              {
                key: "tickets",
                label: "Tickets",
                value: String(live.today.tickets),
              },
              {
                key: "revenue",
                label: "Revenue",
                value: formatNZDWhole(live.today.revenueCents),
              },
              {
                key: "hour",
                label: "In the last hour",
                value: String(live.today.lastHour),
              },
              {
                key: "last",
                label: "Last sale",
                value: live.today.lastSaleAt
                  ? formatTimeAgo(live.today.lastSaleAt)
                  : "none yet",
              },
            ]}
          />
        </DetailSection>
        <DetailSection title="Today's buyers" meta="orders">
          <Ranks
            className="lg:[mask-image:none]"
            empty="No orders today yet."
            rows={live.sourcesToday.map((row) => ({
              key: `${row.source}-${row.medium}`,
              name: sourceLabel(row.source, row.medium),
              detail: String(row.orders),
              share: row.orders / top,
            }))}
          />
        </DetailSection>
      </Pair>
    </div>
  );
}

/** Every tier in full: price, sold, what's left and what it's made. */
function TiersDetail({
  tiers,
  counts,
}: {
  tiers: Overview["tiers"];
  counts: Overview["counts"];
}) {
  const screen = useLive();
  return (
    <Table
      columns={[
        { label: "Tier" },
        { label: "Price", right: true },
        { label: "Sold", right: true },
        { label: "" },
        { label: "Left", right: true },
        { label: "Revenue", right: true },
      ]}
      empty="No tiers yet."
      rows={[
        ...tiers.map((tier) => {
          const onSale = tier.allocation + Math.max(0, tier.moved);
          return {
            key: tier.id,
            dialog: tierDialog(screen, tier),
            cells: [
              tier.name,
              formatNZD(tier.priceCents),
              `${tier.sold} / ${onSale}`,
              <Track
                key="track"
                share={tier.sold / Math.max(1, onSale)}
                className="w-24 lg:w-[8vw]"
              />,
              tier.remaining === 0
                ? "sold out"
                : tier.moved < 0
                  ? `${tier.remaining} · ${-tier.moved} to the door`
                  : String(tier.remaining),
              formatNZDWhole(tier.revenueCents),
            ],
          };
        }),
        ...(counts.comped > 0 || counts.compAllowance
          ? [
              {
                key: "comps",
                tone: "arrivals" as const,
                cells: [
                  "Comps",
                  "–",
                  counts.compAllowance !== null
                    ? `${counts.comped} / ${counts.compAllowance}`
                    : String(counts.comped),
                  null,
                  counts.compAllowance !== null
                    ? String(Math.max(0, counts.compAllowance - counts.comped))
                    : "–",
                  "–",
                ],
              },
            ]
          : []),
      ]}
    />
  );
}

/** The latest orders, as many as the screen fetched, in full. */
function OrdersDetail({
  orders,
  total,
  timezone,
  now,
}: {
  orders: SalesViewProps["live"]["latest"];
  total: number;
  timezone: string;
  now: Date;
}) {
  const screen = useLive();
  return (
    <DetailSection
      title="Newest first"
      meta={`the latest ${orders.length} of ${total}`}
    >
      <Table
        columns={[
          { label: "Paid" },
          { label: "Tickets" },
          { label: "Paid with" },
          { label: "Came from" },
          { label: "Total", right: true },
        ]}
        empty="No orders yet."
        rows={orders.map((order) => ({
          key: order.id,
          dialog: orderDialog(screen, order),
          cells: [
            `${formatEventTime(order.paidAt, timezone)} · ${shortAgo(order.paidAt, now)}`,
            order.items
              .map((item) => `${item.tickets} × ${item.name}`)
              .join(", "),
            order.paidWith
              ? paidWithLabel(order.paidWith)
              : paymentMethodShort(order.paymentMethod),
            sourceLabel(order.source, order.medium),
            formatNZD(order.totalCents),
          ],
        }))}
      />
    </DetailSection>
  );
}

/** The campaign-wide shares, then how people paid and the codes they used. */
function SellingDetail({
  rows,
  byPaidWith,
  discounts,
}: {
  rows: KeyValueRow[];
  byPaidWith: Overview["byPaidWith"];
  discounts: SalesViewProps["discounts"];
}) {
  const paid = byPaidWith.reduce((sum, row) => sum + row.orders, 0);
  return (
    <div className="flex flex-col gap-6 lg:gap-[1.6vw]">
      <KeyValues rows={rows} className="lg:[mask-image:none]" />
      <Pair>
        <DetailSection title="Paid with" meta="card orders">
          <Ranks
            className="lg:[mask-image:none]"
            empty="No card orders yet."
            rows={byPaidWith.map((row) => ({
              key: row.paidWith,
              name: paidWithLabel(row.paidWith),
              detail: `${row.orders} · ${Math.round((row.orders / Math.max(1, paid)) * 100)}%`,
              share: row.orders / Math.max(1, paid),
            }))}
          />
        </DetailSection>
        <DetailSection title="Discount codes" meta="most used first">
          <Table
            columns={[
              { label: "Code" },
              { label: "Uses", right: true },
              { label: "Given", right: true },
              { label: "Orders worth", right: true },
            ]}
            empty="No codes used yet."
            rows={discounts.map((row) => ({
              key: row.code,
              cells: [
                row.code,
                row.uses,
                formatNZDWhole(row.givenCents),
                formatNZDWhole(row.revenueCents),
              ],
            }))}
          />
        </DetailSection>
      </Pair>
    </div>
  );
}
