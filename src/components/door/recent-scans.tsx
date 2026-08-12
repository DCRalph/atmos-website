"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { ExceptionAction, SafeAction } from "~/components/door/controls";
import { PersonSheet } from "~/components/door/person-sheet";
import { playFeedback } from "~/components/door/feedback";
import { formatTimeAgo } from "~/lib/ticketing/dates";
import {
  denyReasonLabel,
  type DenyReasonValue,
} from "~/lib/ticketing/deny-reasons";
import { scanResultShort, scanResultTone } from "~/lib/ticketing/scan-results";

type Scan = RouterOutputs["door"]["recentScans"][number];

/** Which way the dot reads at a glance. */
const DOT = {
  in: "bg-emerald-400",
  out: "bg-red-400",
  bad: "bg-amber-400",
  neutral: "bg-white/40",
} as const;

/**
 * The last few scans, under the camera.
 *
 * Two jobs. It answers "did that go through?" without leaving the scanner, and
 * it is where a mistake gets fixed — a wrong tap is noticed within seconds, and
 * before this the only route back was to leave the camera, find the person in
 * the list and open them.
 *
 * Defaults to this staffer's own actions. At a door with three scanners the
 * event-wide feed is mostly other people's work, and the row you need to undo
 * is always one of yours.
 */
