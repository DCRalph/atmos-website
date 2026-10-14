"use client";

import { useEffect } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { formatEventTime } from "~/lib/ticketing/dates";
import { formatNZDWhole } from "~/lib/ticketing/money";
import {
  scanResultShort,
  scanResultTone,
  type ScanResultTone,
} from "~/lib/ticketing/scan-results";
import {
  Bars,
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
  type Tone,
} from "./parts";

const SLOT_MS = 5 * 60 * 1000;

const FEED_TONE: Record<ScanResultTone, Tone> = {
  in: "plain",
  out: "bad",
  bad: "warn",
  neutral: "plain",
};

/**
 * Doors mode: who's in and who's still to come, the arrivals by the five
 * minutes, the last five minutes at the door, and the room by ticket, the
 * scan feed and the shape of the night along the bottom.
 */
export function DoorsMode({
  eventId,
  timezone,
  doorsAt,
  onUpdated,
}: {
  eventId: string;
  timezone: string;
  doorsAt: Date | null;
  onUpdated: (at: Date) => void;
}) {
  const live = api.ticketAnalytics.live.useQuery(
    { eventId },
    { refetchInterval: 5_000 },
  );
  const extra = api.ticketAnalytics.doorsLive.useQuery(
    { eventId },
    { refetchInterval: 10_000 },
  );
  const now = useNow(1000);

  useEffect(() => {
    if (live.dataUpdatedAt) onUpdated(new Date(live.dataUpdatedAt));
  }, [live.dataUpdatedAt, onUpdated]);

  if (!live.data || !extra.data) return <Loading />;
  return (
    <DoorsView
      live={live.data}
      extra={extra.data}
      timezone={timezone}
      doorsAt={doorsAt}
      now={now}
    />
  );
}

export type DoorsViewProps = {
  live: RouterOutputs["ticketAnalytics"]["live"];
  extra: RouterOutputs["ticketAnalytics"]["doorsLive"];
  timezone: string;
  doorsAt: Date | null;
  now: Date;
};

