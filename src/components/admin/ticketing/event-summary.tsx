"use client";

import type { ReactNode } from "react";
import type { IdCheckResult } from "~Prisma/client";

import { api, type RouterOutputs } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { formatNZD } from "~/lib/ticketing/money";
import { formatDuration, formatEventTime } from "~/lib/ticketing/dates";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import { scanResultLabel } from "~/lib/ticketing/scan-results";
import {
  CHANNEL_GROUPS,
  type ChannelGroup,
} from "~/lib/ticketing/event-summary";
import { cn } from "~/lib/utils";
import {
  BarList,
  BucketBarChart,
  ChartCard,
  StatStrip,
  TimeSeriesChart,
} from "./charts";

type Summary = RouterOutputs["ticketAnalytics"]["summary"];
type Overview = RouterOutputs["ticketAnalytics"]["overview"];

const QUARTER_HOUR_MS = 15 * 60 * 1000;

const ID_RESULT: Record<IdCheckResult, string> = {
  PASS: "Passed",
  UNDERAGE: "Underage",
  BANNED: "Banned",
  DOCUMENT_EXPIRED: "ID expired",
  NOT_APPROVED_EVIDENCE: "Not accepted ID",
  ALREADY_USED_TONIGHT: "ID already used tonight",
  NAME_MISMATCH: "Different name",
  UNREADABLE: "Couldn't read it",
};

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";

/**
 * The event after the fact: how many tickets went out and through which
 * channel, each tier's sell-through, who turned up and when, trouble at the
 * door, who worked it, and what the night made. Money and costs come from the
 * dashboard's own `overview`, so the two pages never disagree.
 */
export function EventSummary({ eventId }: { eventId: string }) {
  const overview = api.ticketAnalytics.overview.useQuery({ eventId });
  const summary = api.ticketAnalytics.summary.useQuery({ eventId });

  if (overview.isPending || summary.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!overview.data || !summary.data) return null;
  return <SummaryView summary={summary.data} overview={overview.data} />;
}

