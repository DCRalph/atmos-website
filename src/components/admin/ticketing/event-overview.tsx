"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { RangeSwitch } from "~/components/admin/range-switch";
import { Segmented } from "~/components/admin/segmented";
import {
  bucketSeries,
  bucketUnit,
  type AnalyticsRange,
} from "~/lib/analytics-range";
import { formatNZD, formatNZDCompact } from "~/lib/ticketing/money";
import { deviceKindLabel, deviceLabel } from "~/lib/ticketing/devices";
import {
  paidWithLabel,
  paymentMethodShort,
} from "~/lib/ticketing/payment-methods";
import {
  formatEventDate,
  formatEventDateTime,
  formatEventTime,
} from "~/lib/ticketing/dates";
import { cn } from "~/lib/utils";
import {
  BarList,
  BucketBarChart,
  ChartCard,
  CrossTab,
  StatStrip,
  StatTile,
  TierBars,
  TimeSeriesChart,
  WeekHeatmap,
} from "./charts";
import { CheckoutJourney } from "./checkout-journey";

type Overview = RouterOutputs["ticketAnalytics"]["overview"];
type Measure = "tickets" | "revenue";

const MEASURES = [
  { value: "tickets", label: "Tickets" },
  { value: "revenue", label: "Revenue" },
] as const;

/**
 * Sales dashboard for one event, on the admin event page and the organiser's.
 *
 * The range switch scopes the left column: the sales curve, when people buy,
 * where they came from, how many they bought at once and on what device. The right rail and
 * the headline numbers are always the whole event.
 */
