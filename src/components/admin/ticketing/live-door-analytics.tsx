"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { BucketBarChart, StatTile } from "~/components/admin/ticketing/charts";
import { formatEventTime, formatTimeAgo } from "~/lib/ticketing/dates";

export function LiveDoorAnalytics({
  eventId,
  backHref,
}: {
  eventId: string;
  backHref: string;
}) {
  const event = api.ticketEvents.byId.useQuery(
    { id: eventId },
    { enabled: !!eventId },
  );
  const live = api.ticketAnalytics.live.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 5000 },
  );

  const timezone = event.data?.timezone ?? "Pacific/Auckland";

  return (
    <AdminSection
      title="Live door"
      subtitle={event.data?.name}
      backLink={{ href: backHref, label: "← Event" }}
      actions={
        <Badge variant="outline" className="gap-1.5">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          updating every 5s
        </Badge>
      }
    >
      {live.isPending && <Skeleton className="h-96 w-full" />}

      {live.data && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Inside"
              value={String(live.data.admitted)}
              sub={`${live.data.percentIn}% of ${live.data.sold} sold`}
              accent="arrivals"
            />
            <StatTile
              label="Still to come"
              value={String(live.data.notArrived)}
            />
            <StatTile
              label="Arrival rate"
              value={`${live.data.arrivalsPerMinute}/min`}
              sub="last 15 minutes"
            />
            <StatTile
              label="Problem scans"
              value={String(
                live.data.problems.reduce((sum, row) => sum + row.count, 0),
              )}
              sub={
                live.data.problems
                  .map((row) => `${row.count} ${row.result.toLowerCase()}`)
                  .join(", ") || "none"
              }
            />
          </div>

          <BucketBarChart
            title="Arrivals, 5-minute buckets"
            buckets={live.data.arrivals.map((row) => ({
              x: new Date(row.bucket),
              y: row.count,
            }))}
            formatX={(date) => formatEventTime(date, timezone)}
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm font-medium">
                Scans by staff
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {live.data.byStaff.map((row, index) => (
                  <li
                    key={`${row.name}-${row.deviceLabel}-${index}`}
                    className="flex justify-between gap-3"
                  >
                    <span className="truncate">
                      {row.name}
                      {row.deviceLabel ? ` · ${row.deviceLabel}` : ""}
                    </span>
                    <span className="tabular-nums">{row.count}</span>
                  </li>
                ))}
                {live.data.byStaff.length === 0 && (
                  <li className="text-muted-foreground">Nobody scanned yet.</li>
                )}
              </ul>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm font-medium">
                Recent scans
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {live.data.recent.map((scan) => {
                  const good =
                    scan.result === "ADMITTED" ||
                    scan.result === "OVERRIDE_ADMITTED" ||
                    scan.result === "REENTRY";
                  return (
                    <li key={scan.id} className="flex items-center gap-2">
                      {!good && (
                        <AlertTriangle
                          className="size-3.5 shrink-0 text-amber-500"
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {scan.ticket?.attendeeName ??
                          scan.ticket?.ticketNumber ??
                          "unknown"}
                        <span className="text-muted-foreground">
                          {" "}
                          · {scan.result.replace("_", " ").toLowerCase()}
                          {scan.deviceLabel ? ` · ${scan.deviceLabel}` : ""}
                          {scan.scannedByName ? ` · ${scan.scannedByName}` : ""}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatTimeAgo(new Date(scan.createdAt))}
                      </span>
                    </li>
                  );
                })}
                {live.data.recent.length === 0 && (
                  <li className="text-muted-foreground">
                    No scans yet tonight.
                  </li>
                )}
              </ul>
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            Assigned door staff scan at{" "}
            <Link href="/door" className="underline">
              /door
            </Link>
            .
          </p>
        </div>
      )}
    </AdminSection>
  );
}
