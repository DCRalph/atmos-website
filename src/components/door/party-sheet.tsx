"use client";

import { Check, Loader2 } from "lucide-react";

import { api } from "~/trpc/react";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import { AccessBadge, SafeAction } from "~/components/door/controls";
import { isElevated } from "~/lib/ticketing/access-levels";

/**
 * The rest of an order, opened from a person.
 *
 * A group of four buys on one order and turns up as one group, so the question
 * after "is this ticket real" is "who else is on it, and are they in yet". This
 * answers both without making staff back out and search the buyer's name.
 *
 * Admitting from here goes back through the page's scan path, exactly as the
 * door list does — same duplicate check, same full-screen result — rather than
 * quietly marking somebody in from a list.
 */
export function PartySheet({
  eventId,
  ticketId,
  admitting,
  onBack,
  onAdmit,
}: {
  eventId: string;
  ticketId: string;
  admitting: boolean;
  onBack: () => void;
  onAdmit: (ticketNumber: string) => void;
}) {
  const party = api.door.orderTickets.useQuery({ eventId, ticketId });

  const rows = party.data ?? [];
  const inCount = rows.filter((row) => row.admittedAt !== null).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-neutral-900 text-white">
      <div className="flex-1 overflow-y-auto px-5 py-8">
        <p className="text-2xl font-black tracking-tight">
          Everyone on this order
        </p>
        {rows.length > 0 && (
          <p className="mt-1 text-sm tabular-nums opacity-70">
            {inCount} of {rows.length} already in
          </p>
        )}

        {party.isPending && (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin opacity-50" aria-hidden />
          </div>
        )}

        {party.isError && (
          <p className="mt-6 border-2 border-white/10 p-6 text-center text-sm opacity-60">
            Couldn&apos;t load the rest of this order.
          </p>
        )}

        {rows.length > 0 && (
          <ul className="mt-5 divide-y-2 divide-white/5 border-2 border-white/10">
            {rows.map((row) => {
              const isIn = row.admittedAt !== null;
              return (
                <li key={row.id} className="flex items-center gap-2 p-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {row.attendeeName ?? "No name given"}
                      {row.isCurrent && (
                        <span className="ml-2 border border-white/25 px-1.5 py-0.5 align-middle text-[10px] tracking-widest uppercase opacity-70">
                          This ticket
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-white/40">
                      {row.tierName} · {row.ticketNumber}
                      {row.isComp ? " · comp" : ""}
                    </span>
                    {row.invitedByName && (
                      <span className="block truncate text-xs text-white/50">
                        Invited by {row.invitedByName}
                      </span>
                    )}
                    {isElevated(row.accessLevel) && (
                      <span className="mt-1 block">
                        <AccessBadge level={row.accessLevel} size="small" />
                      </span>
                    )}

                    {/* A refusal outranks everything: it is the reason this
                        person is standing there arguing. */}
                    {row.deniedAt ? (
                      <span className="mt-0.5 block text-xs font-semibold text-red-400">
                        Refused entry {formatTimeAgo(new Date(row.deniedAt))}
                      </span>
                    ) : isIn ? (
                      <span className="mt-0.5 block text-xs text-emerald-400">
                        In {formatTimeAgo(new Date(row.admittedAt!))}
                      </span>
                    ) : !row.isValid ? (
                      <span className="mt-0.5 block text-xs font-semibold text-amber-400">
                        {row.status === "REFUNDED" ? "Refunded" : "Void"} — not
                        valid
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-xs text-white/40">
                        Not arrived
                      </span>
                    )}
                  </span>

                  {isIn ? (
                    <Check
                      className="size-5 shrink-0 text-emerald-400"
                      aria-hidden
                    />
                  ) : row.isValid ? (
                    <button
                      type="button"
                      disabled={admitting}
                      onClick={() => onAdmit(row.ticketNumber)}
                      className="shrink-0 border-2 border-white/20 px-3 py-2 text-sm font-medium transition-colors active:bg-white active:text-black disabled:opacity-50"
                    >
                      Admit
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-5 pb-8">
        <SafeAction onClick={onBack}>Back</SafeAction>
      </div>
    </div>
  );
}
