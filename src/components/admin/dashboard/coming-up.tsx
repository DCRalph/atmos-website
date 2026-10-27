"use client";

import { useRef } from "react";
import Link from "next/link";
import { Check, CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "~/lib/utils";
import { COMING_UP_DAYS } from "~/lib/dashboard";
import { addDays, dayKey, nzDate, startOfWeek } from "~/lib/tasks/time";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";
import { formatNZDCompact, formatNZDWhole } from "~/lib/ticketing/money";
import { Bar, formatGap, Panel, type Overview } from "./parts";

type Item = Overview["comingUp"][number];

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Whether an item has something wrong with it, for the calendar's dots. */
function hasProblem(item: Item) {
  if (item.kind === "night")
    return item.checks.some((check) => check.state !== "ok");
  if (item.kind === "sales-open") return item.isDraft;
  return false;
}

/**
 * The next month: a calendar with a dot on every day something happens, and
 * the agenda for those days underneath. Picking a day scrolls the agenda to it.
 */
export function ComingUp({
  items,
  now,
  className,
}: {
  items: Overview["comingUp"];
  now: Date;
  className?: string;
}) {
  const agenda = useRef<HTMLDivElement>(null);
  const today = dayKey(now);
  const last = addDays(today, COMING_UP_DAYS);

  const byDay = new Map<string, Item[]>();
  for (const item of items) {
    const key = dayKey(item.at);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }
  const nights = items.filter((item) => item.kind === "night").length;

  const first = startOfWeek(today);
  const weeks = Math.ceil((COMING_UP_DAYS + 1 + daysBetween(first, today)) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));

  // Scrolls only the agenda's own scroller: the panel body on desktop, the
  // page on a phone. `scrollIntoView` would also scroll the admin shell, which
  // is overflow hidden, and push the header off the top of the window.
  const jumpTo = (day: string) => {
    const target = agenda.current?.querySelector<HTMLElement>(
      `[data-day="${day}"]`,
    );
    const scroller = target && scrollParent(target);
    if (!target || !scroller) return;
    // On a phone the page header sticks to the top of the same scroller.
    const sticky = [...scroller.children].find(
      (child) => getComputedStyle(child).position === "sticky",
    );
    scroller.scrollTo({
      top:
        scroller.scrollTop +
        target.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        (sticky?.getBoundingClientRect().height ?? 0) -
        8,
      behavior: "smooth",
    });
  };

  return (
    <Panel
      className={className}
      title="Coming up"
      aside={
        <span className="text-muted-foreground text-xs">
          to {formatEventDate(nzDate(last, 12))}
        </span>
      }
      above={
        <div className="shrink-0 border-b px-3.5 py-3">
          <p className="text-muted-foreground mb-1.5 flex justify-between text-xs">
            <span>
              {nights === 1 ? "1 night" : `${nights} nights`} ·{" "}
              {items.length - nights} other dates
            </span>
          </p>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs tabular-nums">
            {WEEKDAYS.map((day, i) => (
              <span
                key={i}
                className="text-muted-foreground py-0.5 text-[11px]"
              >
                {day}
              </span>
            ))}
            {days.map((day) => {
              const dayItems = byDay.get(day) ?? [];
              const inRange = day >= today && day <= last;
              const gig = dayItems.some((item) => item.kind === "night");
              const problem = dayItems.some(hasProblem);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={dayItems.length === 0}
                  onClick={() => jumpTo(day)}
                  aria-label={`${formatEventDate(nzDate(day, 12))}, ${dayItems.length === 1 ? "1 thing" : `${dayItems.length} things`}`}
                  className={cn(
                    "relative flex h-8 flex-col items-center justify-center rounded-md",
                    !inRange && "text-muted-foreground/40",
                    inRange && "text-foreground/85",
                    gig && "text-foreground font-semibold",
                    day === today &&
                      "bg-muted text-admin-accent-text font-semibold shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]",
                    dayItems.length > 0 && "hover:bg-muted",
                  )}
                >
                  {Number(day.slice(8))}
                  {dayItems.length > 0 ? (
                    <span
                      className={cn(
                        "absolute bottom-1 size-1 rounded-full",
                        problem
                          ? "bg-amber-400"
                          : gig
                            ? "bg-admin-accent"
                            : "bg-muted-foreground",
                      )}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      }
    >
      <div ref={agenda}>
        {items.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Nothing in the next month.
          </p>
        ) : null}
        {[...byDay.entries()].map(([day, dayItems]) => (
          <div
            key={day}
            data-day={day}
            className="scroll-mt-2 border-t pt-2.5 pb-1 first:border-t-0"
          >
            <h3
              className={cn(
                "text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase",
                dayItems.some((item) => item.kind === "night") &&
                  "text-foreground",
              )}
            >
              {formatEventDate(dayItems[0]!.at)}
            </h3>
            <ul>
              {dayItems.map((item) => (
                <AgendaItem key={item.key} item={item} now={now} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** The nearest ancestor that actually scrolls. */
function scrollParent(element: HTMLElement) {
  let node = element.parentElement;
  while (node && !/auto|scroll/.test(getComputedStyle(node).overflowY)) {
    node = node.parentElement;
  }
  return node;
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() -
      new Date(`${from}T12:00:00Z`).getTime()) /
      86_400_000,
  );
}

function AgendaItem({ item, now }: { item: Item; now: Date }) {
  return (
    <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <time className="text-muted-foreground pt-px text-xs tabular-nums">
        {formatEventTime(item.at)}
      </time>
      <div className="min-w-0">
        <ItemBody item={item} now={now} />
      </div>
    </li>
  );
}

function ItemBody({ item, now }: { item: Item; now: Date }) {
  const sub = "text-muted-foreground block text-xs";
  switch (item.kind) {
    case "night": {
      const href = item.gigId
        ? `/admin/gigs/${item.gigId}`
        : `/admin/events/${item.eventId}`;
      const problems = item.checks.filter((check) => check.state !== "ok");
      const fine = item.checks.filter((check) => check.state === "ok");
      return (
        <>
          <Link href={href} className="font-semibold hover:underline">
            {item.title}
          </Link>
          <span className={sub}>
            {[
              item.venue,
              item.isAffiliated ? "affiliated" : null,
              item.tbaUntil
                ? `TBA until ${formatEventDate(item.tbaUntil)}`
                : null,
              `in ${formatGap(item.at.getTime() - now.getTime())}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {item.sales ? (
            <span className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 text-xs">
              <Bar
                value={
                  item.sales.capacity
                    ? item.sales.sold / item.sales.capacity
                    : 0
                }
              />
              <span className="tabular-nums">
                {item.sales.sold}/{item.sales.capacity} sold
              </span>
            </span>
          ) : null}
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {problems.map((check) => (
              <li
                key={check.label}
                className={cn(
                  "flex items-center gap-1",
                  check.state === "bad" ? "text-red-300" : "text-amber-200",
                )}
              >
                {check.state === "bad" ? (
                  <CircleAlert
                    className="text-destructive size-3.5"
                    aria-hidden
                  />
                ) : (
                  <TriangleAlert
                    className="size-3.5 text-amber-400"
                    aria-hidden
                  />
                )}
                {check.label}
              </li>
            ))}
            {fine.map((check) => (
              <li
                key={check.label}
                className="text-muted-foreground flex items-center gap-1"
              >
                <Check className="size-3.5 text-emerald-400" aria-hidden />
                {check.label}
              </li>
            ))}
          </ul>
          {item.tasks.open > 0 ? (
            <span className={cn(sub, "mt-1")}>
              {item.tasks.open} open {item.tasks.open === 1 ? "task" : "tasks"}
              {item.tasks.atRisk > 0 ? (
                <span className="text-amber-400">
                  {" "}
                  · {item.tasks.atRisk} at risk
                </span>
              ) : null}
              {item.tasks.overdue > 0 ? (
                <span className="text-destructive">
                  {" "}
                  · {item.tasks.overdue} overdue
                </span>
              ) : null}
            </span>
          ) : null}
        </>
      );
    }
    case "announce":
      return (
        <>
          <Link
            href={`/admin/gigs/${item.gigId}`}
            className="font-medium hover:underline"
          >
            {item.title} announces
          </Link>
          <span className={sub}>
            TBA lifts, the poster and line-up go public
          </span>
        </>
      );
    case "sales-open":
      return (
        <>
          <Link
            href={`/admin/events/${item.eventId}`}
            className="font-medium hover:underline"
          >
            Sales open · {item.title}
          </Link>
          {item.isDraft ? (
            <span className="block text-xs text-amber-400">
              Event is still a draft
            </span>
          ) : null}
        </>
      );
    case "tier":
      return (
        <>
          <Link
            href={`/admin/events/${item.eventId}?section=tiers`}
            className="font-medium hover:underline"
          >
            {item.title} opens
          </Link>
          <span className={sub}>
            {item.eventName} · {item.allocation} at{" "}
            {formatNZDCompact(item.priceCents)}
          </span>
        </>
      );
    case "campaign":
      return (
        <>
          <Link href="/admin/campaigns" className="font-medium hover:underline">
            {item.title} {item.edge === "start" ? "starts" : "ends"}
          </Link>
          <span className={sub}>
            {[
              item.eventName,
              item.spendCents > 0
                ? `${formatNZDWhole(item.spendCents)} spend`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Campaign"}
          </span>
        </>
      );
    case "rental":
      return (
        <>
          <Link href="/admin/rentals" className="font-medium hover:underline">
            {item.title} {item.edge === "out" ? "goes out" : "comes back"}
          </Link>
          <span className={sub}>
            {item.userName}
            {item.edge === "out"
              ? ` · back ${formatEventDate(item.backAt)}`
              : null}
          </span>
        </>
      );
  }
}
