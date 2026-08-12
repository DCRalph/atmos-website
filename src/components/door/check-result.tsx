"use client";

import { AlertTriangle, Ban, Check, Info } from "lucide-react";

import {
  AccessBadge,
  DenialCard,
  SafeAction,
} from "~/components/door/controls";
import { TicketTimelineSection } from "~/components/door/ticket-timeline";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import type { RouterOutputs } from "~/trpc/react";

type TicketCheck = RouterOutputs["door"]["checkTicket"];

/**
 * The answer to "is this ticket real", read out in full.
 *
 * Deliberately *not* painted head to toe in the result colour the way a scan
 * is. A green screen across a queue means "that one's in", and this screen
 * admitted nobody — somebody glancing over a shoulder must not read it as an
 * admission. So the colour is confined to one block, and the line above it
 * says what this screen is, every time.
 *
 * Where a scan answers one question in two words, a check is opened by someone
 * who has time and an argument in front of them, so this leads with the verdict
 * and then keeps going: who the ticket belongs to, whether anyone has ever
 * knocked them back, and every scan on record with who took it and where.
 */

const TONE = {
  OK: {
    icon: Check,
    box: "border-emerald-500/50 bg-emerald-500/10",
    text: "text-emerald-300",
  },
  ALREADY_IN: {
    icon: AlertTriangle,
    box: "border-amber-500/50 bg-amber-500/10",
    text: "text-amber-300",
  },
  REFUSED: {
    icon: Ban,
    box: "border-red-500/50 bg-red-500/10",
    text: "text-red-300",
  },
  NOT_VALID: {
    icon: Ban,
    box: "border-red-500/50 bg-red-500/10",
    text: "text-red-300",
  },
} as const;