/** The summary itself, from data already fetched. */
export function SummaryView({
  summary: data,
  overview,
}: {
  summary: Summary;
  overview: Overview;
}) {
  const { money, costs } = overview;
  const timeZone = data.event.timezone;

  const groupTotal = (group: ChannelGroup) =>
    data.channels
      .filter((row) => row.group === group)
      .reduce((sum, row) => sum + row.tickets, 0);
  const online = groupTotal("online");
  const door = groupTotal("door");
  const given = groupTotal("given");
  // Off-platform door takings were never scanned, so turn-up is measured
  // against the tickets that could have been.
  const scannable = data.channels.reduce(
    (sum, row) => sum + (row.came === null ? 0 : row.tickets),
    0,
  );
  const came = data.channels.reduce((sum, row) => sum + (row.came ?? 0), 0);
  const bought = data.leadTimes.reduce((sum, row) => sum + row.tickets, 0);

  return (
    <div className="space-y-3">
      {!data.event.over ? (
        <p className="text-muted-foreground text-sm">
          The night isn&apos;t over yet, so these are the numbers so far.
        </p>
      ) : null}

      <StatStrip
        items={[
          {
            label: "Tickets sold",
            value: String(online + door),
            sub: `${online} online · ${door} at the door${given > 0 ? ` · ${given} given away` : ""}`,
          },
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
            label: costs.profitCents < 0 ? "Loss" : "Profit",
            value: formatNZD(Math.abs(costs.profitCents)),
            sub:
              costs.totalCents > 0
                ? `After ${formatNZD(costs.totalCents)} costs`
                : "No costs entered",
          },
          {
            label: "Came",
            value: String(came),
            sub:
              scannable > 0
                ? `${percent(came, scannable)} of tickets · ${scannable - came} no-show`
                : undefined,
            accent: "arrivals",
          },
        ]}
      />

      <Channels rows={data.channels} />
      <Tiers tiers={data.tiers} untiered={data.untiered} />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <Night
            night={data.night}
            arrivals={overview.arrivals}
            timeZone={timeZone}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChartCard title="When they bought">
              <BarList
                empty="Nothing bought."
                rows={data.leadTimes.map((bucket) => ({
                  key: bucket.key,
                  label: bucket.label,
                  value: bucket.tickets,
                  detail: `${bucket.tickets} · ${percent(bucket.tickets, bought)}`,
                }))}
              />
            </ChartCard>
            <AtTheDoor door={data.door} night={data.night} />
          </div>
          <Staff rows={data.staff} />
        </div>

        <div className="min-w-0 space-y-3">
          <Money overview={overview} came={came} sold={online + door} />
          <ChartCard title="Buyers">
            <dl className="space-y-1 text-sm">
              <Row label="Buyers" value={String(data.buyers.buyers)} />
              <Row
                label="Bought before"
                value={`${data.buyers.returning} · ${percent(data.buyers.returning, data.buyers.buyers)}`}
              />
              <Row
                label="First time"
                value={String(data.buyers.buyers - data.buyers.returning)}
              />
              <Row
                label="Opted in to marketing"
                value={`${data.buyers.optedIn} · ${percent(data.buyers.optedIn, data.buyers.buyers)}`}
              />
            </dl>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

/**
 * Every ticket by the way it went out, grouped into sold online, sold at the
 * door, and given away, each with a subtotal.
 */
function Channels({ rows }: { rows: Summary["channels"] }) {
  const total = rows.reduce((sum, row) => sum + row.tickets, 0);
  const groups = (Object.keys(CHANNEL_GROUPS) as ChannelGroup[]).flatMap(
    (group) => {
      const members = rows.filter((row) => row.group === group);
      return members.length > 0 ? [{ group, members }] : [];
    },
  );
  const sum = (
    members: Summary["channels"],
    key: "orders" | "tickets" | "netCents" | "came",
  ) =>
    members.some((row) => row[key] !== null)
      ? members.reduce((s, row) => s + (row[key] ?? 0), 0)
      : null;

  return (
    <ChartCard title="How tickets went out">
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No tickets yet.</p>
      ) : (
        <Table
          head={["", "Orders", "Tickets", "Share", "Revenue", "Came"]}
          rows={groups.flatMap(({ group, members }) => {
            const tickets = sum(members, "tickets") ?? 0;
            const came = sum(members, "came");
            const scannable = members.reduce(
              (s, row) => s + (row.came === null ? 0 : row.tickets),
              0,
            );
            return [
              {
                key: group,
                strong: true,
                cells: [
                  // A group of one names its channel here rather than
                  // repeating the same numbers on a row underneath.
                  members.length === 1 ? (
                    <span key="label">
                      {CHANNEL_GROUPS[group]}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {members[0]!.label}
                      </span>
                    </span>
                  ) : (
                    CHANNEL_GROUPS[group]
                  ),
                  sum(members, "orders") ?? "–",
                  tickets,
                  percent(tickets, total),
                  formatNZD(sum(members, "netCents") ?? 0),
                  came === null ? "–" : `${came} · ${percent(came, scannable)}`,
                ],
              },
              ...(members.length === 1 ? [] : members).map((row) => ({
                key: row.channel,
                cells: [
                  <span key="label" className="pl-3">
                    {row.label}
                  </span>,
                  row.orders ?? "–",
                  row.tickets,
                  percent(row.tickets, total),
                  formatNZD(row.netCents),
                  row.came === null
                    ? "–"
                    : `${row.came} · ${percent(row.came, row.tickets)}`,
                ],
              })),
            ];
          })}
          foot={[
            "Total",
            sum(rows, "orders") ?? "–",
            total,
            "",
            formatNZD(sum(rows, "netCents") ?? 0),
            "",
          ]}
        />
      )}
      <p className="text-muted-foreground mt-2 text-xs">
        Revenue is what was paid less refunds, fees included. Off-platform
        takings are the door totals entered by hand.
      </p>
    </ChartCard>
  );
}

/** Each tier: where it sold, how much of it, and how many of it came. */
function Tiers({
  tiers,
  untiered,
}: {
  tiers: Summary["tiers"];
  untiered: Summary["untiered"];
}) {
  return (
    <ChartCard title="By tier">
      {tiers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No tiers.</p>
      ) : (
        <Table
          head={[
            "",
            "Price",
            "Online",
            "Door",
            "Given",
            "Of allocation",
            "Face value",
            "Came",
          ]}
          rows={[
            ...tiers.map((tier) => ({
              key: tier.id,
              cells: [
                <span key="name">
                  {tier.name}
                  {tier.salesChannel !== "ALL" ? (
                    <span className="text-muted-foreground">
                      {" "}
                      ·{" "}
                      {tier.salesChannel === "DOOR"
                        ? "door only"
                        : "online only"}
                    </span>
                  ) : null}
                </span>,
                tier.groupSize > 1
                  ? `${formatNZD(tier.priceCents)} per ${tier.groupSize}`
                  : formatNZD(tier.priceCents),
                tier.online,
                tier.door,
                tier.given,
                `${tier.tickets}/${tier.allocation} · ${percent(tier.tickets, tier.allocation)}`,
                formatNZD(tier.faceValueCents),
                `${tier.came} · ${percent(tier.came, tier.tickets)}`,
              ],
            })),
            ...(untiered.tickets > 0
              ? [
                  {
                    key: "untiered",
                    cells: [
                      <span key="name" className="text-muted-foreground">
                        Comps and passes, no tier
                      </span>,
                      "",
                      "",
                      "",
                      untiered.given,
                      untiered.tickets,
                      "",
                      `${untiered.came} · ${percent(untiered.came, untiered.tickets)}`,
                    ],
                  },
                ]
              : []),
          ]}
        />
      )}
    </ChartCard>
  );
}

