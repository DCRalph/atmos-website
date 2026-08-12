"use client";

import { History, Loader2 } from "lucide-react";

import { api } from "~/trpc/react";
import { SafeAction } from "~/components/door/controls";
import { formatEventTime, formatTimeAgo } from "~/lib/ticketing/dates";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import {
  SCAN_TONE_TEXT,
  scanResultLabel,
  scanResultTone,
} from "~/lib/ticketing/scan-results";
import type { TicketScanResult } from "~Prisma/client";

/**
 * Everything that has ever happened to one ticket.
 *
 * The single most-asked question on a door is not "is this valid" — the colour
 * of a scan answers that in a tenth of a second — it is "what happened to this
 * one", asked while somebody argues that they were never let in, or that they
 * were turned away for no reason. That answer has to be in reach from wherever
 * staff are looking at the ticket: off a scan, off the list, off the feed of
 * recent actions, off a check. So it is one component, rendered in all of them,
 * and it reads the same every time.
 */

export type TimelineEntry = {
  id: string;
  at: Date;
  result: TicketScanResult;
  /** The staff member, where one is on record. */
  by: string | null;
  device: string | null;
  reason: string | null;
  note: string | null;
  wasOverride?: boolean;
};

export function TicketTimeline({
  entries,
  timezone,
  total,
}: {
  entries: TimelineEntry[];
  /** The event's own zone — a door in Auckland reads Auckland times. */
  timezone: string;
  /** When `entries` is a slice, the real number behind it. */
  total?: number;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-white/40">
        This ticket has never been scanned.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y-2 divide-white/5 border-2 border-white/10">
        {entries.map((entry) => {
          const at = new Date(entry.at);
          return (
            <li key={entry.id} className="flex gap-3 p-3">
              <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums opacity-40">
                {formatEventTime(at, timezone)}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${SCAN_TONE_TEXT[scanResultTone(entry.result)]}`}
                >
                  {scanResultLabel(entry.result)}
                  {entry.wasOverride ? " · override" : ""}
                </span>
                <span className="block text-xs opacity-40">
                  {formatTimeAgo(at)}
                  {entry.by ? ` · ${entry.by}` : ""}
                  {entry.device ? ` · ${entry.device}` : ""}
                </span>
                {/* A NOTE row carries its whole text in the note with no reason
                    against it, so the note has to stand on its own here. */}
                {(entry.reason ?? entry.note) && (
                  <span className="mt-0.5 block text-xs opacity-80">
                    {entry.reason ? denyReasonLabel(entry.reason) : ""}
                    {entry.note
                      ? `${entry.reason ? " — " : ""}“${entry.note}”`
                      : ""}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {total !== undefined && total > entries.length && (
        <p className="mt-2 text-xs text-white/40">
          Showing the {entries.length} most recent of {total} scans.
        </p>
      )}
    </>
  );
}

/** The same list under its heading, for screens that stack sections. */
export function TicketTimelineSection({
  entries,
  timezone,
  total,
}: {
  entries: TimelineEntry[];
  timezone: string;
  total?: number;
}) {
  return (
    <div className="mt-8 border-t-2 border-white/10 pt-5">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
        <History className="size-3.5" aria-hidden />
        History
      </p>
      <div className="mt-3">
        <TicketTimeline entries={entries} timezone={timezone} total={total} />
      </div>
    </div>
  );
}

/**
 * The history on its own screen, fetched.
 *
 * For the places that are holding a scan result rather than a loaded ticket —
 * the scanner has an outcome and a ticket id, and nothing else. Opened on
 * purpose from a result, so it takes a whole screen and the only way out is
 * the harmless button at the bottom, like every other door sheet.
 */
export function TicketHistorySheet({
  eventId,
  ticketId,
  onBack,
}: {
  eventId: string;
  ticketId: string;
  onBack: () => void;
}) {
  const detail = api.door.ticketDetail.useQuery({ eventId, ticketId });
  const person = detail.data;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {detail.isPending ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin opacity-50" aria-hidden />
          </div>
        ) : !person ? (
          <p className="py-16 text-center opacity-70">
            Couldn&apos;t load that ticket.
          </p>
        ) : (
          <>
            <p className="text-2xl font-bold">
              {person.attendeeName ?? person.buyerName ?? "No name given"}
            </p>
            <p className="mt-1 font-mono text-sm opacity-60">
              {person.ticketNumber} · {person.positionInOrder}
            </p>
            <TicketTimelineSection
              entries={person.timeline}
              timezone={person.timezone}
            />
          </>
        )}
      </div>

      <div className="p-5 pb-8">
        <SafeAction onClick={onBack}>Back</SafeAction>
      </div>
    </div>
  );
}
