"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { StatTile } from "~/components/admin/ticketing/charts";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  PAYMENT_RANGES,
  PAYMENT_RANGE_LABELS,
  type PaymentRange,
} from "~/lib/payments";
import { formatNZD } from "~/lib/ticketing/money";
import { formatEventDate, formatEventDateTime } from "~/lib/ticketing/dates";

type Overview = RouterOutputs["payments"]["overview"];

/** Ticket sales in the revenue colour, donations in the arrivals green. */
const seriesColour = (donation: boolean) =>
  `var(--ticket-series-${donation ? "arrivals" : "revenue"})`;

/**
 * The Payments page: everything the site took in a range, by method and by
 * night, with the latest payments under it. Ticket orders and donations only;
 * see `paymentsRouter` for what counts.
 */
export function PaymentsOverview() {
  const [range, setRange] = useState<PaymentRange>("30d");
  const overview = api.payments.overview.useQuery({ range });
  const utils = api.useUtils();

  async function download() {
    try {
      const result = await utils.payments.exportCsv.fetch({ range });
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

  return (
    <AdminSection
      title="Payments"
      description="Every ticket sale and donation that took money."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Range"
            className="flex gap-1 rounded-lg border p-1"
          >
            {PAYMENT_RANGES.map((key) => (
              <Button
                key={key}
                role="tab"
                size="sm"
                aria-selected={range === key}
                variant={range === key ? "secondary" : "ghost"}
                onClick={() => setRange(key)}
              >
                {PAYMENT_RANGE_LABELS[key]}
              </Button>
            ))}
          </div>
          <Button variant="outline" onClick={() => void download()}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      }
    >
      {overview.data ? (
        <Breakdown data={overview.data} />
      ) : (
        <Skeleton className="h-96 w-full" />
      )}
    </AdminSection>
  );
}

function Breakdown({ data }: { data: Overview }) {
  const { totals, methods, nights, latest } = data;
  const share = (cents: number) =>
    totals.netCents > 0 ? Math.max(0, (cents / totals.netCents) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Net taken"
          value={formatNZD(totals.netCents)}
          sub={
            totals.refundedCents > 0
              ? `${formatNZD(totals.grossCents)} gross · ${formatNZD(totals.refundedCents)} refunded`
              : "Nothing refunded"
          }
          accent="revenue"
        />
        <StatTile
          label="Payments"
          value={String(totals.count)}
          sub={
            totals.count > 0
              ? `Average ${formatNZD(totals.averageCents)}`
              : undefined
          }
        />
        <StatTile
          label="Online"
          value={
            totals.onlinePercent === null ? "—" : `${totals.onlinePercent}%`
          }
          sub={
            totals.onlinePercent === null
              ? undefined
              : `${100 - totals.onlinePercent}% at the door`
          }
        />
        <StatTile
          label="Donations"
          value={formatNZD(totals.donationCents)}
          sub={
            totals.netCents > 0
              ? `${Math.round(share(totals.donationCents))}% of everything taken`
              : undefined
          }
          accent="arrivals"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium">
            By method
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="w-[30%]">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNZD(row.netCents)}
                  </TableCell>
                  <TableCell>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${share(row.netCents)}%`,
                          background: seriesColour(row.key === "DONATION"),
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium">
            By night
          </h2>
          {nights.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nothing taken in this range.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gig</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Donations</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nights.map((night) => (
                  <TableRow key={night.key}>
                    <TableCell className="max-w-56 truncate">
                      {night.href ? (
                        <Link href={night.href} className="hover:underline">
                          {night.title}
                        </Link>
                      ) : (
                        night.title
                      )}
                      {night.date ? (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {formatEventDate(night.date)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNZD(night.ticketsCents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {night.donationsCents === 0 && !night.donationsEnabled
                        ? "off"
                        : formatNZD(night.donationsCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatNZD(night.ticketsCents + night.donationsCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="text-muted-foreground mb-2 text-sm font-medium">
          Latest payments
        </h2>
        {latest.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No payments in this range.
          </p>
        ) : (
          <Table>
            <TableBody>
              {latest.map((row) => (
                <TableRow key={`${row.source}-${row.id}`}>
                  <TableCell className="text-muted-foreground w-44">
                    {formatEventDateTime(row.paidAt)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{
                          background: seriesColour(row.source === "donation"),
                        }}
                      />
                      {row.href ? (
                        <Link href={row.href} className="hover:underline">
                          {row.forLabel}
                        </Link>
                      ) : (
                        row.forLabel
                      )}
                      <span className="text-muted-foreground">
                        {row.reference ? `${row.reference} · ` : ""}
                        {row.method}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.name ?? row.email ?? "No name given"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.refundedCents > 0 ? (
                      <span className="text-destructive mr-2 text-xs">
                        {row.refundedCents >= row.amountCents
                          ? "Refunded"
                          : `${formatNZD(row.refundedCents)} refunded`}
                      </span>
                    ) : null}
                    {formatNZD(row.amountCents)}
                  </TableCell>
                  <TableCell className="w-16 text-right">
                    {row.stripeUrl ? (
                      <a
                        href={row.stripeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground text-xs"
                      >
                        Stripe ↗
                      </a>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
