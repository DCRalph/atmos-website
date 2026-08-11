"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Ban, Check, RotateCcw, X } from "lucide-react";

import {
  AccessBadge,
  DenialCard,
  DenyReasonPicker,
  ExceptionAction,
  SafeAction,
} from "~/components/door/controls";
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

type Step = "result" | "deny" | "confirm-admit";

export function ScanResultScreen({
  outcome,
  onDismiss,
  onOverride,
  onDeny,
  canOverride,
  overriding,
  denying,
}: {
  outcome: ScanOutcome;
  onDismiss: () => void;
  onOverride: () => void;
  onDeny: (reason: DenyReasonValue, note: string) => void;
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
        attendee={outcome.ticket.attendeeName ?? outcome.ticket.buyerName}
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

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${tone.bg} text-white`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
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
            <p className="pt-1 text-lg opacity-90">{outcome.ticket.tierName}</p>
            <p className="text-sm opacity-70">
              {outcome.ticket.ticketNumber} · {outcome.ticket.positionInOrder}
            </p>
            {!outcome.ticket.attendeeName && outcome.ticket.buyerName && (
              <p className="text-sm opacity-70">
                Bought by {outcome.ticket.buyerName}
              </p>
            )}
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
    <div className="fixed inset-0 z-50 flex flex-col bg-amber-600 text-white">
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
        <AlertTriangle className="size-16" aria-hidden />
        <p className="mt-4 text-3xl font-black tracking-tight">Admit anyway?</p>

        <p className="mt-3 max-w-sm text-base opacity-90">
          {refused
            ? "Another staff member turned this person away. Letting them in now overrides that."
            : "This ticket has already been used to get in. If it's been shared, you're letting in a second person on one ticket."}
        </p>

        {outcome.ticket && (
          <p className="mt-6 text-lg font-bold">
            {outcome.ticket.attendeeName ??
              outcome.ticket.buyerName ??
              outcome.ticket.ticketNumber}
          </p>
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
