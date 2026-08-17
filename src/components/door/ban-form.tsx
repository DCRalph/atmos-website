"use client";

import { useState } from "react";

import { Input } from "~/components/ui/input";
import { ExceptionAction, SafeAction } from "~/components/door/controls";
import {
  DENY_REASONS,
  type DenyReasonValue,
} from "~/lib/ticketing/deny-reasons";

/**
 * Barring somebody from every Atmos event.
 *
 * A step beyond refusing entry, and shaped to feel like one. Refusing is the
 * job of whoever is holding the scanner and takes two taps; this is managers
 * only, asks for a reason *and* how long, and says out loud what it will do —
 * because the person it is done to will meet it again at a different door in
 * three months with no memory of tonight to explain it.
 *
 * Nothing is preselected, including the duration. A ban's length is the part
 * most worth a moment's thought, and a default is a thing people accept without
 * reading — which is how every ban ends up permanent.
 *
 * The web twin of `mobile/src/components/door/ban-sheet.tsx`, down to the
 * darker red: this is the more serious of the two red screens and must not be
 * mistaken for the refusal one at a glance.
 */

const DURATIONS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "12 months", days: 365 },
  { label: "Permanent", days: null },
] as const;

export function BanForm({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (
    reason: DenyReasonValue,
    note: string,
    expiresInDays: number | null,
  ) => void;
}) {
  const [reason, setReason] = useState<DenyReasonValue | null>(null);
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState<number | null | undefined>(
    undefined,
  );

  const ready = reason !== null && duration !== undefined;

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-red-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      <div className="flex-1 overflow-y-auto px-5 pt-8">
        <p className="text-2xl font-black tracking-tight">Ban {name}?</p>
        <p className="mt-1 text-sm opacity-80">
          Every Atmos door will see this, at every future event, until a manager
          lifts it.
        </p>

        <p className="mt-6 text-xs font-black tracking-widest uppercase opacity-70">
          Why
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {DENY_REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              aria-pressed={reason === option.value}
              className={`flex h-16 items-center justify-center border-2 px-2 text-center text-base font-semibold ${
                reason === option.value
                  ? "border-white bg-white text-red-950"
                  : "border-white/25 bg-black/15 text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs font-black tracking-widest uppercase opacity-70">
          How long
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {DURATIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setDuration(option.days)}
              aria-pressed={duration === option.days && duration !== undefined}
              className={`flex h-14 items-center justify-center border-2 px-2 text-center text-base font-semibold ${
                duration === option.days && duration !== undefined
                  ? "border-white bg-white text-red-950"
                  : "border-white/25 bg-black/15 text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-6 block">
          <span className="text-xs tracking-wide uppercase opacity-70">
            What happened — the next door will read this
          </span>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Threw a glass, refused to leave"
            className="mt-1.5 h-12 border-white/30 bg-black/20 text-white placeholder:text-white/40"
          />
        </label>
      </div>

      <div className="space-y-3 p-5 pb-8">
        <ExceptionAction
          onClick={() => ready && onConfirm(reason, note.trim(), duration)}
          disabled={!ready || pending}
          hint={
            !reason
              ? "Pick a reason first"
              : duration === undefined
                ? "Pick how long"
                : undefined
          }
        >
          {pending
            ? "Banning…"
            : duration === null
              ? "Ban permanently"
              : duration === undefined
                ? "Ban"
                : `Ban for ${DURATIONS.find((option) => option.days === duration)?.label}`}
        </ExceptionAction>
        <SafeAction onClick={onCancel} disabled={pending}>
          Back
        </SafeAction>
      </div>
    </div>
  );
}