export function CheckResultScreen({
  check,
  timezone,
  onDismiss,
}: {
  check: TicketCheck;
  /** The event's own zone — a door in Auckland reads Auckland times. */
  timezone: string;
  onDismiss: () => void;
}) {
  const tone = TONE[check.verdict];
  const Icon = tone.icon;
  const ticket = check.ticket;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900 text-white">
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
          Ticket check · nothing recorded
        </p>

        <div className={`mt-3 border-2 p-4 ${tone.box}`}>
          <p className={`flex items-center gap-2.5 ${tone.text}`}>
            <Icon className="size-7 shrink-0" aria-hidden />
            <span className="text-3xl font-black tracking-tight">
              {check.headline}
            </span>
          </p>
          <p className="mt-2 text-sm opacity-90">{check.detail}</p>
        </div>

        {ticket && (
          <>
            <div className="mt-6">
              <p className="text-2xl font-bold">
                {ticket.attendeeName ?? ticket.buyerName ?? "No name given"}
              </p>
              <p className="mt-2">
                <AccessBadge level={ticket.accessLevel} />
              </p>
              {ticket.invitedByName && (
                <p className="mt-2 text-lg font-semibold">
                  Invited by {ticket.invitedByName}
                </p>
              )}
              <p className="mt-2 opacity-80">{ticket.tierName}</p>
              <p className="mt-1 font-mono text-sm opacity-60">
                {ticket.ticketNumber} · {ticket.positionInOrder}
                {ticket.isComp ? " · comp" : ""}
              </p>

              {ticket.nameLocked && ticket.attendeeName && (
                <p className="mt-4 inline-flex items-center gap-2 border-2 border-white/30 px-3 py-2 text-sm font-semibold">
                  Photo ID — this ticket is in the name of {ticket.attendeeName}
                </p>
              )}
            </div>

            <dl className="mt-6 space-y-2 border-t-2 border-white/10 pt-5 text-sm">
              <Row label="Order" value={ticket.orderNumber} />
              {ticket.buyerName && (
                <Row label="Bought by" value={ticket.buyerName} />
              )}
              {ticket.buyerEmail && (
                <Row label="Email" value={ticket.buyerEmail} />
              )}
              <Row
                label="Paid by"
                value={
                  ticket.isComp ? "Comp" : paymentLabel(ticket.paymentMethod)
                }
              />
              <Row
                label="Re-entry"
                value={check.reentryAllowed ? "Allowed" : "No"}
              />
            </dl>
          </>
        )}

        {/* The standing refusal first, because it is the one that decides what
            happens next; the count below it answers the different question of
            whether this person has ever been knocked back at all. */}
        {check.denial && (
          <div className="mt-6">
            <DenialCard
              heading="Refused entry"
              reason={check.denial.reason}
              note={check.denial.note}
              at={new Date(check.denial.at)}
              scannedByName={check.denial.scannedByName}
              deviceLabel={check.denial.deviceLabel}
            />
          </div>
        )}

        {check.refusalCount > 0 && !check.denial && (
          <p className="mt-6 flex items-start gap-2 border-2 border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Refused {countLabel(check.refusalCount, "time", "times")} earlier.
              That no longer stands — it was taken back, or they were admitted
              afterwards. The history below has who did what.
            </span>
          </p>
        )}

        {check.found && (
          <div className="mt-6">
            {check.admittedAt ? (
              <div className="border-2 border-emerald-500/40 bg-emerald-500/10 p-4">
                <p className="text-xl font-bold text-emerald-200">
                  In {formatTimeAgo(new Date(check.admittedAt))}
                </p>
                <p className="mt-1 text-sm opacity-80">
                  {check.admittedBy
                    ? `by ${check.admittedBy}`
                    : "by an unknown scanner"}
                  {check.admittedDevice ? ` on ${check.admittedDevice}` : ""}
                </p>
                {check.admissionCount > 1 && (
                  <p className="mt-1 text-sm opacity-80">
                    {check.admissionCount} admissions on record
                  </p>
                )}
              </div>
            ) : check.departedAt ? (
              <div className="border-2 border-sky-500/40 bg-sky-500/10 p-4">
                <p className="text-xl font-bold text-sky-200">
                  Left {formatTimeAgo(new Date(check.departedAt))}
                </p>
                <p className="mt-1 text-sm opacity-80">
                  {check.departedBy
                    ? `marked out by ${check.departedBy}`
                    : "marked out"}
                  {check.admissionCount > 1
                    ? ` · ${check.admissionCount} admissions on record`
                    : ""}
                </p>
              </div>
            ) : (
              <div className="border-2 border-white/15 bg-white/5 p-4">
                <p className="text-xl font-bold">Not arrived</p>
                <p className="mt-1 text-sm opacity-70">
                  Nobody has come in on this ticket.
                </p>
              </div>
            )}
          </div>
        )}

        {check.isR18 && (
          <p className="mt-6 inline-block border-2 border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-bold text-red-200">
            R18 — CHECK ID
          </p>
        )}

        <TicketTimelineSection
          entries={check.history.map((entry) => ({
            id: entry.id,
            at: entry.at,
            result: entry.result,
            by: entry.scannedByName,
            device: entry.deviceLabel,
            reason: entry.denyReason,
            note: entry.denyNote,
            wasOverride: entry.wasOverride,
          }))}
          timezone={timezone}
          total={check.scanCount}
        />

        {check.verdict === "OK" && (
          <p className="mt-6 text-sm text-white/40">
            Nothing here let them in. Use the Scan tab when they&apos;re ready
            to come through.
          </p>
        )}
      </div>

      <div className="p-5 pb-8">
        <SafeAction onClick={onDismiss}>Check another</SafeAction>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 opacity-50">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function paymentLabel(method: string): string {
  switch (method) {
    case "CASH":
      return "Cash at the door";
    case "TERMINAL":
      return "Card at the door";
    case "TAP_TO_PAY":
      return "Tap to pay at the door";
    case "COMP":
      return "Comp";
    case "FREE":
      return "Free ticket";
    default:
      return "Online";
  }
}
