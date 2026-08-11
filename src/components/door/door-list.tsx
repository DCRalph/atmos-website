"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Loader2, Search } from "lucide-react";

import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import type { DenyReasonValue } from "~/lib/ticketing/deny-reasons";
import { PersonSheet } from "~/components/door/person-sheet";

/**
 * The door list.
 *
 * Everyone holding a ticket, searchable, admittable — for the person who
 * arrives with a dead phone, or a name on the guest list and nothing else.
 * With the search box empty this is the whole list, paged rather than cut off
 * at an arbitrary number, because "who's coming tonight" is a question staff
 * ask as often as "is this ticket real".
 *
 * Admitting is handed back to the page rather than done here, so it runs the
 * identical path as a scan — same duplicate check, same full-screen result,
 * same deny and override controls. A silent "Admit" that gives no answer is
 * how somebody walks in on a ticket that was already used.
 */
export function DoorList({
  eventId,
  admitting,
  denying,
  onAdmit,
  onDeny,
}: {
  eventId: string;
  admitting: boolean;
  denying: boolean;
  onAdmit: (ticketNumber: string) => void;
  onDeny: (ticketId: string, reason: DenyReasonValue, note: string) => void;
}) {
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [onlyNotArrived, setOnlyNotArrived] = useState(false);

  // A door list can be several hundred rows; re-querying on every keystroke of
  // a name typed at arm's length is a lot of round trips for no benefit.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const list = api.door.doorList.useInfiniteQuery(
    { eventId, search: debounced, onlyNotArrived },
    {
      enabled: !!eventId,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    },
  );

  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/30"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or order number"
          className="h-12 bg-white/5 pl-9"
          autoComplete="off"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-white/60">
          <input
            type="checkbox"
            checked={onlyNotArrived}
            onChange={(e) => setOnlyNotArrived(e.target.checked)}
            className="size-4 accent-white"
          />
          Not arrived only
        </label>

        {!list.isPending && (
          <p className="shrink-0 text-sm text-white/40 tabular-nums">
            {rows.length < total
              ? `${rows.length} of ${total}`
              : `${total} ${total === 1 ? "ticket" : "tickets"}`}
          </p>
        )}
      </div>

      {list.isPending && <Skeleton className="h-40 w-full" />}

      {!list.isPending && rows.length === 0 && (
        <p className="border-2 border-white/10 p-6 text-center text-sm text-white/40">
          {debounced
            ? "Nobody matches that."
            : onlyNotArrived
              ? "Everyone with a ticket is already in."
              : "No tickets sold yet."}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="divide-y-2 divide-white/5 border-2 border-white/10">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 p-3.5">
              {/* The row opens the person; the button on the right is the
                  fast path for the common case. */}
              <button
                type="button"
                onClick={() => setOpenTicketId(row.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {row.attendeeName ?? row.buyerName ?? "No name given"}
                  </span>
                  <span className="block truncate text-xs text-white/40">
                    {row.tierName} · {row.ticketNumber}
                  </span>
                  {row.admittedAt && (
                    <span className="mt-0.5 block text-xs text-emerald-400">
                      In {formatTimeAgo(new Date(row.admittedAt))}
                      {row.admittedDevice ? ` · ${row.admittedDevice}` : ""}
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-white/25"
                  aria-hidden
                />
              </button>

              {row.admittedAt ? (
                <Check
                  className="size-5 shrink-0 text-emerald-400"
                  aria-hidden
                />
              ) : (
                <button
                  type="button"
                  disabled={admitting}
                  onClick={() => onAdmit(row.ticketNumber)}
                  className="shrink-0 border-2 border-white/20 px-3 py-2 text-sm font-medium transition-colors active:bg-white active:text-black disabled:opacity-50"
                >
                  Admit
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {list.hasNextPage && (
        <button
          type="button"
          onClick={() => void list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
          className="flex h-12 w-full items-center justify-center gap-2 border-2 border-white/15 text-sm font-medium text-white/70 disabled:opacity-50"
        >
          {list.isFetchingNextPage ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading…
            </>
          ) : (
            `Show more (${total - rows.length} to go)`
          )}
        </button>
      )}

      {openTicketId && (
        <PersonSheet
          eventId={eventId}
          ticketId={openTicketId}
          denying={denying}
          onClose={() => setOpenTicketId(null)}
          onAdmit={(ticketNumber) => {
            setOpenTicketId(null);
            onAdmit(ticketNumber);
          }}
          onDeny={(ticketId, reason, note) => {
            setOpenTicketId(null);
            onDeny(ticketId, reason, note);
          }}
        />
      )}
    </div>
  );
}
