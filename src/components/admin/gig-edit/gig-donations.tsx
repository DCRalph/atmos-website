"use client";

import { api } from "~/trpc/react";
import { StatTile, TimeSeriesChart } from "~/components/admin/ticketing/charts";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatNZD, formatNZDCompact } from "~/lib/ticketing/money";
import { formatEventDate, formatEventDateTime } from "~/lib/ticketing/dates";

/**
 * The gig editor's Donations tab: what this gig has raised, what people
 * picked, the running total, and every donation. Read-only; the switch and
 * the amounts live in the Details tab.
 */
export function GigDonations({ gigId }: { gigId: string }) {
  const query = api.donations.forGig.useQuery({ gigId });
  if (!query.data) return <Skeleton className="h-96 w-full" />;

  const { enabled, recommendedIndex, summary, donations } = query.data;
  if (summary.count === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        {enabled
          ? "No donations yet. They show up here as soon as someone gives."
          : "Donations are off for this gig. Turn them on in Details to add a Donate button to its page."}
      </div>
    );
  }

  const pickLabel = (index: number) => {
    const amount = summary.picks[index]?.amountCents;
    return amount == null ? "Their own amount" : formatNZDCompact(amount);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Raised"
          value={formatNZD(summary.raisedCents)}
          sub={
            summary.refundedCents > 0
              ? `${formatNZD(summary.givenCents)} given · ${formatNZD(summary.refundedCents)} refunded`
              : undefined
          }
          accent="arrivals"
        />
        <StatTile
          label="Donations"
          value={String(summary.count)}
          sub={`From ${summary.people} ${summary.people === 1 ? "person" : "people"}`}
        />
        <StatTile
          label="Average"
          value={formatNZD(summary.averageCents)}
          sub={`Largest ${formatNZD(summary.largestCents)}`}
        />
        <StatTile
          label="Most picked"
          value={
            summary.mostPicked === null ? "—" : pickLabel(summary.mostPicked)
          }
          sub={
            summary.mostPicked === null
              ? undefined
              : summary.mostPicked === recommendedIndex
                ? "The recommended amount"
                : recommendedIndex === null
                  ? "Nothing is recommended"
                  : `Recommended is ${pickLabel(recommendedIndex)}`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TimeSeriesChart
          title="Raised over time"
          series="arrivals"
          points={summary.cumulative.map((point) => ({
            x: point.at,
            y: point.cents,
          }))}
          formatValue={(cents) => formatNZDCompact(Math.round(cents))}
          formatX={(date) => formatEventDate(date)}
        />

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-muted-foreground text-sm font-medium">
            What people picked
          </h2>
          {summary.picks.map((pick, index) => (
            <div key={pick.amountCents ?? "own"}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {pickLabel(index)}
                  {index === recommendedIndex ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · recommended
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {pick.count}
                </span>
              </div>
              <div className="bg-muted mt-1.5 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(pick.count / summary.count) * 100}%`,
                    background: "var(--ticket-series-arrivals)",
                  }}
                />
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="rounded-lg border p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {donations.map((donation) => (
              <TableRow key={donation.id}>
                <TableCell className="text-muted-foreground">
                  {formatEventDateTime(donation.paidAt)}
                </TableCell>
                <TableCell>
                  {donation.donorName ?? (
                    <span className="text-muted-foreground">No name given</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {donation.donorEmail ?? ""}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {donation.refundedCents > 0 ? (
                    <span className="text-destructive mr-2 text-xs">
                      {donation.refundedCents >= donation.amountCents
                        ? "Refunded"
                        : `${formatNZD(donation.refundedCents)} refunded`}
                    </span>
                  ) : null}
                  {formatNZD(donation.amountCents)}
                </TableCell>
                <TableCell className="w-16 text-right">
                  <a
                    href={donation.stripeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Stripe ↗
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
