import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { formatEventTime } from "~/lib/ticketing/dates";
import { formatNZDWhole } from "~/lib/ticketing/money";
import { Bar, formatGap, type Overview } from "./parts";

type LiveNight = Overview["live"][number];

/**
 * What's on right now, across the top of the dashboard. Only drawn while a
 * night is live: the door, the stage and the room at a glance, with the live
 * screen one click away for the detail.
 */
export function LiveBand({ night, now }: { night: LiveNight; now: Date }) {
  const { door, stage, chat } = night;
  const current = stage?.current ?? null;
  const next = stage?.next ?? null;
  const room = door ? door.capacity || door.sold : 0;

  return (
    <section
      aria-label={`On now: ${night.title}`}
      className="border-admin-accent/30 from-admin-accent/[0.06] grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-linear-to-r to-transparent to-55% px-4 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_minmax(0,1.4fr)_minmax(0,1.3fr)_auto] lg:items-center"
    >
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <p className="text-admin-accent-text flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
          <span className="bg-admin-accent size-2 rounded-full shadow-[0_0_8px_var(--admin-accent)]" />
          On now
        </p>
        <p className="truncate font-semibold">{night.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {[night.venue, `since ${formatEventTime(night.startsAt)}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {door ? (
        <>
          <Stat label="Inside">
            {door.inside}{" "}
            <span className="text-muted-foreground text-xs font-normal">
              of {room}
            </span>
            {room > 0 ? (
              <Bar value={door.inside / room} className="mt-1.5" />
            ) : null}
          </Stat>
          <Stat label="Door">
            {door.doorTickets}{" "}
            <span className="text-muted-foreground text-xs font-normal">
              {formatNZDWhole(door.doorCents)}
            </span>
          </Stat>
        </>
      ) : null}

      {current || next ? (
        <Stat label={current ? "On stage" : "Up next"} wide>
          <span className="block truncate">{(current ?? next)?.name}</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {current
              ? [
                  `till ${formatEventTime(current.endsAt)}`,
                  next
                    ? `${next.name} next, in ${formatGap(next.startsAt.getTime() - now.getTime())}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : next
                ? `at ${formatEventTime(next.startsAt)}, in ${formatGap(next.startsAt.getTime() - now.getTime())}`
                : null}
          </span>
          {current ? (
            <Bar
              className="mt-1.5 h-1"
              value={
                (now.getTime() - current.startsAt.getTime()) /
                Math.max(
                  1,
                  current.endsAt.getTime() - current.startsAt.getTime(),
                )
              }
            />
          ) : null}
        </Stat>
      ) : null}

      {chat ? (
        <Stat label="Gig chat" wide>
          <Link
            href={`/admin/gigs/${night.gigId}`}
            className={
              chat.unread > 0 ? "text-admin-accent-text" : "text-foreground"
            }
          >
            {chat.unread > 0 ? `${chat.unread} new` : "All read"}
          </Link>
          {chat.last ? (
            <span className="text-muted-foreground block truncate text-xs font-normal">
              {chat.last.author}: {chat.last.body}
            </span>
          ) : null}
        </Stat>
      ) : null}

      {night.eventId ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="col-span-2 justify-self-start lg:col-span-1 lg:justify-self-end"
        >
          <Link href={`/admin/events/${night.eventId}/live`}>
            Live screen
            <ArrowUpRight />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

/** A labelled figure. `wide` takes the whole row on a phone. */
function Stat({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2 lg:col-span-1")}>
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </p>
      <div className="font-semibold tabular-nums">{children}</div>
    </div>
  );
}
