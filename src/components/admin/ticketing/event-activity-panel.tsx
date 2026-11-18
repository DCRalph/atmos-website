"use client";

import { useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { InfiniteScrollTrigger } from "~/components/infinite-scroll-trigger";
import { FilterSelect, ListFilters } from "../list-filters";
import { TimelineDot } from "./order-timeline";
import { formatNZD } from "~/lib/ticketing/money";
import { paymentMethodLabel } from "~/lib/ticketing/payment-methods";
import { scanResultLabel, scanResultTone } from "~/lib/ticketing/scan-results";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import type { ActivityKind } from "~/lib/ticketing/event-activity";
import {
  eventDayKey,
  formatEventDateLong,
  formatEventTime,
} from "~/lib/ticketing/dates";

/**
 * Everything that happened on an event, newest first: sales, refunds, every
 * scan at the door, and what admins changed. Grouped by day in the event's
 * zone. The Activity section of the event page.
 */

type Item = RouterOutputs["ticketAdmin"]["activity"]["items"][number];

const KIND_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "refunds", label: "Refunds" },
  { value: "door", label: "Door" },
  { value: "changes", label: "Changes" },
] as const satisfies readonly { value: ActivityKind; label: string }[];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function describe(item: Item): {
  label: string;
  detail: string;
  tone?: "ok" | "bad";
} {
  const by = item.by ? `by ${item.by}` : null;
  switch (item.kind) {
    case "sales":
      return {
        label: `${item.buyerName ?? "Someone"} bought ${plural(item.tickets, "ticket")} · ${formatNZD(item.totalCents)}`,
        detail: [
          item.orderNumber,
          paymentMethodLabel(item.paymentMethod),
          item.by ? `sold by ${item.by}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: "ok",
      };
    case "door": {
      const tone = scanResultTone(item.result);
      return {
        label: [scanResultLabel(item.result), item.attendeeName]
          .filter(Boolean)
          .join(" · "),
        detail: [
          item.ticketNumber,
          item.result === "DENIED" ? denyReasonLabel(item.denyReason) : null,
          item.note,
          by,
          item.deviceLabel,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: tone === "in" ? "ok" : tone === "neutral" ? undefined : "bad",
      };
    }
    case "refunds":
      return { label: item.action, detail: by ?? "", tone: "bad" };
    case "changes":
      return { label: item.action, detail: by ?? "" };
  }
}

export function EventActivityPanel({
  eventId,
  timeZone,
}: {
  eventId: string;
  timeZone: string;
}) {
  const [kind, setKind] = useState<ActivityKind | null>(null);

  const activity = api.ticketAdmin.activity.useInfiniteQuery(
    { eventId, kind: kind ?? undefined, limit: 50 },
    { getNextPageParam: (page) => page.nextCursor ?? undefined },
  );
  const items = activity.data?.pages.flatMap((page) => page.items) ?? [];

  // Consecutive rows on the same day share a heading.
  const days: { key: string; at: Date; items: Item[] }[] = [];
  for (const item of items) {
    const key = eventDayKey(item.at, timeZone);
    const day = days.at(-1);
    if (day?.key === key) day.items.push(item);
    else days.push({ key, at: item.at, items: [item] });
  }

  return (
    <div className="space-y-4">
      <ListFilters
        activeCount={kind ? 1 : 0}
        onClear={() => setKind(null)}
        summary={
          activity.isPending || (activity.isError && items.length === 0)
            ? null
            : `${items.length}${activity.hasNextPage ? "+" : ""} ${items.length === 1 ? "entry" : "entries"}`
        }
      >
        <FilterSelect
          label="Show"
          value={kind}
          onChange={setKind}
          options={KIND_OPTIONS}
          anyLabel="Everything"
        />
      </ListFilters>

      {activity.isError && items.length === 0 ? (
        <ErrorLine onRetry={() => void activity.refetch()} />
      ) : activity.isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing yet.</p>
      ) : (
        days.map((day) => (
          <section key={day.key}>
            <h3 className="text-muted-foreground mb-2 text-xs font-medium">
              {formatEventDateLong(day.at, timeZone)}
            </h3>
            <ol>
              {day.items.map((item, index) => {
                const { label, detail, tone } = describe(item);
                return (
                  <li
                    key={`${item.kind}-${item.id}`}
                    className="relative pb-3 pl-5 text-sm last:pb-0"
                  >
                    {index < day.items.length - 1 && (
                      <span
                        className="bg-border absolute top-4 bottom-0 left-[3.5px] w-px"
                        aria-hidden
                      />
                    )}
                    <TimelineDot tone={tone} />
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0 break-words">{label}</span>
                      <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                        {formatEventTime(item.at, timeZone)}
                      </span>
                    </div>
                    {detail && (
                      <p className="text-muted-foreground text-xs break-words">
                        {detail}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}

      {activity.isFetchNextPageError ? (
        <ErrorLine onRetry={() => void activity.fetchNextPage()} />
      ) : null}

      {/* Stops after a failed page, or it would retry on every render. */}
      <InfiniteScrollTrigger
        hasMore={activity.hasNextPage && !activity.isFetchNextPageError}
        loading={activity.isFetchingNextPage}
        onLoadMore={() => void activity.fetchNextPage()}
      />
    </div>
  );
}

function ErrorLine({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="text-destructive text-sm">
      Couldn&apos;t load the activity.{" "}
      <button
        type="button"
        onClick={onRetry}
        className="text-foreground underline underline-offset-4"
      >
        Try again
      </button>
    </p>
  );
}
