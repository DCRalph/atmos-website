"use client";

import { useState } from "react";
import { Loader2, LogOut, Users } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import type { DenyReasonValue } from "~/lib/ticketing/deny-reasons";
import {
  AccessBadge,
  DenialCard,
  DenyReasonPicker,
  ExceptionAction,
  PrimaryAction,
  SafeAction,
} from "~/components/door/controls";
import { PartySheet } from "~/components/door/party-sheet";

/**
 * One person, opened from the door list.
 *
 * The list answers "is this name on it"; this answers everything staff ask
 * next — who bought it, whether they're already inside, who let them in, and
 * whether somebody has already turned them away. Every action that changes
 * something is an exception button with a confirmation behind it, and the
 * bottom button closes without doing anything, exactly as on a scan result.
 */
export function PersonSheet({
  eventId,
  ticketId,
  onClose,
  onAdmit,
  onDeny,
  admitting,
  denying,
}: {
  eventId: string;
  ticketId: string;
  onClose: () => void;
  onAdmit: (ticketNumber: string) => void;
  onDeny: (ticketId: string, reason: DenyReasonValue, note: string) => void;
  admitting: boolean;
  denying: boolean;
}) {
  const [step, setStep] = useState<
    "detail" | "deny" | "confirm-revert" | "confirm-leave" | "party"
  >("detail");

  const utils = api.useUtils();
  const detail = api.door.ticketDetail.useQuery({ eventId, ticketId });

  const refresh = () => {
    void utils.door.ticketDetail.invalidate();
    void utils.door.doorList.invalidate();
    void utils.door.orderTickets.invalidate();
    void utils.door.recentScans.invalidate();
    void utils.door.summary.invalidate();
  };

  const revert = api.door.revertAdmission.useMutation({
    onSuccess: () => {
      toast.success("Admission undone.");
      refresh();
      setStep("detail");
    },
    onError: (error) => toast.error(error.message),
  });

  const depart = api.door.markDeparted.useMutation({
    onSuccess: () => {
      toast.success(
        "Marked as left. Their ticket scans clean on the way back.",
      );
      refresh();
      setStep("detail");
    },
    onError: (error) => toast.error(error.message),
  });

  if (detail.isPending || !detail.data) {
    return (
      <Sheet>
        <div className="flex flex-1 items-center justify-center">
          {detail.isPending ? (
            <Loader2 className="size-8 animate-spin opacity-50" aria-hidden />
          ) : (
            <p className="opacity-70">Couldn&apos;t load that ticket.</p>
          )}
        </div>
        <div className="p-5 pb-8">
          <SafeAction onClick={onClose}>Close</SafeAction>
        </div>
      </Sheet>
    );
  }

  const person = detail.data;
  const name = person.attendeeName ?? person.buyerName;
  const isIn = person.admittedAt !== null;

  if (step === "deny") {
    return (
      <DenyReasonPicker
        attendee={name}
        pending={denying}
        onCancel={() => setStep("detail")}
        onConfirm={(reason, note) => onDeny(person.id, reason, note)}
      />
    );
  }

  if (step === "party") {
    return (
      <PartySheet
        eventId={eventId}
        ticketId={person.id}
        admitting={admitting}
        onBack={() => setStep("detail")}
        onAdmit={onAdmit}
      />
    );
  }

  if (step === "confirm-revert") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-amber-600 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-3xl font-black tracking-tight">Undo admission?</p>
          <p className="mt-3 max-w-sm text-base opacity-90">
            {name ?? person.ticketNumber} goes back to not having arrived, and
            the headcount drops by one. Their ticket will scan clean again.
          </p>
          <p className="mt-6 text-sm opacity-80">
            Use this for a mis-scan, not to turn somebody away — refusing entry
            keeps a reason on the ticket.
          </p>
        </div>
        <div className="space-y-3 p-5 pb-8">
          <ExceptionAction
            onClick={() => revert.mutate({ eventId, ticketId: person.id })}
            disabled={revert.isPending}
          >
            {revert.isPending ? "Undoing…" : "Yes, undo it"}
          </ExceptionAction>
          <SafeAction
            onClick={() => setStep("detail")}
            disabled={revert.isPending}
          >
            Cancel
          </SafeAction>
        </div>
      </div>
    );
  }

  /**
   * Marking somebody out is not an undo, and this screen says so.
   *
   * It sits next to "Undo admission" in the stack, and the two are easy to
   * confuse at arm's length: both drop the headcount by one. The difference is
   * what happens next — an undo says they were never in and leaves the ticket
   * looking untouched, this says they were and have gone.
   */
  if (step === "confirm-leave") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-sky-700 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-3xl font-black tracking-tight">Mark as left?</p>
          <p className="mt-3 max-w-sm text-base opacity-90">
            {name ?? person.ticketNumber} comes off the headcount. Their ticket
            scans clean on the way back in
            {person.reentryAllowed ? "" : ", even though re-entry is off"}.
          </p>
          <p className="mt-6 max-w-sm text-sm opacity-80">
            Their admission stays on record — this says they&apos;ve gone, not
            that it never happened.
          </p>
        </div>
        <div className="space-y-3 p-5 pb-8">
          <ExceptionAction
            onClick={() => depart.mutate({ eventId, ticketId: person.id })}
            disabled={depart.isPending}
          >
            {depart.isPending ? "Marking…" : "Yes, they've left"}
          </ExceptionAction>
          <SafeAction
            onClick={() => setStep("detail")}
            disabled={depart.isPending}
          >
            Cancel
          </SafeAction>
        </div>
      </div>
    );
  }

  return (
    <Sheet>
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <p className="text-3xl font-black tracking-tight">
          {name ?? "No name given"}
        </p>
        <p className="mt-2">
          <AccessBadge level={person.accessLevel} />
        </p>
        {person.invitedByName && (
          <p className="mt-2 text-lg font-semibold">
            Invited by {person.invitedByName}
          </p>
        )}
        <p className="mt-2 text-lg opacity-80">{person.tierName}</p>
        <p className="mt-1 font-mono text-sm opacity-60">
          {person.ticketNumber} · {person.positionInOrder}
        </p>

        {/* Sits against the "1 of 4" that prompts the question, rather than in
            the action stack at the bottom, which is reserved for the things
            that change a decision. */}
        {person.orderTicketCount > 1 && (
          <button
            type="button"
            onClick={() => setStep("party")}
            className="mt-4 flex w-full max-w-sm items-center justify-center gap-2 border-2 border-white/20 px-4 py-3 text-base font-semibold transition-colors active:bg-white active:text-black"
          >
            <Users className="size-4" aria-hidden />
            See the other {person.orderTicketCount - 1} on this order
          </button>
        )}

        {person.nameLocked && person.attendeeName && (
          <p className="mt-4 inline-flex items-center gap-2 border-2 border-white/30 px-3 py-2 text-sm font-semibold">
            Photo ID — this ticket is in the name of {person.attendeeName}
          </p>
        )}

        <dl className="mt-6 space-y-2 border-t-2 border-white/10 pt-5 text-sm">
          <Row label="Order" value={person.orderNumber} />
          {person.invitedByName && (
            <Row label="Invited by" value={person.invitedByName} />
          )}
          {person.buyerName && (
            <Row label="Bought by" value={person.buyerName} />
          )}
          {person.buyerEmail && <Row label="Email" value={person.buyerEmail} />}
          <Row
            label="Paid by"
            value={person.isComp ? "Comp" : paymentLabel(person.paymentMethod)}
          />
        </dl>

        <div className="mt-6">
          {person.denial ? (
            <DenialCard
              heading="Refused entry"
              reason={person.denial.reason}
              note={person.denial.note}
              at={new Date(person.denial.at)}
              scannedByName={person.denial.scannedByName}
              deviceLabel={person.denial.deviceLabel}
            />
          ) : isIn ? (
            <div className="w-full max-w-sm border-2 border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-xl font-bold text-emerald-200">
                In {formatTimeAgo(new Date(person.admittedAt!))}
              </p>
              <p className="mt-1 text-sm opacity-80">
                {person.admittedBy
                  ? `by ${person.admittedBy}`
                  : "by an unknown scanner"}
                {person.admittedDevice ? ` on ${person.admittedDevice}` : ""}
              </p>
              {person.admissionCount > 1 && (
                <p className="mt-1 text-sm opacity-80">
                  {person.admissionCount} admissions on record
                </p>
              )}
            </div>
          ) : person.departedAt ? (
            <div className="w-full max-w-sm border-2 border-sky-500/40 bg-sky-500/10 p-4">
              <p className="text-xl font-bold text-sky-200">
                Left {formatTimeAgo(new Date(person.departedAt))}
              </p>
              <p className="mt-1 text-sm opacity-80">
                {person.departedBy
                  ? `marked out by ${person.departedBy}`
                  : "marked out"}
              </p>
              <p className="mt-1 text-sm opacity-80">
                Was in{" "}
                {person.admissionCount === 1
                  ? "once"
                  : `${person.admissionCount} times`}
                . Their ticket scans clean on the way back.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-sm border-2 border-white/15 bg-white/5 p-4">
              <p className="text-xl font-bold">Not arrived</p>
              <p className="mt-1 text-sm opacity-70">
                No scan against this ticket yet.
              </p>
            </div>
          )}
        </div>

        {person.isR18 && (
          <p className="mt-6 inline-block border-2 border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-bold text-red-200">
            R18 — CHECK ID
          </p>
        )}
      </div>

      <div className="space-y-3 p-5 pb-8">
        {!isIn && (
          <PrimaryAction onClick={() => onAdmit(person.ticketNumber)}>
            {person.denial
              ? "Admit anyway"
              : person.departedAt
                ? "Back in"
                : "Admit"}
          </PrimaryAction>
        )}

        {/* An ordinary action, not an exception: watching people leave is the
            job, nothing is overruled, and it is undone by scanning them back
            in. It sits above "Undo admission" because it is the one staff will
            reach for far more often. */}
        {isIn && (
          <PrimaryAction onClick={() => setStep("confirm-leave")}>
            <LogOut className="size-5" aria-hidden />
            Mark as left
          </PrimaryAction>
        )}

        {isIn && person.isManager && (
          <ExceptionAction
            hint="For a mis-scan — says they were never in"
            onClick={() => setStep("confirm-revert")}
          >
            Undo admission
          </ExceptionAction>
        )}

        {!person.denial && (
          <ExceptionAction
            hint="Turns this person away and blocks the ticket"
            onClick={() => setStep("deny")}
          >
            Deny entry
          </ExceptionAction>
        )}

        <SafeAction onClick={onClose}>Close</SafeAction>
      </div>
    </Sheet>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      {children}
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

function paymentLabel(method: string): string {
  switch (method) {
    case "CASH":
      return "Cash at the door";
    case "TERMINAL":
      return "Card at the door";
    case "COMP":
      return "Comp";
    case "FREE":
      return "Free ticket";
    default:
      return "Online";
  }
}