/**
 * How the night filled up: the headcount after every scan in or out, the
 * arrivals per 15 minutes under it, and the times worth remembering.
 */
function Night({
  night,
  arrivals,
  timeZone,
}: {
  night: Summary["night"];
  arrivals: Overview["arrivals"];
  timeZone: string;
}) {
  const counts = new Map(
    arrivals.map((row) => [new Date(row.bucket).getTime(), row.count]),
  );
  const buckets: { x: Date; y: number }[] = [];
  if (arrivals.length > 0) {
    const first = new Date(arrivals[0]!.bucket).getTime();
    const last = new Date(arrivals.at(-1)!.bucket).getTime();
    for (let at = first; at <= last; at += QUARTER_HOUR_MS) {
      buckets.push({ x: new Date(at), y: counts.get(at) ?? 0 });
    }
  }
  const at = (date: Date) => formatEventTime(date, timeZone);
  // Nobody scanned out means the line only climbs, so it's arrivals, not a
  // headcount, and saying "inside" would overstate it.
  const tracked = night.departures > 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
      <ChartCard
        title={tracked ? "Inside through the night" : "Through the door"}
        action={
          night.peak && tracked ? (
            <span className="text-muted-foreground text-xs">
              Peak {night.peak.count} at {at(night.peak.at)}
            </span>
          ) : undefined
        }
      >
        <TimeSeriesChart
          bare
          title="Headcount"
          series="arrivals"
          points={night.headcount}
          formatValue={(n) => String(Math.round(n))}
          formatX={at}
          height={180}
        />
        {buckets.length > 0 ? (
          <BucketBarChart
            bare
            title="Arrivals per 15 minutes"
            buckets={buckets}
            height={70}
            formatX={at}
          />
        ) : null}
      </ChartCard>
      <ChartCard title="The night">
        <dl className="space-y-1 text-sm">
          <Row
            label="First in"
            value={night.firstAt ? at(night.firstAt) : "–"}
          />
          <Row
            label="Half in by"
            value={night.halfAt ? at(night.halfAt) : "–"}
          />
          <Row label="Last in" value={night.lastAt ? at(night.lastAt) : "–"} />
          {night.avgArrivalSeconds !== null ? (
            <Row
              label={
                night.avgArrivalSeconds < 0
                  ? "Avg before doors"
                  : "Avg after doors"
              }
              value={formatDuration(Math.abs(night.avgArrivalSeconds))}
            />
          ) : null}
          {tracked && night.peak ? (
            <Row label="Peak inside" value={String(night.peak.count)} />
          ) : null}
          <Row label="Re-entries" value={String(night.reentries)} />
          <Row label="Scanned out" value={String(night.departures)} />
          <Row label="Let in by override" value={String(night.overrides)} />
          {night.reverted > 0 ? (
            <Row label="Admissions undone" value={String(night.reverted)} />
          ) : null}
        </dl>
      </ChartCard>
    </div>
  );
}

