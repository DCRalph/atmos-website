"use client";

import { useEffect, useState } from "react";
import { Loader2, SearchX } from "lucide-react";

import { api } from "~/trpc/react";
import { CameraScanner } from "~/components/door/camera-scanner";
import { CheckResultScreen } from "~/components/door/check-result";
import { ManualEntryPanel } from "~/components/door/ticket-number-entry";
import { SafeAction } from "~/components/door/controls";
import { playFeedback } from "~/components/door/feedback";

type Lookup =
  | { kind: "token"; token: string }
  | { kind: "ticketNumber"; ticketNumber: string };

/**
 * Checking a ticket without using it.
 *
 * The door's other tabs all end in a decision. This one deliberately doesn't:
 * it is for the moment when somebody is arguing that they were never let in,
 * or a manager wants to know what happened to a ticket before anybody acts.
 * Scanning to find out is not an option — the scan itself would admit them, or
 * burn the ticket as a duplicate, on the way to the answer.
 *
 * Camera and typed number both land in the same place, because the two reasons
 * to open this tab are a code somebody is holding up and a number read off a
 * printout.
 */
export function CheckPanel({
  eventId,
  timezone,
}: {
  eventId: string;
  timezone: string;
}) {
  const [lookup, setLookup] = useState<Lookup | null>(null);

  const check = api.door.checkTicket.useQuery(
    { eventId, lookup: lookup! },
    { enabled: lookup !== null, retry: false },
  );

  const verdict = check.data?.verdict;
  useEffect(() => {
    if (!verdict) return;
    playFeedback(
      verdict === "OK"
        ? "success"
        : verdict === "ALREADY_IN"
          ? "warn"
          : "error",
    );
  }, [verdict]);

  const waiting = lookup !== null && !check.data && !check.isError;

  return (
    <>
      <div className="space-y-4">
        <p className="border-2 border-white/10 bg-white/5 p-3 text-sm text-white/60">
          Looks up a ticket and shows everything that&apos;s happened to it.
          Nobody is admitted and nothing is recorded.
        </p>

        <CameraScanner
          onScan={(token) => setLookup({ kind: "token", token })}
          paused={lookup !== null}
        />

        <ManualEntryPanel
          pending={waiting}
          submitLabel="Look it up"
          pendingLabel="Looking…"
          onSubmit={(ticketNumber) =>
            setLookup({ kind: "ticketNumber", ticketNumber })
          }
        />
      </div>

      {waiting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-900/95 text-white">
          <p className="flex flex-col items-center gap-3 text-sm opacity-60">
            <Loader2 className="size-8 animate-spin" aria-hidden />
            Looking it up…
          </p>
        </div>
      )}

      {/* A lookup that fails outright — offline, or somebody's shift ended
          mid-queue. Its own screen rather than a toast, so the camera stays
          paused until it has been read and dismissed. */}
      {check.isError && lookup !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900 text-white">
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <SearchX className="size-16 opacity-50" aria-hidden />
            <p className="mt-4 text-2xl font-black tracking-tight">
              Couldn&apos;t check that
            </p>
            <p className="mt-2 max-w-sm text-sm opacity-70">
              {check.error.message}
            </p>
          </div>
          <div className="p-5 pb-8">
            <SafeAction onClick={() => setLookup(null)}>Back</SafeAction>
          </div>
        </div>
      )}

      {check.data && (
        <CheckResultScreen
          check={check.data}
          timezone={timezone}
          onDismiss={() => setLookup(null)}
        />
      )}
    </>
  );
}
