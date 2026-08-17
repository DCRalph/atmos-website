"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  Check,
  History,
  RotateCcw,
  X,
} from "lucide-react";

import {
  AccessBadge,
  DenialCard,
  DenyReasonPicker,
  ExceptionAction,
  SafeAction,
} from "~/components/door/controls";
import { TicketHistorySheet } from "~/components/door/ticket-timeline";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import type { DenyReasonValue } from "~/lib/ticketing/deny-reasons";
import type { RouterOutputs } from "~/trpc/react";

type ScanOutcome = RouterOutputs["door"]["scan"];

/**
 * The full-screen result.
 *
 * Colour carries the meaning at arm's length; the words are for when someone
 * looks closer. The duplicate state deliberately leads with *how long ago* the
 * ticket came through, because that is the fact door staff actually use to
 * decide whether they're looking at a mistake or a shared screenshot.
 *
 * Every screen here obeys one rule: **the bottom button is always the harmless
 * one.** Next, Cancel, Back — whatever gets you out without changing anything
 * lives full-width at the bottom, in white, in the same place every time. It is
 * the button that gets tapped a few hundred times a night without being read,
 * so it must never be the button that lets a stranger in.
 *
 * Anything that changes a decision — admitting a duplicate, refusing entry —
 * sits above that, bordered rather than filled, and takes a second tap on a
 * screen that says what is about to happen. At arm's length in the dark, "hard
 * to do by accident" matters more than "quick".
 */

const TONE = {
  admitted: { bg: "bg-emerald-600", icon: Check, label: "IN" },
  reentry: { bg: "bg-sky-600", icon: RotateCcw, label: "RE-ENTRY" },
  duplicate: {
    bg: "bg-amber-500",
    icon: AlertTriangle,
    label: "ALREADY ADMITTED",
  },
  denied: { bg: "bg-red-700", icon: Ban, label: "REFUSED" },
  previouslyDenied: { bg: "bg-red-700", icon: Ban, label: "REFUSED EARLIER" },
  rejected: { bg: "bg-red-700", icon: Ban, label: "NO ENTRY" },
} as const;

function toneFor(result: ScanOutcome["result"]): keyof typeof TONE {
  switch (result) {
    case "ADMITTED":
    case "OVERRIDE_ADMITTED":
      return "admitted";
    case "REENTRY":
      return "reentry";
    case "DUPLICATE":
      return "duplicate";
    case "DENIED":
      return "denied";
    case "PREVIOUSLY_DENIED":
      return "previouslyDenied";
    default:
      return "rejected";
  }
}

/** Results where the door still has a person in front of them to judge. */
function canDeny(outcome: ScanOutcome): boolean {
  if (!outcome.ticket) return false;
  return (
    outcome.result === "ADMITTED" ||
    outcome.result === "OVERRIDE_ADMITTED" ||
    outcome.result === "REENTRY" ||
    outcome.result === "DUPLICATE"
  );
}

type Step = "result" | "deny" | "confirm-admit" | "history";