/** Refusals by reason, scans that came back wrong, and the ID checks. */
function AtTheDoor({
  door,
  night,
}: {
  door: Summary["door"];
  night: Summary["night"];
}) {
  const refused = door.refusals.reduce((sum, row) => sum + row.count, 0);
  const checks = door.idChecks.reduce((sum, row) => sum + row.count, 0);
  const empty =
    refused === 0 &&
    door.problems.length === 0 &&
    checks === 0 &&
    night.overrides === 0;

  return (
    <ChartCard title="At the door">
      {empty ? (
        <p className="text-muted-foreground text-sm">
          No refusals, bad scans or ID checks.
        </p>
      ) : (
        <div className="space-y-3">
          {refused > 0 ? (
            <section>
              <h3 className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                Refused · {refused}
                {door.refusalsUndone > 0
                  ? ` · ${door.refusalsUndone} taken back`
                  : ""}
              </h3>
              <BarList
                series="arrivals"
                rows={door.refusals.map((row) => ({
                  key: row.reason ?? "none",
                  label: denyReasonLabel(row.reason),
                  value: row.count,
                  detail: String(row.count),
                }))}
              />
            </section>
          ) : null}
          {door.problems.length > 0 ? (
            <section>
              <h3 className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                Scans that came back wrong
              </h3>
              <dl className="space-y-1 text-sm">
                {door.problems.map((row) => (
                  <Row
                    key={row.result}
                    label={scanResultLabel(row.result)}
                    value={String(row.count)}
                  />
                ))}
              </dl>
            </section>
          ) : null}
          {checks > 0 ? (
            <section>
              <h3 className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                ID checks · {checks}
              </h3>
              <dl className="space-y-1 text-sm">
                {door.idChecks.map((row) => (
                  <Row
                    key={row.result}
                    label={ID_RESULT[row.result]}
                    value={String(row.count)}
                  />
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      )}
    </ChartCard>
  );
}

/** Who worked the door: people scanned in, and what they sold. */
function Staff({ rows }: { rows: Summary["staff"] }) {
  if (rows.length === 0) return null;
  return (
    <ChartCard title="Door staff">
      <Table
        head={["", "Scanned in", "Door sales", "Tickets", "Taken"]}
        rows={rows.map((row) => ({
          key: row.id,
          cells: [
            row.name,
            row.admitted,
            row.doorOrders,
            row.doorTickets,
            formatNZD(row.doorNetCents),
          ],
        }))}
      />
    </ChartCard>
  );
}

/** The money, top to bottom, then what it comes to per head. */
function Money({
  overview,
  came,
  sold,
}: {
  overview: Overview;
  came: number;
  sold: number;
}) {
  const { money, costs, gst } = overview;
  return (
    <ChartCard title="Money">
      <dl className="space-y-1 text-sm">
        <Row label="Tickets" value={formatNZD(money.faceValueCents)} />
        {money.offPlatformCents > 0 ? (
          <Row
            label="Off-platform door"
            value={formatNZD(money.offPlatformCents)}
          />
        ) : null}
        {money.discountCents > 0 ? (
          <Row label="Discounts" value={`−${formatNZD(money.discountCents)}`} />
        ) : null}
        <Row label="Booking fees" value={formatNZD(money.bookingFeeCents)} />
        {money.venueFeeCents > 0 ? (
          <Row
            label="Venue booking fees"
            value={formatNZD(money.venueFeeCents)}
          />
        ) : null}
        {money.refundedCents > 0 ? (
          <Row label="Refunded" value={`−${formatNZD(money.refundedCents)}`} />
        ) : null}
        <Row label="Net revenue" value={formatNZD(money.netCents)} strong />
        {costs.venueHireCents > 0 ? (
          <Row
            label="Venue hire"
            value={`−${formatNZD(costs.venueHireCents)}`}
          />
        ) : null}
        {costs.otherCents > 0 ? (
          <Row label="Other costs" value={`−${formatNZD(costs.otherCents)}`} />
        ) : null}
        {costs.campaignsCents > 0 ? (
          <Row
            label="Campaigns"
            value={`−${formatNZD(costs.campaignsCents)}`}
          />
        ) : null}
        <Row
          label={costs.profitCents < 0 ? "Loss" : "Profit"}
          value={formatNZD(costs.profitCents)}
          strong
          tone={costs.profitCents < 0 ? "loss" : "gain"}
        />
        <div className="pt-2" />
        <Row label="GST in net revenue" value={formatNZD(gst.netCents)} />
        <Row
          label="Per ticket sold"
          value={sold > 0 ? formatNZD(Math.round(money.netCents / sold)) : "–"}
        />
        <Row
          label="Per person who came"
          value={came > 0 ? formatNZD(Math.round(money.netCents / came)) : "–"}
        />
      </dl>
    </ChartCard>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "gain" | "loss";
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        strong && "border-t pt-1 font-semibold",
      )}
    >
      <dt className={cn("truncate", !strong && "text-muted-foreground")}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          tone === "gain" && "text-emerald-600 dark:text-emerald-400",
          tone === "loss" && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * A plain numbers table: the first column is the label, the rest right
 * aligned. `strong` rows are subtotals.
 */
function Table({
  head,
  rows,
  foot,
}: {
  head: string[];
  rows: { key: string; strong?: boolean; cells: ReactNode[] }[];
  foot?: ReactNode[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-muted-foreground text-xs">
            {head.map((label, i) => (
              <th
                key={i}
                className={cn(
                  "pb-1 font-normal whitespace-nowrap",
                  i === 0 ? "w-full text-left" : "pl-4 text-right",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={cn(row.strong && "border-t font-medium")}
            >
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "py-1 whitespace-nowrap",
                    i === 0 ? "pr-2" : "pl-4 text-right",
                    !row.strong && i > 0 && "text-muted-foreground",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot ? (
          <tfoot>
            <tr className="border-t font-semibold">
              {foot.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "pt-1 whitespace-nowrap",
                    i === 0 ? "pr-2" : "pl-4 text-right",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
