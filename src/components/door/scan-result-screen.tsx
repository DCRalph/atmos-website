"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Check, RotateCcw, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import {
  DENY_REASONS,
  denyReasonLabel,
  type DenyReasonValue,
} from "~/lib/ticketing/deny-reasons";
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
 * Nothing clears itself. A result that vanished on a timer while staff were
 * still looking at the person is a result nobody acted on, so every scan waits
 * for a tap — and every scan that came back clean can be turned into a refusal
 * from this screen, because a valid ticket says nothing about whether the
 * person holding it is getting in.
 */

const TONE = {
  admitted: {
    bg: "bg-emerald-600",
    icon: Check,
    label: "IN",
  },
  reentry: {
    bg: "bg-sky-600",
    icon: RotateCcw,
    label: "RE-ENTRY",
  },
  duplicate: {
    bg: "bg-amber-500",
    icon: AlertTriangle,
    label: "ALREADY ADMITTED",
  },
  denied: {
    bg: "bg-red-700",
    icon: Ban,
    label: "REFUSED",
  },
  previouslyDenied: {
    bg: "bg-red-700",
    icon: Ban,
    label: "REFUSED EARLIER",
  },
  rejected: {
    bg: "bg-red-700",
    icon: Ban,
    label: "NO ENTRY",
  },
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
  const [pickingReason, setPickingReason] = useState(false);
  const tone = TONE[toneFor(outcome.result)];
  const Icon = tone.icon;

  if (pickingReason && outcome.ticket) {
    return (
      <DenyReasonPicker
        attendee={outcome.ticket.attendeeName ?? outcome.ticket.buyerName}
        pending={denying}
        onCancel={() => setPickingReason(false)}
        onConfirm={onDeny}
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
            <p className="text-lg opacity-90">{outcome.ticket.tierName}</p>
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
          <div className="mt-8 w-full max-w-sm border-2 border-black/20 bg-black/20 p-4 text-left">
            <p className="text-xs tracking-widest uppercase opacity-70">
              {outcome.result === "DENIED" ? "Refused" : "Turned away"}
            </p>
            <p className="mt-1 text-xl font-bold">
              {denyReasonLabel(outcome.previousDenial.reason)}
            </p>
            {outcome.previousDenial.note && (
              <p className="mt-1 text-base opacity-90">
                “{outcome.previousDenial.note}”
              </p>
            )}
            <p className="mt-2 text-sm opacity-80">
              {formatTimeAgo(new Date(outcome.previousDenial.at))}
              {outcome.previousDenial.scannedByName
                ? ` · ${outcome.previousDenial.scannedByName}`
                : ""}
              {outcome.previousDenial.deviceLabel
                ? ` · ${outcome.previousDenial.deviceLabel}`
                : ""}
            </p>
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

      <div className="p-5 pb-8">
        {/* Deliberately smaller than "Next": refusing is the rarer call, and a
            fat green-screen button next to a thumb is how it gets made by
            accident. */}
        {canDeny(outcome) && (
          <button
            type="button"
            onClick={() => setPickingReason(true)}
            className="mb-3 flex h-11 w-full items-center justify-center gap-2 border-2 border-black/25 bg-black/20 text-sm font-semibold tracking-wide"
          >
            <Ban className="size-4" aria-hidden />
            Deny entry
          </button>
        )}

        <div className="flex gap-3">
          {outcome.canOverride && canOverride && (
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="h-16 flex-1 text-base"
              disabled={overriding}
              onClick={onOverride}
            >
              {overriding ? "Admitting…" : "Admit anyway"}
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="h-16 flex-1 text-base"
            onClick={onDismiss}
          >
            <X className="size-5" aria-hidden />
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The reason list.
 *
 * Fixed options rather than a text box: they get tapped one-handed in the
 * dark, and they're the thing the next scanner reads back off the ticket. The
 * note is there for the detail that doesn't fit a label.
 */
function DenyReasonPicker({
  attendee,
  pending,
  onCancel,
  onConfirm,
}: {
  attendee: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: DenyReasonValue, note: string) => void;
}) {
  const [reason, setReason] = useState<DenyReasonValue | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-red-800 text-white">
      <div className="flex-1 overflow-y-auto px-5 pt-8">
        <p className="text-2xl font-black tracking-tight">Why refuse?</p>
        <p className="mt-1 text-sm opacity-80">
          {attendee ? `${attendee} · ` : ""}the next scanner will see this
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          {DENY_REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              aria-pressed={reason === option.value}
              className={`flex h-20 items-center justify-center border-2 px-2 text-center text-base font-semibold ${
                reason === option.value
                  ? "border-white bg-white text-red-800"
                  : "border-white/25 bg-black/15 text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="text-xs tracking-wide uppercase opacity-70">
            Note (optional)
          </span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Anything the next person should know"
            className="mt-1.5 h-12 border-white/30 bg-black/20 text-white placeholder:text-white/40"
          />
        </label>
      </div>

      <div className="flex gap-3 p-5 pb-8">
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="h-16 flex-1 text-base"
          onClick={onCancel}
          disabled={pending}
        >
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-16 flex-[2] bg-white text-base text-red-800 hover:bg-white/90"
          disabled={!reason || pending}
          onClick={() => reason && onConfirm(reason, note)}
        >
          {pending ? "Refusing…" : "Refuse entry"}
        </Button>
      </div>
    </div>
  );
}
