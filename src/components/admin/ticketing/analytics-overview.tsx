"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Segmented } from "~/components/admin/segmented";
import { bucketLeadTime } from "~/lib/ticketing/lead-time";
import { firstReleaseShare, pricePoints } from "~/lib/ticketing/price-points";
import { CAMPAIGN_TYPE_LABELS } from "~/lib/ticketing/campaigns";
import { formatNZD, formatNZDCompact } from "~/lib/ticketing/money";
import { deviceLabel } from "~/lib/ticketing/devices";
import {
  paidWithLabel,
  paymentMethodShort,
} from "~/lib/ticketing/payment-methods";
import { formatEventDate } from "~/lib/ticketing/dates";
import { cn } from "~/lib/utils";
import {
  BarList,
  BucketBarChart,
  ChartCard,
  StatStrip,
  WeekHeatmap,
} from "./charts";

type Events = RouterOutputs["analytics"]["events"];
type EventRow = Events["rows"][number];
type Timing = RouterOutputs["analytics"]["timing"];
type Campaigns = RouterOutputs["analytics"]["campaigns"];
type Buyers = RouterOutputs["analytics"]["buyers"];

type Scope = "all" | "past" | "upcoming";
const SCOPES = [
  { value: "all", label: "All" },
  { value: "past", label: "Past" },
  { value: "upcoming", label: "Upcoming" },
] as const;

type Measure = "orders" | "tickets" | "revenueCents";
const MEASURES = [
  { value: "orders", label: "Orders" },
  { value: "tickets", label: "Tickets" },
  { value: "revenueCents", label: "Revenue" },
] as const;

const MEASURE_UNIT: Record<Measure, [string, string]> = {
  orders: ["order", "orders"],
  tickets: ["ticket", "tickets"],
  revenueCents: ["", ""],
};

const formatMeasure = (measure: Measure) => (n: number) =>
  measure === "revenueCents"
    ? formatNZD(n)
    : `${n} ${n === 1 ? MEASURE_UNIT[measure][0] : MEASURE_UNIT[measure][1]}`;

const formatAxis = (measure: Measure) => (n: number) =>
  measure === "revenueCents" ? formatNZDCompact(n) : String(n);

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : null;

/**
 * Every event at once. The controls pick which events; everything below
 * reads them. The left column is when and how people buy and what the
 * campaigns did, the rail is who the buyers are, and the table at the bottom
 * puts the events side by side.
 */
