"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";

import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { formatTimeAgo } from "~/lib/ticketing/dates";

/**
 * The door list.
 *
 * For the person who arrives with a dead phone, or a name on the guest list
 * and nothing else. Searching by name, email or order number and admitting
 * from here runs the same scan path, so the duplicate check still applies.
 */
export function DoorList({ eventId }: { eventId: string }) {
  const [search, setSearch] = useState("");
  const [onlyNotArrived, setOnlyNotArrived] = useState(false);

  const list = api.door.doorList.useQuery(
    { eventId, search, onlyNotArrived },
    { enabled: !!eventId },
  );

  const utils = api.useUtils();
  const admit = api.door.admitByTicketNumber.useMutation({
    onSuccess: () => {
      void utils.door.doorList.invalidate();
      void utils.door.summary.invalidate();
    },
  });

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

      <label className="flex items-center gap-2 text-sm text-white/60">
        <input
          type="checkbox"
          checked={onlyNotArrived}
          onChange={(e) => setOnlyNotArrived(e.target.checked)}
          className="size-4 accent-white"
        />
        Only show people who haven&apos;t arrived
      </label>

      {list.isPending && <Skeleton className="h-40 w-full" />}

      {list.data?.length === 0 && (
        <p className="border-2 border-white/10 p-6 text-center text-sm text-white/40">
          {search ? "Nobody matches that." : "No tickets sold yet."}
        </p>
      )}

      <ul className="divide-y-2 divide-white/5 border-2 border-white/10">
        {list.data?.map((row) => (
          <li key={row.id} className="flex items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {row.attendeeName ?? row.buyerName ?? "No name given"}
              </p>
              <p className="truncate text-xs text-white/40">
                {row.tierName} · {row.ticketNumber}
              </p>
              {row.admittedAt && (
                <p className="mt-0.5 text-xs text-emerald-400">
                  In {formatTimeAgo(new Date(row.admittedAt))}
                  {row.admittedDevice ? ` · ${row.admittedDevice}` : ""}
                </p>
              )}
            </div>

            {row.admittedAt ? (
              <Check className="size-5 shrink-0 text-emerald-400" aria-hidden />
            ) : (
              <button
                type="button"
                disabled={admit.isPending}
                onClick={() =>
                  admit.mutate({ eventId, ticketNumber: row.ticketNumber })
                }
                className="shrink-0 border-2 border-white/20 px-3 py-2 text-sm font-medium transition-colors active:bg-white active:text-black disabled:opacity-50"
              >
                Admit
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
