"use client";

import { useState } from "react";
import { Keyboard, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

/**
 * Typing a ticket number instead of scanning it.
 *
 * The fallback that saves the night: a smashed screen, a flat battery, a
 * printout, a camera that won't focus in the dark. It backs both the scan tab
 * (where it checks somebody in) and the check tab (where it only looks them
 * up), so the field, the placeholder and the hint about where the number is
 * printed stay identical in both — staff learn it once.
 *
 * It lives folded away under a button rather than sitting open beneath the
 * camera. An input in reach of a thumb on a phone held at a queue is an input
 * that gets focused by accident, and the keyboard that springs up covers the
 * viewfinder — which is exactly the thing somebody was trying to use.
 */
export function ManualEntryPanel({
  pending,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (ticketNumber: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 border-2 border-white/15 text-sm font-medium text-white/60 transition-colors active:bg-white active:text-black"
      >
        <Keyboard className="size-4" aria-hidden />
        Type a ticket number
      </button>
    );
  }

  return (
    <div className="space-y-4 border-2 border-white/15 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-white/70">
          <Keyboard className="size-4" aria-hidden />
          Manual entry
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide manual entry"
          className="p-1 text-white/50 transition-colors active:text-white"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <TicketNumberEntry
        pending={pending}
        submitLabel={submitLabel}
        pendingLabel={pendingLabel}
        autoFocus
        onSubmit={onSubmit}
      />
    </div>
  );
}

export function TicketNumberEntry({
  pending,
  submitLabel,
  pendingLabel,
  autoFocus = false,
  onSubmit,
}: {
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  autoFocus?: boolean;
  onSubmit: (ticketNumber: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onSubmit(value.trim());
        setValue("");
      }}
    >
      <div>
        <label htmlFor="ticket-number" className="text-sm text-white/60">
          Ticket number
        </label>
        <Input
          id="ticket-number"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="ATM-4F7K2X-01"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          // Only ever set when the form was opened by a deliberate tap on
          // "Type a ticket number" — the keyboard is the point of that tap.
          autoFocus={autoFocus}
          className="mt-1.5 h-14 bg-white/5 text-center font-mono text-lg tracking-wider"
        />
        <p className="mt-2 text-xs text-white/40">
          It&apos;s printed under the QR code on their ticket and in their
          email.
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-14 w-full text-base"
        disabled={pending || !value.trim()}
      >
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
