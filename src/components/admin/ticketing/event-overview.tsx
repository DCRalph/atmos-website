"use client";

import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { formatNZD } from "~/lib/ticketing/money";
import { formatEventDate } from "~/lib/ticketing/dates";
import { StatTile, TierBars, TimeSeriesChart } from "./charts";

/** Sales dashboard for one event. */
export function EventOverview({
  eventId,
  liveHref = `/admin/events/${eventId}/live`,
}: {
  eventId: string;
  liveHref?: string;
}) {
  const overview = api.ticketAnalytics.overview.useQuery({ eventId });
  const sales = api.ticketAnalytics.salesOverTime.useQuery({
    eventId,
    bucket: "day",
  });
  const discounts = api.ticketAnalytics.discountPerformance.useQuery({
    eventId,
  });
  const sources = api.ticketAnalytics.sources.useQuery({ eventId });

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

  const { money, counts, tiers, byPaymentMethod, event } = overview.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Net revenue"
          value={formatNZD(money.netCents)}
          sub={
            money.refundedCents > 0
              ? `${formatNZD(money.grossCents)} gross · ${formatNZD(money.refundedCents)} refunded`
              : `Includes GST ${formatNZD(money.gstCents)}`
          }
          accent="revenue"
        />
        <StatTile
          label="Tickets sold"
          value={String(counts.sold)}
          sub={`${counts.percentSold}% of ${counts.capacity} · ${counts.ticketsIssued} in the room`}
        />
        {/* Sits next to sold rather than buried in the comps tab: the front
            page of an event should read "240 sold, 20 comped, 40 left". */}
        <StatTile
          label="Comped"
          value={String(counts.comped)}
          sub={
            counts.compAllowance !== null
              ? counts.comped > counts.compAllowance
                ? `${counts.comped - counts.compAllowance} over the ${counts.compAllowance} allowance`
                : `${counts.compAllowance - counts.comped} of ${counts.compAllowance} left`
              : counts.handoutsUnsent > 0
                ? `${counts.handoutsUnsent} not handed out yet`
                : undefined
          }
        />
        <StatTile
          label="Admitted"
          value={String(counts.admitted)}
          sub={
            counts.ticketsIssued > 0
              ? `${counts.attendanceRate}% turned up · ${counts.notArrived} no-show`
              : undefined
          }
          accent="arrivals"
        />
      </div>

      <TimeSeriesChart
        title="Cumulative tickets sold"
        points={(sales.data ?? []).map((row) => ({
          x: new Date(row.bucket),
          y: row.cumulativeTickets,
        }))}
        formatValue={(value) => String(Math.round(value))}
        formatX={(date) => formatEventDate(date, event.timezone)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TierBars tiers={tiers} formatMoney={formatNZD} />

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-muted-foreground text-sm font-medium">
              Checkout funnel
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="Paid orders" value={String(counts.orders)} />
              <Row
                label="Abandoned checkouts"
                value={String(counts.abandonedCheckouts)}
              />
              <Row
                label="Conversion"
                value={
                  counts.checkoutConversion === null
                    ? "—"
                    : `${counts.checkoutConversion}%`
                }
              />
            </dl>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-muted-foreground text-sm font-medium">
              How they paid
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              {byPaymentMethod.map((row) => (
                <Row
                  key={row.method}
                  label={row.method.toLowerCase()}
                  value={`${row.orders} · ${formatNZD(row.totalCents)}`}
                />
              ))}
              {byPaymentMethod.length === 0 && (
                <p className="text-muted-foreground">Nothing sold yet.</p>
              )}
            </dl>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm font-medium">
            Discount codes
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            {discounts.data?.map((row) => (
              <Row
                key={row.code}
                label={`${row.code} · ${row.uses} use${row.uses === 1 ? "" : "s"}`}
                value={`−${formatNZD(row.givenCents)}`}
              />
            ))}
            {discounts.data?.length === 0 && (
              <p className="text-muted-foreground">No codes redeemed.</p>
            )}
          </dl>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm font-medium">
            Where buyers came from
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            {sources.data?.map((row) => (
              <Row
                key={`${row.source}-${row.medium}-${row.campaign}`}
                label={[row.source, row.medium, row.campaign]
                  .filter(Boolean)
                  .join(" / ")}
                value={`${row.orders} · ${formatNZD(row.revenueCents)}`}
              />
            ))}
            {sources.data?.length === 0 && (
              <p className="text-muted-foreground">No sales yet.</p>
            )}
          </dl>
          <p className="text-muted-foreground mt-3 text-xs">
            Add <code>?utm_source=instagram</code> to a link to track it.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void download("attendees")}>
          <Download className="size-4" /> Attendees CSV
        </Button>
        <Button variant="outline" onClick={() => void download("orders")}>
          <Download className="size-4" /> Orders CSV
        </Button>
        <Button variant="outline" onClick={() => void download("scans")}>
          <Download className="size-4" /> Scan log CSV
        </Button>
        <Button variant="outline" asChild>
          <a href={liveHref}>
            <ExternalLink className="size-4" /> Live door view
          </a>
        </Button>
      </div>
    </div>
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