export function RecentScans({
  eventId,
  deviceLabel,
  admitting,
  denying,
  mine,
  onMineChange,
  onAdmit,
  onDeny,
}: {
  eventId: string;
  deviceLabel: string;
  admitting: boolean;
  denying: boolean;
  /** Held by the page: this follows staff from tab to tab, so it must too. */
  mine: boolean;
  onMineChange: (mine: boolean) => void;
  onAdmit: (ticketNumber: string) => void;
  onDeny: (ticketId: string, reason: DenyReasonValue, note: string) => void;
}) {
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<UndoRequest | null>(null);

  const utils = api.useUtils();

  const scans = api.door.recentScans.useQuery(
    { eventId, limit: 8, mine },
    { enabled: !!eventId, refetchInterval: 10_000 },
  );

  // An undo moves the headcount and changes what the list itself may offer
  // next, so everything that reads a ticket's standing is refreshed.
  const refresh = () => {
    void utils.door.recentScans.invalidate();
    void utils.door.summary.invalidate();
    void utils.door.doorList.invalidate();
    void utils.door.ticketDetail.invalidate();
    void utils.door.orderTickets.invalidate();
  };

  const undoAdmission = api.door.revertAdmission.useMutation({
    onSuccess: () => {
      playFeedback("warn");
      toast.success("Admission undone.");
      setConfirm(null);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const undoDenial = api.door.revertDenial.useMutation({
    onSuccess: () => {
      playFeedback("warn");
      toast.success("Refusal taken back.");
      setConfirm(null);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const busy = undoAdmission.isPending || undoDenial.isPending;
  const rows = scans.data ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
          {mine ? "What you did" : "Just now"}
        </p>
        <button
          type="button"
          onClick={() => onMineChange(!mine)}
          className="shrink-0 text-xs text-white/50 underline underline-offset-2"
        >
          {mine ? "Show every door" : "Show only mine"}
        </button>
      </div>

      {scans.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <p className="border-2 border-white/10 p-4 text-center text-sm text-white/40">
          {mine ? "You haven't scanned anything yet." : "Nothing yet tonight."}
        </p>
      ) : (
        <ul className="divide-y-2 divide-white/5 border-2 border-white/10">
          {rows.map((scan) => (
            <ScanRow
              key={scan.id}
              scan={scan}
              showStaff={!mine}
              busy={busy}
              onOpen={setOpenTicketId}
              onUndo={setConfirm}
            />
          ))}
        </ul>
      )}

      {confirm && (
        <UndoConfirm
          request={confirm}
          pending={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.kind === "admission") {
              undoAdmission.mutate({ eventId, ticketId: confirm.ticketId });
              return;
            }
            undoDenial.mutate({
              eventId,
              ticketId: confirm.ticketId,
              deviceLabel: deviceLabel || undefined,
            });
          }}
        />
      )}

      {openTicketId && (
        <PersonSheet
          eventId={eventId}
          ticketId={openTicketId}
          admitting={admitting}
          denying={denying}
          onClose={() => setOpenTicketId(null)}
          onAdmit={(ticketNumber) => {
            setOpenTicketId(null);
            onAdmit(ticketNumber);
          }}
          onDeny={(ticketId, reason, note) => {
            setOpenTicketId(null);
            onDeny(ticketId, reason, note);
          }}
        />
      )}
    </div>
  );
}

type UndoRequest = {
  kind: "admission" | "denial";
  ticketId: string;
  who: string;
};

function ScanRow({
  scan,
  showStaff,
  busy,
  onOpen,
  onUndo,
}: {
  scan: Scan;
  showStaff: boolean;
  busy: boolean;
  onOpen: (ticketId: string) => void;
  onUndo: (request: UndoRequest) => void;
}) {
  // Pulled out of the row so the narrowing survives into the handlers below.
  const { ticketId, undo } = scan;
  const who =
    scan.ticket?.attendeeName ?? scan.ticket?.ticketNumber ?? "Unknown code";

  const meta = [
    scanResultShort(scan.result),
    scan.denyReason ? denyReasonLabel(scan.denyReason) : null,
    showStaff ? scan.scannedByName : null,
    scan.deviceLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-stretch">
      <button
        type="button"
        disabled={!ticketId}
        onClick={() => ticketId && onOpen(ticketId)}
        className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left disabled:opacity-60"
      >
        <span
          className={`size-2 shrink-0 ${DOT[scanResultTone(scan.result)]}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{who}</span>
          <span className="block truncate text-xs text-white/40">{meta}</span>
        </span>
        <span className="shrink-0 text-xs text-white/40">
          {formatTimeAgo(new Date(scan.createdAt))}
        </span>
      </button>

      {/* Spelled out rather than left to the row being tappable. The thing
          wanted off this feed is usually the ticket's whole story, and a
          target you have to guess at is one nobody finds mid-shift. */}
      {ticketId && (
        <button
          type="button"
          onClick={() => onOpen(ticketId)}
          className="shrink-0 border-l-2 border-white/10 px-3 text-xs font-black tracking-widest uppercase transition-colors active:bg-white active:text-black"
        >
          View
        </button>
      )}

      {/* Offered only while it still stands — the server decides against the
          ticket's current state, so a row already undone or overtaken by a
          later scan stops showing it. */}
      {undo && ticketId && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onUndo({ kind: undo, ticketId, who })}
          className="shrink-0 border-l-2 border-white/10 px-3 text-xs font-black tracking-widest uppercase transition-colors active:bg-white active:text-black disabled:opacity-50"
        >
          Undo
        </button>
      )}
    </li>
  );
}

/**
 * Ask before taking something back.
 *
 * Its own screen rather than a second tap on the same button: this sits inches
 * from rows staff are skimming, and a stray double-tap would sail straight
 * through an inline "Sure?".
 *
 * The two cases are not equally serious and the wording says so. Undoing an
 * admission moves the headcount and puts somebody back outside; taking back a
 * refusal only restores a choice, and the original stays in the history either
 * way.
 */
function UndoConfirm({
  request,
  pending,
  onCancel,
  onConfirm,
}: {
  request: UndoRequest;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const admission = request.kind === "admission";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-amber-600 text-white">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-3xl font-black tracking-tight">
          {admission ? "Undo admission?" : "Take back refusal?"}
        </p>
        <p className="mt-3 max-w-sm text-base opacity-90">
          {admission
            ? `${request.who} goes back to not arrived, and the headcount drops by one.`
            : `${request.who} can be admitted again. The refusal stays in their history either way.`}
        </p>
        {admission && (
          <p className="mt-6 max-w-sm text-sm opacity-80">
            Use this for a mis-scan, not to turn somebody away — refusing entry
            keeps a reason on the ticket.
          </p>
        )}
      </div>

      <div className="space-y-3 p-5 pb-8">
        <ExceptionAction onClick={onConfirm} disabled={pending}>
          {pending
            ? "Undoing…"
            : admission
              ? "Yes, undo it"
              : "Yes, take it back"}
        </ExceptionAction>
        <SafeAction onClick={onCancel} disabled={pending}>
          Cancel
        </SafeAction>
      </div>
    </div>
  );
}