export function ScanResultScreen({
  eventId,
  outcome,
  onDismiss,
  onOverride,
  onDeny,
  onCheckId,
  canOverride,
  overriding,
  denying,
}: {
  eventId: string;
  outcome: ScanOutcome;
  onDismiss: () => void;
  onOverride: () => void;
  onDeny: (reason: DenyReasonValue, note: string) => void;
  /** Hands the ticket to the ID tab. Absent where there is no ID panel. */
  onCheckId?: (ticketId: string, attendeeName: string | null) => void;
  /** Door managers only. */
  canOverride: boolean;
  overriding: boolean;
  denying: boolean;
}) {
  const [step, setStep] = useState<Step>("result");

  // A new scan result — including the one that comes back from denying or
  // overriding — always lands on the result screen, never on the sub-screen
  // that produced it.
  useEffect(() => {
    setStep("result");
  }, [outcome]);

  const tone = TONE[toneFor(outcome.result)];
  const Icon = tone.icon;
  const showDeny = canDeny(outcome);
  const showOverride = outcome.canOverride && canOverride;

  if (step === "deny" && outcome.ticket) {
    return (
      <DenyReasonPicker
        attendee={
          outcome.ticket.invitedByName
            ? `${outcome.ticket.attendeeName ?? outcome.ticket.buyerName ?? "This guest"} · invited by ${outcome.ticket.invitedByName}`
            : (outcome.ticket.attendeeName ?? outcome.ticket.buyerName)
        }
        pending={denying}
        onCancel={() => setStep("result")}
        onConfirm={onDeny}
      />
    );
  }

  if (step === "confirm-admit") {
    return (
      <ConfirmAdmit
        outcome={outcome}
        pending={overriding}
        onCancel={() => setStep("result")}
        onConfirm={onOverride}
      />
    );
  }

  if (step === "history" && outcome.ticket) {
    return (
      <TicketHistorySheet
        eventId={eventId}
        ticketId={outcome.ticket.id}
        onBack={() => setStep("result")}
      />
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${tone.bg} text-white`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8 text-center [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto">
        <Icon className="size-20" aria-hidden />
        <p className="mt-4 text-3xl font-black tracking-tight">{tone.label}</p>
        <p className="mt-1 text-lg opacity-90">{outcome.message}</p>

        {outcome.ticket && (
          <div className="mt-8 space-y-1">
            {outcome.ticket.attendeeName && (
              <p className="text-2xl font-bold">
                {outcome.ticket.attendeeName}
              </p>
            )}
            <p className="pt-1">
              <AccessBadge level={outcome.ticket.accessLevel} />
            </p>

            {/* On every result, admitted or not: the moment this matters most
                is the one where the scan came back wrong. */}
            {outcome.ticket.invitedByName && (
              <p className="pt-1 text-lg font-semibold">
                Invited by {outcome.ticket.invitedByName}
              </p>
            )}

            <p className="pt-1 text-lg opacity-90">{outcome.ticket.tierName}</p>
            <p className="text-sm opacity-70">
              {outcome.ticket.ticketNumber} · {outcome.ticket.positionInOrder}
              {outcome.ticket.isComp ? " · comp" : ""}
            </p>
            {!outcome.ticket.attendeeName && outcome.ticket.buyerName && (
              <p className="text-sm opacity-70">
                Bought by {outcome.ticket.buyerName}
              </p>
            )}

            {/* Without this the name above is decoration. A locked ticket is
                one where the person holding it is supposed to be the person
                named on it, and only the door can check that. */}
            {outcome.ticket.nameLocked && outcome.ticket.attendeeName && (
              <p className="mt-4 inline-flex items-center gap-2 border-2 border-white/40 bg-black/25 px-3 py-2 text-sm font-semibold">
                <BadgeCheck className="size-4 shrink-0" aria-hidden />
                Photo ID — this ticket is in the name of{" "}
                {outcome.ticket.attendeeName}
              </p>
            )}

            {/* In the body rather than the action stack at the bottom: reading
                a ticket's past changes nothing, and that stack is reserved for
                the buttons that do. It is the first thing wanted when a scan
                comes back wrong and somebody starts arguing about it. */}
            <button
              type="button"
              onClick={() => setStep("history")}
              className="mt-5 flex w-full items-center justify-center gap-2 border-2 border-white/40 bg-black/20 px-4 py-3 text-base font-semibold"
            >
              <History className="size-4" aria-hidden />
              See this ticket&apos;s history
            </button>
          </div>
        )}

        {outcome.previousDenial && (
          <div className="mt-8 flex w-full justify-center">
            <DenialCard
              heading={outcome.result === "DENIED" ? "Refused" : "Turned away"}
              reason={outcome.previousDenial.reason}
              note={outcome.previousDenial.note}
              at={new Date(outcome.previousDenial.at)}
              scannedByName={outcome.previousDenial.scannedByName}
              deviceLabel={outcome.previousDenial.deviceLabel}
            />
          </div>
        )}

        {outcome.previousAdmission && (
          <div className="mt-8 w-full max-w-sm border-2 border-black/20 bg-black/20 p-4">
            <p className="text-xl font-bold">
              {formatTimeAgo(new Date(outcome.previousAdmission.at))}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {outcome.previousAdmission.deviceLabel
                ? `Scanned on ${outcome.previousAdmission.deviceLabel}`
                : "Scanned"}
              {outcome.previousAdmission.scannedByName
                ? ` by ${outcome.previousAdmission.scannedByName}`
                : ""}
            </p>
            {outcome.previousAdmission.admissionCount > 1 && (
              <p className="mt-1 text-sm opacity-80">
                {outcome.previousAdmission.admissionCount} admissions on record
              </p>
            )}
          </div>
        )}

        {outcome.isR18 && outcome.admit && (
          <p className="mt-8 border-2 border-black/30 bg-black/30 px-4 py-2 text-lg font-bold tracking-wide">
            R18 — CHECK ID
          </p>
        )}
      </div>

      <div className="space-y-3 p-5 pb-8">
        {showOverride && (
          <ExceptionAction
            hint={
              outcome.result === "PREVIOUSLY_DENIED"
                ? "Overrides a refusal by another staff member"
                : "This ticket has already been used"
            }
            onClick={() => setStep("confirm-admit")}
          >
            Admit anyway
          </ExceptionAction>
        )}

        {showDeny && (
          <ExceptionAction
            hint="Turns this person away and blocks the ticket"
            onClick={() => setStep("deny")}
          >
            Deny entry
          </ExceptionAction>
        )}

        {/* The prompts above tell staff to check ID; this is the button that
            lets them do it without losing the ticket they are standing on.
            Offered for the two cases that ask for it — an R18 event, and a
            ticket whose name is meant to be the person holding it — because a
            button on every scan is a button nobody reads. */}
        {onCheckId &&
          outcome.ticket &&
          (outcome.isR18 || outcome.ticket.nameLocked) && (
            <button
              type="button"
              onClick={() => {
                const ticket = outcome.ticket;
                if (ticket) onCheckId(ticket.id, ticket.attendeeName);
              }}
              className="flex h-12 w-full items-center justify-center gap-2 border-2 border-white/35 text-sm font-black tracking-wide uppercase"
            >
              <BadgeCheck className="size-4" aria-hidden />
              Check their ID
            </button>
          )}

        <SafeAction onClick={onDismiss}>
          <X className="size-5" aria-hidden />
          Next
        </SafeAction>
      </div>
    </div>
  );
}

/**
 * The second tap on "Admit anyway".
 *
 * It restates what the scan already found, because the manager tapping this is
 * overruling it — either a ticket that has been through the door once already
 * or somebody another staff member turned away, and in the second case they
 * deserve to see that person's reason before they undo it.
 */
function ConfirmAdmit({
  outcome,
  pending,
  onCancel,
  onConfirm,
}: {
  outcome: ScanOutcome;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const refused = outcome.result === "PREVIOUSLY_DENIED";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-amber-600 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8 text-center [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto">
        <AlertTriangle className="size-16" aria-hidden />
        <p className="mt-4 text-3xl font-black tracking-tight">Admit anyway?</p>

        <p className="mt-3 max-w-sm text-base opacity-90">
          {refused
            ? "Another staff member turned this person away. Letting them in now overrides that."
            : "This ticket has already been used to get in. If it's been shared, you're letting in a second person on one ticket."}
        </p>

        {outcome.ticket && (
          <>
            <p className="mt-6 text-lg font-bold">
              {outcome.ticket.attendeeName ??
                outcome.ticket.buyerName ??
                outcome.ticket.ticketNumber}
            </p>
            {outcome.ticket.invitedByName && (
              <p className="mt-1 text-base opacity-80">
                Invited by {outcome.ticket.invitedByName}
              </p>
            )}
          </>
        )}

        {outcome.previousDenial && (
          <div className="mt-6 flex w-full justify-center">
            <DenialCard
              heading="Refused"
              reason={outcome.previousDenial.reason}
              note={outcome.previousDenial.note}
              at={new Date(outcome.previousDenial.at)}
              scannedByName={outcome.previousDenial.scannedByName}
              deviceLabel={outcome.previousDenial.deviceLabel}
            />
          </div>
        )}

        {outcome.previousAdmission && (
          <div className="mt-6 w-full max-w-sm border-2 border-black/20 bg-black/20 p-4">
            <p className="text-lg font-bold">
              Admitted {formatTimeAgo(new Date(outcome.previousAdmission.at))}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {outcome.previousAdmission.scannedByName
                ? `by ${outcome.previousAdmission.scannedByName}`
                : "by an unknown scanner"}
              {outcome.previousAdmission.deviceLabel
                ? ` on ${outcome.previousAdmission.deviceLabel}`
                : ""}
            </p>
          </div>
        )}

        <p className="mt-6 text-sm opacity-80">
          This is recorded against your name.
        </p>
      </div>

      <div className="space-y-3 p-5 pb-8">
        <ExceptionAction onClick={onConfirm} disabled={pending}>
          {pending ? "Admitting…" : "Yes, let them in"}
        </ExceptionAction>
        <SafeAction onClick={onCancel} disabled={pending}>
          Cancel
        </SafeAction>
      </div>
    </div>
  );
}
