"use client";

import { useEffect } from "react";
import { AlertTriangle, Ban, Check, RotateCcw, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import type { RouterOutputs } from "~/trpc/react";

type ScanOutcome = RouterOutputs["door"]["scan"];

/**
 * The full-screen result.
 *
 * Colour carries the meaning at arm's length; the words are for when someone
 * looks closer. The duplicate state deliberately leads with *how long ago* the
 * ticket came through, because that is the fact door staff actually use to
 * decide whether they're looking at a mistake or a shared screenshot.
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
    default:
      return "rejected";
  }
}

export function ScanResultScreen({
  outcome,
  onDismiss,
  onOverride,
  canOverride,
  overriding,
}: {
  outcome: ScanOutcome;
  onDismiss: () => void;
  onOverride: () => void;
  /** Door managers only. */
  canOverride: boolean;
  overriding: boolean;
}) {
  const tone = TONE[toneFor(outcome.result)];
  const Icon = tone.icon;

  // Clean results clear themselves so the next person can be scanned without
  // a tap. Anything needing a decision stays until it's dismissed.
  useEffect(() => {
    if (outcome.result !== "ADMITTED" && outcome.result !== "REENTRY") return;
    const timer = setTimeout(onDismiss, 2200);
    return () => clearTimeout(timer);
  }, [outcome, onDismiss]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${tone.bg} text-white`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
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

      <div className="flex gap-3 p-5 pb-8">
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
  );
}