/** The doors screen itself, given everything it shows. */
export function DoorsView({
  live: d,
  extra: x,
  timezone,
  doorsAt,
  now,
}: DoorsViewProps) {
  const problems = d.problems.reduce((sum, row) => sum + row.count, 0);
  const scansTonight = d.admitted + d.departed + x.night.reentries + problems;
  const expectedFinal =
    x.expected.rate === null ? null : Math.round(x.expected.rate * d.sold);
  const expectedMore =
    expectedFinal === null
      ? null
      : Math.max(0, expectedFinal - d.admitted - d.departed);
  const minutesLeft =
    d.arrivalsPerMinute > 0
      ? Math.round(d.notArrived / d.arrivalsPerMinute)
      : null;

  // Every five-minute slot from the first arrival to the slot now in
  // progress, quiet ones included, so the shape of the night reads true.
  const counts = new Map(
    d.arrivals.map((row) => [new Date(row.bucket).getTime(), row.count]),
  );
  const first = d.arrivals[0] ? new Date(d.arrivals[0].bucket).getTime() : null;
  const current = Math.floor(now.getTime() / SLOT_MS) * SLOT_MS;
  const slots: { at: number; count: number }[] = [];
  if (first !== null) {
    for (let at = first; at <= current; at += SLOT_MS) {
      slots.push({ at, count: counts.get(at) ?? 0 });
    }
  }
  const peak = slots.reduce<{ at: number; count: number } | null>(
    (top, slot) => (top === null || slot.count > top.count ? slot : top),
    null,
  );

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-rows-[auto_minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-[1vw]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y py-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-[1vw] lg:py-[0.8vw]">
        <Cell
          index={0}
          label="Inside"
          tone="arrivals"
          value={<Count value={d.admitted} />}
          unit={`of ${d.sold}`}
          track={{ share: d.percentIn / 100 }}
          sub={`${d.percentIn}% of ticket holders · ${d.departed} have left`}
        />
        <Cell
          index={1}
          label="Still to come"
          value={<Count value={d.notArrived} />}
          sub={
            expectedMore !== null && x.expected.rate !== null
              ? `never scanned · expect ~${expectedMore} more, ${Math.round(x.expected.rate * 100)}% final`
              : "never scanned in"
          }
        />
        <Cell
          index={2}
          label="Arriving"
          value={
            <Count value={d.arrivalsPerMinute} format={(n) => n.toFixed(1)} />
          }
          unit="a minute"
          sub={
            peak && peak.count > 0
              ? `last 15 min · peak ${(peak.count / 5).toFixed(1)} a minute at ${formatEventTime(new Date(peak.at), timezone)}`
              : "last 15 minutes"
          }
        />
        <Cell
          index={3}
          label="Scans tonight"
          value={<Count value={scansTonight} />}
          sub={`${d.admitted} in · ${x.night.reentries} re-entries · ${d.departed} out · ${problems} problems`}
        />
        <Cell
          index={4}
          label="Door sales"
          value={<Count value={x.doorSales.tickets} />}
          unit="tickets"
          sub={`${formatNZDWhole(x.doorSales.revenueCents)} · ${x.doorSales.tap} tap to pay · ${x.doorSales.cash} cash${x.doorSales.terminal > 0 ? ` · ${x.doorSales.terminal} eftpos` : ""}`}
        />
        <Cell
          index={5}
          label="Problem scans"
          tone={problems > 0 ? "warn" : undefined}
          value={<Count value={problems} />}
          sub={
            d.problems.length > 0
              ? d.problems
                  .map(
                    (row) =>
                      `${row.count} ${scanResultShort(row.result).toLowerCase()}`,
                  )
                  .join(" · ")
              : "none"
          }
        />
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-[1vw]">
        <Card
          index={1}
          title="Arrivals"
          meta={
            first !== null
              ? `every 5 minutes since ${formatEventTime(new Date(first), timezone)} · white is the current five`
              : "every 5 minutes"
          }
        >
          {slots.length > 0 ? (
            <Bars
              values={slots.map((slot) => slot.count)}
              markLast
              className="min-h-[160px] lg:min-h-0"
            />
          ) : (
            <p className="text-muted-foreground text-sm">No arrivals yet.</p>
          )}
        </Card>
        <Card index={2} title="At the door now" meta="last 5 minutes">
          <div className="flex min-h-0 flex-col gap-3 lg:gap-[0.8vw]">
            <Flow
              steps={[
                {
                  key: "scanned",
                  label: "scanned",
                  value: x.now.scanned,
                  tone: "arrivals",
                },
                {
                  key: "in",
                  label: "let in",
                  value: x.now.letIn,
                  tone: "arrivals",
                },
                {
                  key: "away",
                  label: "turned away",
                  value: x.now.turnedAway,
                  tone: "warn",
                },
                {
                  key: "left",
                  label: "left",
                  value: x.now.departed,
                  tone: "plain",
                },
              ]}
            />
            <KeyValues
              rows={[
                ...x.now.byDevice.map((row, i) => ({
                  key: `device-${i}`,
                  label: `${row.name}${row.deviceLabel ? ` · ${row.deviceLabel}` : ""}`,
                  value: `${row.count} ${row.count === 1 ? "scan" : "scans"} · 1 every ${Math.round(300 / row.count)}s`,
                })),
                {
                  key: "doorSales",
                  label: "Door sales, last 5 min",
                  value: String(x.doorSales.recent),
                },
              ]}
            />
            <p className="text-muted-foreground mt-auto border-t pt-2 text-xs lg:pt-[0.5vw] lg:text-[0.85vw]">
              {minutesLeft !== null && d.notArrived > 0
                ? `At this rate the ${d.notArrived} still to come take about ${minutesLeft} min. `
                : ""}
              {peak && peak.count > 0
                ? `Busiest five minutes so far: ${formatEventTime(new Date(peak.at), timezone)}, ${peak.count} in.`
                : "Nobody through the door yet."}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-3 lg:gap-[1vw]">
        <Card index={3} title="Inside by ticket" meta={String(d.admitted)}>
          <Ranks
            tone="arrivals"
            empty="No tickets issued yet."
            rows={x.byTier.map((row) => ({
              key: row.label,
              name: row.label,
              detail: `${row.inside} of ${row.issued} · ${row.issued > 0 ? Math.round((row.inside / row.issued) * 100) : 0}%`,
              share: row.issued > 0 ? row.inside / row.issued : 0,
            }))}
          />
        </Card>
        <Card index={4} title="Recent scans" meta="live">
          <Feed
            empty="No scans yet tonight."
            rows={d.recent.slice(0, 12).map((scan) => {
              const tone = scanResultTone(scan.result);
              return {
                key: scan.id,
                main:
                  scan.ticket?.attendeeName ??
                  scan.ticket?.ticketNumber ??
                  "unknown",
                sub: [
                  scanResultShort(scan.result),
                  scan.ticket?.tier?.name,
                  scan.wasOverride ? "override" : null,
                  scan.deviceLabel ?? scan.scannedByName,
                ]
                  .filter(Boolean)
                  .join(" · "),
                right: shortAgo(new Date(scan.createdAt), now),
                tone: FEED_TONE[tone],
              };
            })}
          />
        </Card>
        <Card index={5} title="The night so far">
          <KeyValues
            rows={[
              {
                key: "first",
                label: "First through the door",
                value: x.night.firstAt
                  ? formatEventTime(x.night.firstAt, timezone)
                  : "–",
              },
              {
                key: "half",
                label: "Half the room in by",
                value: x.night.halfAt
                  ? formatEventTime(x.night.halfAt, timezone)
                  : "not yet",
              },
              {
                key: "avg",
                label: "Average arrival after doors",
                value:
                  x.night.avgArrivalSeconds === null ||
                  x.night.avgArrivalSeconds < 0 ||
                  !doorsAt
                    ? "–"
                    : `${Math.round(x.night.avgArrivalSeconds / 60)} min`,
              },
              {
                key: "reentries",
                label: "Re-entries",
                value: String(x.night.reentries),
              },
              {
                key: "id",
                label: "ID checks",
                value: `${x.night.idChecks} · ${x.night.idRefused} refused`,
              },
              {
                key: "overrides",
                label: "Overrides",
                value: String(x.night.overrides),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
