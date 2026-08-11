"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Input } from "~/components/ui/input";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import {
  DENY_REASONS,
  denyReasonLabel,
  type DenyReasonValue,
} from "~/lib/ticketing/deny-reasons";

/**
 * The door's buttons.
 *
 * One rule, everywhere: **the bottom button is always the harmless one.** Next,
 * Cancel, Back, Close — full width, white, same place every time, because that
 * is the button tapped a few hundred times a night without being read, and it
 * must never be the one that lets a stranger in.
 *
 * Anything that changes a decision sits above it, bordered rather than filled,
 * and says what it is about to do. At arm's length in the dark, "hard to do by
 * accident" matters more than "quick".
 */

/** The safe way off a screen: same size, same colour, same place, every time. */
export function SafeAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-16 w-full items-center justify-center gap-2 bg-white text-base font-bold tracking-wide text-black disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** An exception: overriding, refusing, undoing — never the obvious next tap. */
export function ExceptionAction({
  children,
  hint,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full flex-col items-center justify-center gap-0.5 border-2 border-black/30 bg-black/20 px-4 py-3 text-white disabled:opacity-50"
    >
      <span className="flex items-center gap-2 text-base font-semibold tracking-wide">
        <AlertTriangle className="size-4" aria-hidden />
        {children}
      </span>
      {hint && <span className="text-xs opacity-70">{hint}</span>}
    </button>
  );
}

/**
 * The ordinary action of a screen somebody opened on purpose — admitting from
 * the door list, taking a payment. Filled, but not the bottom button.
 */
export function PrimaryAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center gap-2 bg-black/40 text-base font-bold tracking-wide text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** What the last staff member wrote when they turned this person away. */
export function DenialCard({
  heading,
  reason,
  note,
  at,
  scannedByName,
  deviceLabel,
}: {
  heading: string;
  reason: string | null;
  note: string | null;
  at: Date;
  scannedByName: string | null;
  deviceLabel: string | null;
}) {
  return (
    <div className="w-full max-w-sm border-2 border-black/20 bg-black/20 p-4 text-left">
      <p className="text-xs tracking-widest uppercase opacity-70">{heading}</p>
      <p className="mt-1 text-xl font-bold">{denyReasonLabel(reason)}</p>
      {note && <p className="mt-1 text-base opacity-90">“{note}”</p>}
      <p className="mt-2 text-sm opacity-80">
        {formatTimeAgo(at)}
        {scannedByName ? ` · ${scannedByName}` : ""}
        {deviceLabel ? ` · ${deviceLabel}` : ""}
      </p>
    </div>
  );
}

/**
 * The reason list.
 *
 * Fixed options rather than a text box: they get tapped one-handed in the
 * dark, and they're the thing the next scanner reads back off the ticket. The
 * note is there for the detail that doesn't fit a label. Picking a reason and
 * confirming are separate taps, so this is its own confirmation — there is no
 * extra screen after it.
 */
export function DenyReasonPicker({
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

      <div className="space-y-3 p-5 pb-8">
        <ExceptionAction
          onClick={() => reason && onConfirm(reason, note)}
          disabled={!reason || pending}
          hint={reason ? undefined : "Pick a reason first"}
        >
          {pending ? "Refusing…" : "Refuse entry"}
        </ExceptionAction>
        <SafeAction onClick={onCancel} disabled={pending}>
          Back
        </SafeAction>
      </div>
    </div>
  );
}
