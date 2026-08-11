"use client";

import Link from "next/link";
import { ChevronRight, ScanLine } from "lucide-react";

import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";

/** Pick a door. Only shows events this person is actually assigned to. */
export default function DoorEventPicker() {
  const events = api.door.myEvents.useQuery();

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10">
      <div className="flex items-center gap-2.5">
        <ScanLine className="size-5 text-white/50" aria-hidden />
        <h1 className="text-sm font-semibold tracking-[0.2em] text-white/60 uppercase">
          Door scanner
        </h1>
      </div>

      <div className="mt-8 space-y-3">
        {events.isPending && (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        )}

        {events.data?.length === 0 && (
          <p className="border-2 border-white/10 p-8 text-center text-white/50">
            You&apos;re not on the door for anything right now. An admin needs
            to add you to an event.
          </p>
        )}

        {events.data?.map((event) => (
          <Link
            key={event.id}
            href={`/door/${event.id}`}
            className="flex items-center gap-4 border-2 border-white/15 bg-white/5 p-5 transition-colors active:bg-white/10"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/50">
                {formatEventDate(event.startsAt, event.timezone)} ·{" "}
                {formatEventTime(
                  event.doorsAt ?? event.startsAt,
                  event.timezone,
                )}
              </p>
              <p className="mt-0.5 truncate text-xl font-semibold">
                {event.name}
              </p>
              {event.venueName && (
                <p className="truncate text-sm text-white/40">
                  {event.venueName}
                </p>
              )}
            </div>
            <ChevronRight className="size-6 shrink-0 text-white/30" aria-hidden />
          </Link>
        ))}
      </div>
    </main>
  );
}