export function EventOverview({
  eventId,
  liveHref = `/admin/events/${eventId}/live?mode=sales`,
}: {
  eventId: string;
  liveHref?: string;
}) {
  const [range, setRange] = useState<AnalyticsRange>("all");
  const [measure, setMeasure] = useState<Measure>("tickets");

  const overview = api.ticketAnalytics.overview.useQuery({ eventId });
  // The previous range stays drawn while the next one loads, dimmed, rather
  // than the page collapsing to skeletons on every click.
  const sales = api.ticketAnalytics.salesOverTime.useQuery(
    { eventId, range },
    { placeholderData: keepPreviousData },
  );
  const buyers = api.ticketAnalytics.buyers.useQuery(
    { eventId, range },
    { placeholderData: keepPreviousData },
  );
  const discounts = api.ticketAnalytics.discountPerformance.useQuery({
    eventId,
  });
  const journey = api.ticketAnalytics.journey.useQuery({ eventId });

  const utils = api.useUtils();

  async function download(kind: "attendees" | "orders" | "scans") {
    try {
      const result = await utils.ticketAnalytics.exportCsv.fetch({
        eventId,
        kind,
      });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't build that export.");
    }
  }

  if (overview.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!overview.data) return null;

  const { money, counts, costs, tiers, event } = overview.data;
  const timeZone = event.timezone;
  const stale = sales.isPlaceholderData || buyers.isPlaceholderData;

  return (
    <div className="space-y-3">
      <StatStrip
        items={[
          {
            label: "Net revenue",
            value: formatNZD(money.netCents),
            sub:
              money.refundedCents > 0
                ? `${formatNZD(money.grossCents)} gross · ${formatNZD(money.refundedCents)} refunded`
                : undefined,
            accent: "revenue",
          },
          {
            label: "Tickets sold",
            value: String(counts.sold),
            sub: `${counts.percentSold}% of ${counts.capacity} · ${counts.ticketsIssued} in the room`,
          },
          // Next to sold rather than buried in the comps tab: the front page
          // of an event should read "240 sold, 20 comped, 40 left".
          {
            label: "Comped",
            value: String(counts.comped),
            sub:
              counts.compAllowance !== null
                ? counts.comped > counts.compAllowance
                  ? `${counts.comped - counts.compAllowance} over the ${counts.compAllowance} allowance`
                  : `${counts.compAllowance - counts.comped} of ${counts.compAllowance} left`
                : counts.handoutsUnsent > 0
                  ? `${counts.handoutsUnsent} not handed out yet`
                  : undefined,
          },
          {
            label: "Admitted",
            value: String(counts.admitted),
            sub:
              counts.ticketsIssued > 0
                ? `${counts.attendanceRate}% turned up · ${counts.notArrived} no-show`
                : undefined,
            accent: "arrivals",
          },
        ]}
      />

      <Profit
        costs={costs}
        netCents={money.netCents}
        sold={counts.sold}
        capacity={counts.capacity}
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <RangeSwitch value={range} onChange={setRange} />
            <Segmented
              label="Measure"
              options={MEASURES}
              value={measure}
              onChange={setMeasure}
            />
            {sales.data ? (
              <span className="text-muted-foreground text-xs">
                {bucketUnit(sales.data.from, sales.data.to) === "hour"
                  ? "Per hour"
                  : "Per day"}{" "}
                · {formatEventDate(sales.data.from, timeZone)} to{" "}
                {formatEventDate(sales.data.to, timeZone)}
              </span>
            ) : null}
          </div>

          <div
            className={cn(
              "space-y-3 transition-opacity",
              stale && "opacity-60",
            )}
          >
            {sales.data ? (
              <SalesChart
                data={sales.data}
                measure={measure}
                breakEven={costs.breakEvenTickets}
              />
            ) : (
              <Skeleton className="h-80 w-full" />
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ChartCard
                title="When people buy"
                className={cn(
                  overview.data.arrivals.length === 0 && "md:col-span-2",
                )}
              >
                <WeekHeatmap
                  cells={(buyers.data?.weekHours ?? []).map((cell) => ({
                    day: cell.day,
                    hour: cell.hour,
                    n: cell.orders,
                  }))}
                  unit={["order", "orders"]}
                />
              </ChartCard>
              {overview.data.arrivals.length > 0 ? (
                <Arrivals rows={overview.data.arrivals} timeZone={timeZone} />
              ) : null}

              <Sources rows={buyers.data?.sources ?? []} />
              <ChartCard title="Order size">
                <BarList
                  empty="No sales in this range."
                  rows={(buyers.data?.sizes ?? []).map((row) => ({
                    key: String(row.size),
                    label:
                      row.size === 1
                        ? "1 ticket"
                        : row.size >= 4
                          ? "4 or more"
                          : `${row.size} tickets`,
                    value: row.orders,
                    detail: `${row.orders} ${row.orders === 1 ? "order" : "orders"}`,
                  }))}
                />
              </ChartCard>
              <Devices rows={buyers.data?.devices ?? []} />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <TierBars tiers={tiers} formatMoney={formatNZD} />
          <PaidWith overview={overview.data} />
          {journey.data ? <CheckoutJourney journey={journey.data} /> : null}
          <MoneyBreakdown money={money} />
          <Gst gst={overview.data.gst} money={money} costs={costs} />
          {discounts.data && discounts.data.length > 0 ? (
            <ChartCard title="Discount codes">
              <BarList
                rows={discounts.data.map((row) => ({
                  key: row.code,
                  label: `${row.code} · ${row.uses} use${row.uses === 1 ? "" : "s"}`,
                  value: row.givenCents,
                  detail: `−${formatNZD(row.givenCents)}`,
                }))}
              />
            </ChartCard>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void download("attendees")}
        >
          <Download className="size-4" /> Attendees CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void download("orders")}
        >
          <Download className="size-4" /> Orders CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void download("scans")}
        >
          <Download className="size-4" /> Scan log CSV
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={liveHref}>
            <ExternalLink className="size-4" /> Live screen
          </a>
        </Button>
      </div>
    </div>
  );
}

/**
 * The running total with what sold in each hour (or day) underneath, on the
 * same time axis, so a jump in the line lines up with the bar that caused it.
 */
function SalesChart({
  data,
  measure,
  breakEven,
}: {
  data: RouterOutputs["ticketAnalytics"]["salesOverTime"];
  measure: Measure;
  breakEven: number | null;
}) {
  const pick = (row: { tickets: number; revenueCents: number }) =>
    measure === "tickets" ? row.tickets : row.revenueCents;
  const format =
    measure === "tickets"
      ? (value: number) => String(Math.round(value))
      : (cents: number) => formatNZDCompact(Math.round(cents));
  const at = (date: Date) => formatEventDateTime(date, data.timezone);

  // Held flat from where the range opens to where it closes, so the line
  // spans the same stretch as the bars below it.
  let running = pick(data.baseline);
  const points =
    data.rows.length === 0 && running === 0
      ? []
      : [
          { x: data.from, y: running },
          ...data.rows.map((row) => ({
            x: row.at,
            y: (running += pick(row)),
          })),
          { x: data.to, y: running },
        ];

  const bars = bucketSeries(
    data.rows.map((row) => ({ at: row.at, n: pick(row) })),
    data.from,
    data.to,
    data.timezone,
  );
  const daily = bucketUnit(data.from, data.to) === "day";

  // The average past event at this many days out, in the same measure, so
  // "ahead" or "behind" is a glance rather than a sum.
  const pace = data.pace
    ? {
        label: `Average of ${data.pace.events} past ${data.pace.events === 1 ? "event" : "events"}`,
        points: data.pace.points.map((point) => ({
          x: point.at,
          y: pick(point),
        })),
      }
    : undefined;

  return (
    <ChartCard title={measure === "tickets" ? "Tickets sold" : "Revenue"}>
      <TimeSeriesChart
        bare
        title="Running total"
        points={points}
        formatValue={format}
        formatX={at}
        height={190}
        target={
          measure === "tickets" && breakEven
            ? { value: breakEven, label: `Break even · ${breakEven}` }
            : undefined
        }
        reference={pace}
        marks={data.launches.map((launch) => ({
          at: launch.at,
          label: launch.name,
        }))}
      />
      {points.length > 0 ? (
        <BucketBarChart
          bare
          title={daily ? "Sold per day" : "Sold per hour"}
          buckets={bars}
          series="revenue"
          height={80}
          formatX={(date) =>
            daily ? formatEventDate(date, data.timezone) : at(date)
          }
          formatValue={
            measure === "tickets"
              ? (n) => `${n} ${n === 1 ? "ticket" : "tickets"}`
              : (cents) => formatNZD(cents)
          }
          formatAxis={format}
        />
      ) : null}
    </ChartCard>
  );
}

/**
 * Where buyers came from, as checkouts against sales. Each bar's length is how
 * many checkouts a source started, against the busiest; the filled part is how
 * many paid. A long bar mostly empty is a source that brings people who don't
 * buy.
 */
function Sources({
  rows,
}: {
  rows: RouterOutputs["ticketAnalytics"]["buyers"]["sources"];
}) {
  const max = Math.max(1, ...rows.map((row) => row.checkouts));
  const paidColour = "var(--ticket-series-revenue)";
  const leftColour =
    "color-mix(in oklab, var(--ticket-series-revenue) 30%, transparent)";

  return (
    <ChartCard title="Where buyers came from">
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No online checkouts in this range.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={`${row.source}-${row.medium}-${row.campaign}-${row.content}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  {[row.source, row.medium, row.campaign, row.content]
                    .filter(Boolean)
                    .join(" / ")}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {row.paid} of {row.checkouts} ·{" "}
                  {Math.round((row.paid / row.checkouts) * 100)}% ·{" "}
                  {formatNZD(row.revenueCents)}
                </span>
              </div>
              <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="flex h-full overflow-hidden rounded-full"
                  style={{ width: `${(row.checkouts / max) * 100}%` }}
                >
                  <div
                    style={{
                      width: `${(row.paid / row.checkouts) * 100}%`,
                      background: paidColour,
                    }}
                  />
                  <div className="flex-1" style={{ background: leftColour }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-xs" style={{ background: paidColour }} />
          Paid
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-xs" style={{ background: leftColour }} />
          Didn&apos;t finish
        </span>
      </div>
    </ChartCard>
  );
}

/**
 * What people bought on, then how each kind of device paid. Two cards in the
 * same row, both over the chosen range. Orders from before devices were
 * recorded are left out rather than guessed at.
 */
function Devices({
  rows,
}: {
  rows: RouterOutputs["ticketAnalytics"]["buyers"]["devices"];
}) {
  const recorded = rows.flatMap((row) =>
    row.device ? [{ ...row, device: row.device }] : [],
  );

  const byDevice = new Map<string, number>();
  for (const row of recorded) {
    const label = deviceLabel(row.device, row.os);
    byDevice.set(label, (byDevice.get(label) ?? 0) + row.orders);
  }
  const total = recorded.reduce((sum, row) => sum + row.orders, 0);

  const empty = "No orders in this range recorded a device.";

  return (
    <>
      <ChartCard title="Bought on">
        <BarList
          empty={empty}
          rows={[...byDevice]
            .sort((a, b) => b[1] - a[1])
            .map(([label, orders]) => ({
              key: label,
              label,
              value: orders,
              detail: `${orders} · ${Math.round((orders / total) * 100)}%`,
            }))}
        />
      </ChartCard>
      <ChartCard title="Device and payment">
        {recorded.length === 0 ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <CrossTab
            rowHeading="Paid with"
            cells={recorded.map((row) => ({
              row: row.paidWith
                ? paidWithLabel(row.paidWith)
                : paymentMethodShort(row.paymentMethod),
              column: deviceKindLabel(row.device),
              n: row.orders,
            }))}
          />
        )}
      </ChartCard>
    </>
  );
}

const QUARTER_HOUR_MS = 15 * 60 * 1000;

/** First admissions in 15-minute buckets, from the first through the last. */
function Arrivals({
  rows,
  timeZone,
}: {
  rows: Overview["arrivals"];
  timeZone: string;
}) {
  const counts = new Map(
    rows.map((row) => [new Date(row.bucket).getTime(), row.count]),
  );
  const first = new Date(rows[0]!.bucket).getTime();
  const last = new Date(rows.at(-1)!.bucket).getTime();
  const buckets = [];
  for (let at = first; at <= last; at += QUARTER_HOUR_MS) {
    buckets.push({ x: new Date(at), y: counts.get(at) ?? 0 });
  }
  const peak = buckets.reduce((top, bucket) =>
    bucket.y > top.y ? bucket : top,
  );

  return (
    <BucketBarChart
      title="Arrivals on the night"
      action={
        <span className="text-muted-foreground text-xs">
          15 min · peak {formatEventTime(peak.x, timeZone)}
        </span>
      }
      buckets={buckets}
      height={150}
      formatX={(date) => formatEventTime(date, timeZone)}
    />
  );
}

/**
 * How orders were paid: the wallet or card Stripe saw, online or tapped at
 * the door, then cash and eftpos. Comps and free tickets took no money.
 */
function PaidWith({ overview }: { overview: Overview }) {
  const rows = [
    ...overview.byPaidWith.map((row) => ({
      key: row.paidWith,
      label: paidWithLabel(row.paidWith),
      orders: row.orders,
    })),
    ...overview.byPaymentMethod
      .filter((row) => row.method === "CASH" || row.method === "TERMINAL")
      .map((row) => ({
        key: row.method,
        label: paymentMethodShort(row.method),
        orders: row.orders,
      })),
  ];
  const total = rows.reduce((sum, row) => sum + row.orders, 0);
  if (total === 0) return null;

  return (
    <ChartCard title="Paid with">
      <BarList
        rows={rows.map((row) => ({
          key: row.key,
          label: row.label,
          value: row.orders,
          detail: `${row.orders} · ${Math.round((row.orders / total) * 100)}%`,
        }))}
      />
    </ChartCard>
  );
}

/**
 * The headline gives net and gross; this is the only place the steps between
 * them are visible. "Why is net below face value" otherwise needs a Stripe
 * dashboard and arithmetic.
 */
function MoneyBreakdown({ money }: { money: Overview["money"] }) {
  return (
    <ChartCard title="Where the money went">
      <dl className="space-y-1 text-sm">
        <Row label="Tickets" value={formatNZD(money.faceValueCents)} />
        {money.discountCents > 0 && (
          <Row label="Discounts" value={`−${formatNZD(money.discountCents)}`} />
        )}
        {money.venueFeeCents > 0 && (
          <Row
            label="Venue booking fees"
            value={formatNZD(money.venueFeeCents)}
          />
        )}
        <Row label="Booking fees" value={formatNZD(money.bookingFeeCents)} />
        <Row label="Gross" value={formatNZD(money.grossCents)} />
        {money.refundedCents > 0 && (
          <Row label="Refunded" value={`−${formatNZD(money.refundedCents)}`} />
        )}
        <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
          <dt>Net</dt>
          <dd className="tabular-nums">{formatNZD(money.netCents)}</dd>
        </div>
      </dl>
    </ChartCard>
  );
}

/**
 * GST on its own, so the money above can stay GST inclusive without a tax
 * line in every card. The sell out figure is the projection's GST, at the
 * same rate.
 */
function Gst({
  gst,
  money,
  costs,
}: {
  gst: Overview["gst"];
  money: Overview["money"];
  costs: Overview["costs"];
}) {
  return (
    <ChartCard title="GST">
      <dl className="space-y-1 text-sm">
        <Row label="Collected so far" value={formatNZD(gst.netCents)} />
        <Row
          label="Net revenue ex GST"
          value={formatNZD(money.netCents - gst.netCents)}
        />
        <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
          <dt>On a sell out</dt>
          <dd className="tabular-nums">{formatNZD(gst.ifSoldOutCents)}</dd>
        </div>
        <Row
          label="Sell out revenue ex GST"
          value={formatNZD(costs.revenueIfSoldOutCents - gst.ifSoldOutCents)}
        />
      </dl>
    </ChartCard>
  );
}

/**
 * Where sales stand against the costs. A bar from nothing to the room with
 * break even marked on it, once there are costs to break even on, then the
 * money before costs and after them, so far and on a sell out. Always shown,
 * but with no costs entered there's nothing to take off, so it stops at
 * before costs.
 */
function Profit({
  costs,
  netCents,
  sold,
  capacity,
}: {
  costs: Overview["costs"];
  netCents: number;
  sold: number;
  capacity: number;
}) {
  const target = costs.breakEvenTickets;
  const scale = Math.max(capacity, target ?? 0, sold, 1);
  const at = (tickets: number) => `${(tickets / scale) * 100}%`;
  const toGo = target === null ? null : Math.max(0, target - sold);
  const perTicket = costs.revenuePerTicketCents;
  const tone = (cents: number) => (cents < 0 ? "loss" : "gain");

  return (
    <div className="rounded-lg border p-3">
      {costs.totalCents > 0 ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-muted-foreground text-sm font-medium">
              Break even
            </p>
            <p className="text-sm tabular-nums">
              {toGo === null ? (
                <span className="text-muted-foreground">
                  Needs a priced tier to work out
                </span>
              ) : toGo > 0 ? (
                <>
                  <span className="text-lg font-semibold">{toGo}</span>{" "}
                  <span className="text-muted-foreground">
                    more {toGo === 1 ? "ticket" : "tickets"} to break even
                  </span>
                </>
              ) : (
                <span className="font-semibold">Broken even</span>
              )}
            </p>
          </div>

          <div className="relative mt-6">
            {target !== null ? (
              <span
                className="text-muted-foreground absolute bottom-full mb-1 -translate-x-1/2 text-xs whitespace-nowrap tabular-nums"
                style={{
                  left: `clamp(3rem, ${at(target)}, calc(100% - 3rem))`,
                }}
              >
                Break even · {target}
              </span>
            ) : null}
            <div className="bg-muted relative h-2 rounded-full">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: at(sold),
                  background: "var(--ticket-series-revenue)",
                }}
              />
              {target !== null ? (
                <div
                  className="bg-foreground absolute -inset-y-1 w-0.5"
                  style={{ left: at(target) }}
                />
              ) : null}
            </div>
          </div>
          <div className="text-muted-foreground mt-1 mb-4 flex justify-between text-xs tabular-nums">
            <span>{sold} sold</span>
            <span>
              {costs.sellable} on sale · {capacity} cap
            </span>
          </div>
        </>
      ) : null}

      <ProfitRow title="Before costs">
        <StatTile
          label="Revenue so far"
          value={formatNZD(netCents)}
          sub={`${sold} sold`}
        />
        <StatTile
          label="If it sells out"
          value={formatNZD(costs.revenueIfSoldOutCents)}
          sub={`${costs.sellable} sold`}
        />
        <StatTile
          label="Per ticket"
          value={perTicket === null ? "—" : formatNZD(perTicket)}
          sub={
            sold > 0
              ? "Average so far, fees included"
              : "From the tier plan, fees included"
          }
        />
      </ProfitRow>

      {costs.totalCents > 0 ? (
        <ProfitRow title="After costs" className="mt-4">
          <StatTile
            label="Costs"
            value={formatNZD(costs.totalCents)}
            sub={`${formatNZD(costs.venueHireCents)} venue · ${formatNZD(costs.otherCents)} other${costs.campaignsCents > 0 ? ` · ${formatNZD(costs.campaignsCents)} campaigns` : ""}`}
          />
          <StatTile
            label="Profit so far"
            value={formatNZD(costs.profitCents)}
            tone={tone(costs.profitCents)}
            sub="Revenue less costs"
          />
          <StatTile
            label="Profit if it sells out"
            value={formatNZD(costs.profitIfSoldOutCents)}
            tone={tone(costs.profitIfSoldOutCents)}
            sub={`${formatNZD(costs.revenueIfSoldOutCents)} less ${formatNZD(costs.totalCents)}`}
          />
        </ProfitRow>
      ) : null}
    </div>
  );
}

function ProfitRow({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground truncate">{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}