export function AnalyticsOverview() {
  const [scope, setScope] = useState<Scope>("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [measure, setMeasure] = useState<Measure>("orders");
  const input = { scope, eventIds: picked };

  const options = api.analytics.eventOptions.useQuery({ scope });
  // The previous answer stays drawn, dimmed, while the next loads.
  const held = { placeholderData: keepPreviousData };
  const events = api.analytics.events.useQuery(input, held);
  const timing = api.analytics.timing.useQuery(input, held);
  const campaigns = api.analytics.campaigns.useQuery(input, held);
  const buyers = api.analytics.buyers.useQuery(input, held);
  const utils = api.useUtils();

  async function download() {
    try {
      const result = await utils.analytics.exportCsv.fetch(input);
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

  if (events.isPending) return <Skeleton className="h-96 w-full" />;
  if (!events.data) return null;

  const rows = events.data.rows;
  const stale =
    events.isPlaceholderData ||
    timing.isPlaceholderData ||
    campaigns.isPlaceholderData ||
    buyers.isPlaceholderData;
  const headline = summarise(rows, events.data.buyers);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Which events"
          options={SCOPES}
          value={scope}
          onChange={(next) => {
            setScope(next);
            setPicked([]);
          }}
        />
        <EventPicker
          options={options.data ?? []}
          picked={picked}
          onChange={setPicked}
        />
        <Segmented
          label="Measure"
          options={MEASURES}
          value={measure}
          onChange={setMeasure}
          className="ml-auto"
        />
      </div>

      <StatStrip
        items={[
          {
            label: "Net revenue",
            value: formatNZD(headline.netCents),
            sub: `${formatNZD(headline.avgNetCents)} per event`,
            accent: "revenue",
          },
          {
            label: "Tickets sold",
            value: String(headline.sold),
            sub: `${headline.orders} orders · ${headline.avgTicketCents === null ? "–" : formatNZD(headline.avgTicketCents)} a ticket`,
          },
          {
            label: "Events",
            value: String(rows.length),
            sub: `${headline.past} past · ${headline.upcoming} coming`,
          },
          {
            label: "Checkout conversion",
            value:
              headline.conversion === null ? "–" : `${headline.conversion}%`,
            sub:
              headline.views > 0
                ? `${headline.views} page views · ${headline.orders} paid`
                : `${headline.orders} paid of ${headline.checkouts} checkouts`,
          },
          {
            label: "Turned up",
            value:
              headline.attendance === null ? "–" : `${headline.attendance}%`,
            sub: "Of tickets issued, past events",
            accent: "arrivals",
          },
          {
            label: "Returning buyers",
            value:
              headline.repeatShare === null ? "–" : `${headline.repeatShare}%`,
            sub: `${events.data.buyers.repeat} of ${events.data.buyers.buyers} bought for more than one event`,
          },
          {
            label: "Campaign spend",
            value: formatNZD(headline.campaignSpendCents),
            sub:
              headline.campaignSpendCents > 0
                ? `${(headline.netCents / headline.campaignSpendCents).toFixed(1)}× back in net revenue`
                : "No spend recorded",
          },
          {
            label: "Marketing opt-in",
            value: headline.optInRate === null ? "–" : `${headline.optInRate}%`,
            sub: `${headline.optIns} of ${headline.orders} orders`,
          },
        ]}
      />

      <div
        className={cn(
          "grid grid-cols-1 gap-3 transition-opacity xl:grid-cols-[minmax(0,1fr)_300px]",
          stale && "opacity-60",
        )}
      >
        <div className="min-w-0 space-y-3">
          {timing.data ? (
            <Months months={timing.data.months} measure={measure} />
          ) : (
            <Skeleton className="h-44 w-full" />
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChartCard title="When people buy">
              <WeekHeatmap
                cells={(timing.data?.weekHours ?? []).map((cell) => ({
                  day: cell.day,
                  hour: cell.hour,
                  n: cell[measure],
                }))}
                unit={MEASURE_UNIT[measure]}
                formatValue={measure === "revenueCents" ? formatNZD : undefined}
              />
            </ChartCard>
            <ChartCard title="How far out they buy">
              <LeadTime rows={timing.data?.leadTime ?? []} measure={measure} />
            </ChartCard>
          </div>

          {campaigns.data ? (
            <CampaignCards data={campaigns.data} />
          ) : (
            <Skeleton className="h-60 w-full" />
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <Prices rows={rows} />
          {buyers.data ? <BuyerCards data={buyers.data} /> : null}
          <Returning rows={rows} />
          {timing.data && timing.data.arrivals.length > 0 ? (
            <Arrivals rows={timing.data.arrivals} />
          ) : null}
        </div>
      </div>

      <EventsTable rows={rows} />

      <Button variant="outline" size="sm" onClick={() => void download()}>
        <Download className="size-4" /> Events CSV
      </Button>
    </div>
  );
}

/** The headline, summed from the table rows so the two always agree. */
function summarise(rows: EventRow[], buyers: Events["buyers"]) {
  const sum = (pick: (row: EventRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const past = rows.filter((row) => row.past);
  const netCents = sum((row) => row.netCents);
  const sold = sum((row) => row.sold);
  const orders = sum((row) => row.orders);
  const abandoned = sum((row) => row.abandoned);
  const issuedPast = past.reduce((total, row) => total + row.issued, 0);
  const admittedPast = past.reduce((total, row) => total + row.admitted, 0);
  const optIns = sum((row) => row.optIns);
  return {
    netCents,
    avgNetCents: rows.length > 0 ? Math.round(netCents / rows.length) : 0,
    sold,
    orders,
    checkouts: orders + abandoned,
    avgTicketCents: sold > 0 ? Math.round(netCents / sold) : null,
    past: past.length,
    upcoming: rows.length - past.length,
    conversion: pct(orders, orders + abandoned),
    views: sum((row) => row.views),
    attendance: pct(admittedPast, issuedPast),
    repeatShare: pct(buyers.repeat, buyers.buyers),
    campaignSpendCents: sum((row) => row.campaignSpendCents),
    optIns,
    optInRate: pct(optIns, orders),
  };
}

/** Which events, within the scope. Stays open while picking several. */
function EventPicker({
  options,
  picked,
  onChange,
}: {
  options: RouterOutputs["analytics"]["eventOptions"];
  picked: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {picked.length === 0
            ? "Every event"
            : `${picked.length} ${picked.length === 1 ? "event" : "events"}`}
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuItem onSelect={() => onChange([])}>
          Every event
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((event) => (
          <DropdownMenuCheckboxItem
            key={event.id}
            checked={picked.includes(event.id)}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...picked, event.id]
                  : picked.filter((id) => id !== event.id),
              )
            }
            onSelect={(e) => e.preventDefault()}
          >
            <span className="truncate">{event.name}</span>
            <span className="text-muted-foreground ml-auto pl-3 text-xs whitespace-nowrap">
              {formatEventDate(event.startsAt, event.timezone)}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const monthLabel = new Intl.DateTimeFormat("en-NZ", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Every month from the first sale to the last, quiet ones included. */
function Months({
  months,
  measure,
}: {
  months: Timing["months"];
  measure: Measure;
}) {
  const by = new Map(months.map((row) => [row.month.getTime(), row[measure]]));
  const buckets: { x: Date; y: number }[] = [];
  const first = months[0]?.month;
  const last = months.at(-1)?.month;
  for (
    let at = first;
    at && last && at <= last;
    at = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1))
  ) {
    buckets.push({ x: at, y: by.get(at.getTime()) ?? 0 });
  }
  return (
    <BucketBarChart
      title="Sold per month"
      buckets={buckets}
      height={140}
      series="revenue"
      formatX={(date) => monthLabel.format(date)}
      formatValue={formatMeasure(measure)}
      formatAxis={formatAxis(measure)}
    />
  );
}

/** Tickets by how far before doors they sold, with the share sold by then. */
function LeadTime({
  rows,
  measure,
}: {
  rows: Timing["leadTime"];
  measure: Measure;
}) {
  const format = formatMeasure(measure);
  const buckets = bucketLeadTime(
    rows.map((row) => ({ days: row.days, n: row[measure] })),
  );
  return (
    <BarList
      empty="No sales yet."
      rows={buckets.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        value: bucket.n,
        detail: `${format(bucket.n)} · ${Math.round(bucket.soldBy * 100)}% by here`,
      }))}
    />
  );
}

type FunnelRow = {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  clicks: number | null;
  views: number;
  checkouts: number;
  paid: number;
  revenueCents: number;
  spendCents: number;
};

/**
 * Campaigns as a funnel, one row per type, source or campaign: clicks on the
 * short link, views of the page, checkouts, paid, what it made and what it
 * cost. Revenue against spend is coloured the way the Campaigns page does it.
 */
function FunnelTable({
  heading,
  rows,
  empty,
}: {
  heading: string;
  rows: FunnelRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th className="w-full pb-1 text-left font-normal">{heading}</th>
            {[
              "Clicks",
              "Views",
              "Checkouts",
              "Paid",
              "Revenue",
              "Spend",
              "Return",
            ].map((column) => (
              <th
                key={column}
                className="pb-1 pl-3 text-right font-normal whitespace-nowrap"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const times =
              row.spendCents > 0 ? row.revenueCents / row.spendCents : null;
            return (
              <tr key={row.key}>
                <td className="py-1 pr-2">
                  <div className="min-w-0">
                    {row.href ? (
                      <Link href={row.href} className="hover:underline">
                        {row.label}
                      </Link>
                    ) : (
                      <span>{row.label}</span>
                    )}
                    {row.sub ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {row.sub}
                      </p>
                    ) : null}
                  </div>
                </td>
                <Cell>{row.clicks ?? "–"}</Cell>
                <Cell>{row.views}</Cell>
                <Cell>{row.checkouts}</Cell>
                <Cell>
                  {row.paid}
                  {row.checkouts > 0
                    ? ` · ${Math.round((row.paid / row.checkouts) * 100)}%`
                    : ""}
                </Cell>
                <Cell>{formatNZD(row.revenueCents)}</Cell>
                <Cell>
                  {row.spendCents > 0 ? formatNZD(row.spendCents) : "–"}
                </Cell>
                <Cell>
                  {times === null ? (
                    "–"
                  ) : (
                    <span
                      className={cn(
                        times >= 2 && "text-emerald-600 dark:text-emerald-400",
                        times < 1 && "text-destructive",
                      )}
                    >
                      {times.toFixed(1)}×
                    </span>
                  )}
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="py-1 pl-3 text-right whitespace-nowrap">{children}</td>;
}

function CampaignCards({ data }: { data: Campaigns }) {
  const groupRows = (groups: Campaigns["byType"]): FunnelRow[] =>
    groups.map((group) => ({
      key: group.key,
      label: group.label,
      sub:
        group.campaigns > 0
          ? `${group.campaigns} ${group.campaigns === 1 ? "campaign" : "campaigns"}`
          : undefined,
      clicks: group.campaigns > 0 ? group.clicks : null,
      views: group.views,
      checkouts: group.checkouts,
      paid: group.paid,
      revenueCents: group.revenueCents,
      spendCents: group.spendCents,
    }));
  const direct =
    data.direct.checkouts > 0
      ? `${data.direct.checkouts} ${data.direct.checkouts === 1 ? "checkout" : "checkouts"} and ${formatNZD(data.direct.revenueCents)} arrived with no tags at all.`
      : null;

  return (
    <>
      <ChartCard title="Campaigns by type">
        <FunnelTable
          heading="Type"
          rows={groupRows(data.byType)}
          empty="No tagged checkouts yet."
        />
        {direct ? (
          <p className="text-muted-foreground mt-3 text-xs">{direct}</p>
        ) : null}
      </ChartCard>
      <ChartCard title="Campaigns by where they run">
        <FunnelTable
          heading="Where"
          rows={groupRows(data.bySource)}
          empty="No tagged checkouts yet."
        />
      </ChartCard>
      <ChartCard title="Top campaigns">
        <FunnelTable
          heading="Campaign"
          empty="No campaigns yet."
          rows={data.top.map((campaign) => ({
            key: campaign.id,
            label: campaign.name,
            sub: [
              campaign.event?.name ?? "Any event",
              CAMPAIGN_TYPE_LABELS[campaign.type],
              campaign.content,
            ]
              .filter(Boolean)
              .join(" · "),
            href: campaign.event
              ? `/admin/events/${campaign.event.id}?section=campaigns`
              : "/admin/campaigns",
            clicks: campaign.results.clicks,
            views: campaign.results.views,
            checkouts: campaign.results.checkouts,
            paid: campaign.results.paid,
            revenueCents: campaign.results.revenueCents,
            spendCents: campaign.spendCents,
          }))}
        />
      </ChartCard>
    </>
  );
}

/** Sell-through at each price, and how much the first release took. */
function Prices({ rows }: { rows: EventRow[] }) {
  const points = pricePoints(rows.flatMap((row) => row.tiers));
  const first = firstReleaseShare(rows);
  return (
    <ChartCard title="Sell-through by price">
      <BarList
        max={100}
        empty="No tiers yet."
        rows={points.map((point) => ({
          key: String(point.priceCents),
          label: point.priceCents === 0 ? "Free" : formatNZD(point.priceCents),
          value: point.sellThrough * 100,
          detail: `${point.sold}/${point.allocation} · ${formatNZD(point.revenueCents)}`,
        }))}
      />
      {first.share !== null ? (
        <p className="text-muted-foreground mt-3 text-xs">
          The first paid tier took {Math.round(first.share * 100)}% of paid
          tickets, over {first.events} {first.events === 1 ? "event" : "events"}{" "}
          with more than one.
        </p>
      ) : null}
    </ChartCard>
  );
}

function BuyerCards({ data }: { data: Buyers }) {
  const byDevice = new Map<string, number>();
  for (const row of data.devices) {
    const label = deviceLabel(row.device, row.os);
    byDevice.set(label, (byDevice.get(label) ?? 0) + row.orders);
  }
  const devicesTotal = data.devices.reduce((sum, row) => sum + row.orders, 0);

  const byPaidWith = new Map<string, number>();
  for (const row of data.paidWith) {
    const label = row.paidWith
      ? paidWithLabel(row.paidWith)
      : paymentMethodShort(row.paymentMethod);
    byPaidWith.set(label, (byPaidWith.get(label) ?? 0) + row.orders);
  }
  const paidTotal = data.paidWith.reduce((sum, row) => sum + row.orders, 0);

  const share = (orders: number, total: number) =>
    `${orders} · ${pct(orders, total) ?? 0}%`;
  const ranked = (counts: Map<string, number>, total: number) =>
    [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([label, orders]) => ({
        key: label,
        label,
        value: orders,
        detail: share(orders, total),
      }));

  return (
    <>
      <ChartCard title="Order size">
        <BarList
          empty="No sales yet."
          rows={data.sizes.map((row) => ({
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
      <ChartCard title="Bought on">
        <BarList
          empty="No orders recorded a device yet."
          rows={ranked(byDevice, devicesTotal)}
        />
      </ChartCard>
      <ChartCard title="Paid with">
        <BarList empty="No sales yet." rows={ranked(byPaidWith, paidTotal)} />
      </ChartCard>
    </>
  );
}

/** Returning buyers by event: who had bought for an earlier one. */
function Returning({ rows }: { rows: EventRow[] }) {
  const withBuyers = rows
    .filter((row) => row.buyers > 0)
    .map((row) => ({ ...row, share: pct(row.returning, row.buyers) ?? 0 }))
    .sort((a, b) => b.share - a.share);
  return (
    <ChartCard title="Returning buyers">
      <BarList
        max={100}
        empty="No buyers yet."
        rows={withBuyers.map((row) => ({
          key: row.id,
          label: row.name,
          value: row.share,
          detail: `${row.returning} of ${row.buyers}`,
        }))}
      />
    </ChartCard>
  );
}

const SLOT_MS = 15 * 60 * 1000;

/** "Doors", "+1h15", "−30m". */
function slotLabel(date: Date) {
  const minutes = Math.round(date.getTime() / 60_000);
  if (minutes === 0) return "Doors";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `${minutes < 0 ? "−" : "+"}${hours > 0 ? `${hours}h` : ""}${rest > 0 ? `${rest}m` : ""}`;
}

/** First admissions in 15-minute slots from doors, across past events. */
function Arrivals({ rows }: { rows: Timing["arrivals"] }) {
  const by = new Map(rows.map((row) => [row.slot, row.count]));
  const buckets = [];
  for (let slot = rows[0]!.slot; slot <= rows.at(-1)!.slot; slot++) {
    buckets.push({ x: new Date(slot * SLOT_MS), y: by.get(slot) ?? 0 });
  }
  const peak = buckets.reduce((top, bucket) =>
    bucket.y > top.y ? bucket : top,
  );
  return (
    <BucketBarChart
      title="Arrivals from doors"
      action={
        <span className="text-muted-foreground text-xs">
          peak {slotLabel(peak.x)}
        </span>
      }
      buckets={buckets}
      height={150}
      formatX={slotLabel}
    />
  );
}

const statusLabel = (status: EventRow["status"]) =>
  status.toLowerCase().replace("_", " ");

const money = (cents: number) => formatNZD(cents);

/** The events side by side. Click through to the event's own dashboard. */
function EventsTable({ rows }: { rows: EventRow[] }) {
  const columns: DataTableColumn<EventRow>[] = [
    {
      id: "event",
      header: "Event",
      sortable: true,
      accessor: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="text-muted-foreground text-xs">
            {formatEventDate(row.startsAt, row.timezone)} ·{" "}
            {statusLabel(row.status)}
          </p>
        </div>
      ),
    },
    {
      id: "date",
      header: "Date",
      sortable: true,
      defaultHidden: true,
      accessor: (row) => row.startsAt,
      cell: (row) => formatEventDate(row.startsAt, row.timezone),
    },
    {
      id: "sold",
      header: "Sold",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.sold,
      cell: (row) => `${row.sold} / ${row.capacity} · ${row.percentSold}%`,
    },
    {
      id: "net",
      header: "Net revenue",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.netCents,
      cell: (row) => money(row.netCents),
    },
    {
      id: "costs",
      header: "Costs",
      type: "number",
      align: "right",
      sortable: true,
      defaultHidden: true,
      accessor: (row) => row.costsCents,
      cell: (row) => (row.costsCents > 0 ? money(row.costsCents) : "–"),
    },
    {
      id: "profit",
      header: "Profit",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.profitCents,
      cell: (row) =>
        row.costsCents > 0 ? (
          <span
            className={cn(
              row.profitCents < 0
                ? "text-destructive"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {money(row.profitCents)}
          </span>
        ) : (
          "–"
        ),
    },
    {
      id: "spend",
      header: "Campaign spend",
      type: "number",
      align: "right",
      sortable: true,
      defaultHidden: true,
      accessor: (row) => row.campaignSpendCents,
      cell: (row) =>
        row.campaignSpendCents > 0 ? money(row.campaignSpendCents) : "–",
    },
    {
      id: "avgTicket",
      header: "Avg ticket",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.avgTicketCents,
      cell: (row) =>
        row.avgTicketCents === null ? "–" : money(row.avgTicketCents),
    },
    {
      id: "views",
      header: "Views",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.views,
    },
    {
      id: "conversion",
      header: "Checkout %",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.checkoutConversion,
      cell: (row) =>
        row.checkoutConversion === null
          ? "–"
          : `${row.checkoutConversion}% · ${row.orders} paid`,
    },
    {
      id: "attendance",
      header: "Turned up",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.attendanceRate,
      cell: (row) =>
        row.attendanceRate === null
          ? "–"
          : `${row.attendanceRate}% · ${row.admitted} in`,
    },
    {
      id: "returning",
      header: "Returning",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => pct(row.returning, row.buyers),
      cell: (row) =>
        row.buyers > 0
          ? `${pct(row.returning, row.buyers)}% · ${row.returning} of ${row.buyers}`
          : "–",
    },
  ];

  return (
    <DataTable
      title="Events compared"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      getRowHref={(row) => `/admin/events/${row.id}`}
      storageKey="admin-analytics-events"
      emptyMessage="No events in this scope."
    />
  );
}
