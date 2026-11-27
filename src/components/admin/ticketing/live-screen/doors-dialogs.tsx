"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { formatEventTime } from "~/lib/ticketing/dates";
import {
  DENY_REASONS,
  denyReasonLabel,
  type DenyReasonValue,
} from "~/lib/ticketing/deny-reasons";
import { formatNZD } from "~/lib/ticketing/money";
import { paymentMethodShort } from "~/lib/ticketing/payment-methods";
import {
  scanResultLabel,
  scanResultShort,
  scanResultTone,
  type ScanResultTone,
} from "~/lib/ticketing/scan-results";
import { type LiveDialogProps } from "./context";
import {
  Bars,
  DetailSection,
  KeyValues,
  toneText,
  useNow,
  type Tone,
} from "./parts";
import { DialogFrame, useOpenRowDialog } from "./row-dialog";
import { LiveOrderDialog } from "./sales-dialogs";

/**
 * What the doors screen's rows open: one scan with its ticket's whole night,
 * and one scanner's night. Both fetch their own numbers and keep them fresh,
 * so they're right however long they're left open.
 */

const SCAN_TONE: Record<ScanResultTone, Tone> = {
  in: "arrivals",
  out: "bad",
  bad: "warn",
  neutral: "plain",
};

/** The scans made from the live screen say so in the door's history. */
const DEVICE = "Live screen";

type ScanDetail = RouterOutputs["ticketAnalytics"]["scanDetail"];
type Scan = ScanDetail["scan"];

/** "Finn · Door 1", from whichever of the two a scan carries. */
const scannedBy = (scan: Pick<Scan, "by" | "device">) =>
  [scan.by, scan.device].filter(Boolean).join(" · ") || "–";

/** Events down a line, newest first: when, what, and who or where. */
function Timeline({
  rows,
}: {
  rows: {
    key: string;
    at: string;
    label: ReactNode;
    tone: Tone;
    right?: ReactNode;
    note?: ReactNode;
  }[];
}) {
  return (
    <ol className="flex flex-col">
      {rows.map((row, i) => (
        <li
          key={row.key}
          className="relative grid grid-cols-[0.5rem_4.75rem_minmax(0,1fr)_auto] items-baseline gap-x-2.5 py-1"
        >
          <span
            className={cn(
              "size-2 self-center rounded-full bg-current",
              row.tone === "plain"
                ? "text-muted-foreground"
                : toneText(row.tone),
            )}
          />
          {i < rows.length - 1 ? (
            <span className="bg-border absolute top-[calc(50%+0.45rem)] -bottom-[calc(50%-0.45rem)] left-[0.22rem] w-px" />
          ) : null}
          <span className="whitespace-nowrap tabular-nums">{row.at}</span>
          <span className="min-w-0">
            <span className={cn("font-medium", toneText(row.tone))}>
              {row.label}
            </span>
            {row.note ? (
              <span className="text-muted-foreground block text-xs">
                {row.note}
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground text-right text-xs">
            {row.right}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One scan opened up: the scan, its ticket's night, and what can be done. */
export function ScanDialog({
  scanId,
  ...live
}: LiveDialogProps & { scanId: string }) {
  const { eventId, timezone } = live;
  const open = useOpenRowDialog();
  const detail = api.ticketAnalytics.scanDetail.useQuery(
    { eventId, scanId },
    { refetchInterval: 10_000 },
  );

  if (!detail.data) {
    return (
      <DialogFrame title="Scan">
        {detail.isError ? (
          <p className="text-muted-foreground">{detail.error.message}</p>
        ) : (
          <Skeleton className="h-40" />
        )}
      </DialogFrame>
    );
  }

  const { scan, ticket, timeline, orderTickets } = detail.data;
  const time = (at: Date) => formatEventTime(at, timezone);

  const standing: { text: string; tone: Tone } = !ticket
    ? { text: "No ticket matches this code", tone: "warn" }
    : ticket.deniedAt
      ? { text: `Refused at ${time(ticket.deniedAt)}`, tone: "bad" }
      : ticket.status !== "VALID"
        ? {
            text:
              ticket.status === "REFUNDED"
                ? "This ticket was refunded"
                : "This ticket was cancelled",
            tone: "warn",
          }
        : ticket.admittedAt
          ? {
              text: `Inside since ${time(ticket.admittedAt)}`,
              tone: "arrivals",
            }
          : ticket.departedAt
            ? { text: `Left at ${time(ticket.departedAt)}`, tone: "plain" }
            : { text: "Not inside", tone: "plain" };

  // A turned-back ticket: when it first came through, and where.
  const earlier =
    scan.result === "DUPLICATE"
      ? timeline.find(
          (row) =>
            row.at < scan.at &&
            (row.result === "ADMITTED" ||
              row.result === "REENTRY" ||
              row.result === "OVERRIDE_ADMITTED"),
        )
      : undefined;
  const minutesEarlier = earlier
    ? Math.round((scan.at.getTime() - earlier.at.getTime()) / 60_000)
    : 0;
  const otherDoor =
    earlier?.device && scan.device && earlier.device !== scan.device;

  const inside = orderTickets.filter((row) => row.inside).length;

  return (
    <DialogFrame
      title={
        ticket
          ? (ticket.attendeeName ?? "No name")
          : scanResultLabel(scan.result)
      }
      sub={
        ticket ? (
          <>
            <span className="font-mono">{ticket.ticketNumber}</span> ·{" "}
            {ticket.typeName}
          </>
        ) : (
          "No ticket"
        )
      }
      state={
        <span
          className={
            standing.tone === "plain"
              ? "text-muted-foreground"
              : toneText(standing.tone)
          }
        >
          {standing.text}
        </span>
      }
      footer={
        ticket && live.access.door !== "none" ? (
          <ScanActions {...live} scan={scan} ticket={ticket} />
        ) : ticket ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => open?.(orderDialog(live, ticket))}
          >
            Open the order
          </Button>
        ) : undefined
      }
    >
      {earlier ? (
        <p className="border-l-2 border-amber-400 py-0.5 pl-3">
          This ticket came in {minutesEarlier}{" "}
          {minutesEarlier === 1 ? "minute" : "minutes"} earlier
          {earlier.device ? ` at ${earlier.device}` : ""}.
          {otherDoor
            ? " A second scan at another door often means a shared screenshot."
            : ""}
        </p>
      ) : null}

      <DetailSection title="This scan">
        <KeyValues
          className="lg:[mask-image:none] lg:text-sm"
          rows={[
            {
              key: "result",
              label: "Result",
              value: `${scanResultLabel(scan.result)}${scan.wasOverride ? " · override" : ""}`,
            },
            ...(scan.reason
              ? [
                  {
                    key: "reason",
                    label: "Reason",
                    value: denyReasonLabel(scan.reason),
                  },
                ]
              : []),
            ...(scan.note
              ? [{ key: "note", label: "Note", value: scan.note }]
              : []),
            { key: "at", label: "Scanned", value: time(scan.at) },
            { key: "by", label: "By", value: scannedBy(scan) },
          ]}
        />
      </DetailSection>

      {ticket ? (
        <DetailSection
          title="This ticket tonight"
          meta={`${timeline.length} ${timeline.length === 1 ? "entry" : "entries"}`}
        >
          <Timeline
            rows={timeline.map((row) => ({
              key: row.id,
              at: time(row.at),
              label: `${scanResultShort(row.result)}${row.reason ? ` · ${denyReasonLabel(row.reason).toLowerCase()}` : ""}`,
              tone: SCAN_TONE[scanResultTone(row.result)],
              right: scannedBy(row),
              note: row.note,
            }))}
          />
        </DetailSection>
      ) : null}

      {ticket ? (
        <DetailSection title="The ticket">
          <KeyValues
            className="lg:[mask-image:none] lg:text-sm"
            rows={[
              {
                key: "ticket",
                label: "Ticket",
                value: `${ticket.typeName} · ${ticket.isComp ? "comp" : formatNZD(ticket.pricePaidCents)}`,
              },
              {
                key: "order",
                label: "Order",
                value: `${ticket.orderNumber} · ${paymentMethodShort(ticket.paymentMethod)}`,
              },
              {
                key: "buyer",
                label: "Bought by",
                value: ticket.buyerName ?? "–",
              },
            ]}
          />
        </DetailSection>
      ) : null}

      {orderTickets.length > 1 ? (
        <DetailSection
          title={`On order ${ticket?.orderNumber ?? ""}`}
          meta={`${orderTickets.length} tickets · ${inside} inside`}
        >
          <ul className="flex flex-col">
            {orderTickets.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-3 border-t py-1 first:border-t-0"
              >
                <span className="text-muted-foreground font-mono text-xs">
                  {row.ticketNumber}
                </span>
                <span className="truncate">
                  {row.attendeeName ?? "no name yet"}
                </span>
                <span
                  className={
                    row.refused
                      ? toneText("bad")
                      : row.status !== "VALID"
                        ? toneText("warn")
                        : row.inside
                          ? toneText("arrivals")
                          : "text-muted-foreground"
                  }
                >
                  {row.refused
                    ? "refused"
                    : row.status !== "VALID"
                      ? row.status === "REFUNDED"
                        ? "refunded"
                        : "cancelled"
                      : row.inside
                        ? "inside"
                        : row.left
                          ? "left"
                          : "not here yet"}
                </span>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}
    </DialogFrame>
  );
}

const orderDialog = (
  live: LiveDialogProps,
  ticket: NonNullable<ScanDetail["ticket"]>,
) => ({
  label: `Order ${ticket.orderNumber}`,
  content: <LiveOrderDialog {...live} orderId={ticket.orderId} />,
});

/**
 * What door staff can do about a ticket from here, by where it stands. Each
 * is the door app's own action, so the same rules apply: letting somebody in
 * over a duplicate and undoing someone else's admission need a manager.
 */
function ScanActions({
  scan,
  ticket,
  ...live
}: LiveDialogProps & {
  scan: Scan;
  ticket: NonNullable<ScanDetail["ticket"]>;
}) {
  const { eventId, access } = live;
  const utils = api.useUtils();
  const open = useOpenRowDialog();
  const [form, setForm] = useState<"note" | "refuse" | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<DenyReasonValue>("INTOXICATED");

  const settle = () => void utils.ticketAnalytics.invalidate();
  const done = (message: string) => {
    toast.success(message);
    setForm(null);
    setNote("");
    settle();
  };
  const onError = (error: { message: string }) => {
    toast.error(error.message);
    settle();
  };

  const admit = api.door.admitByTicketNumber.useMutation({
    onSuccess: (outcome) =>
      outcome.admit ? done("Let in.") : onError(outcome),
    onError,
  });
  const undo = api.door.revertAdmission.useMutation({
    onSuccess: () => done("Admission undone."),
    onError,
  });
  const left = api.door.markDeparted.useMutation({
    onSuccess: () => done("Marked as left."),
    onError,
  });
  const takeBack = api.door.revertDenial.useMutation({
    onSuccess: () => done("Refusal taken back."),
    onError,
  });
  const refuse = api.door.deny.useMutation({
    onSuccess: (outcome) =>
      outcome.result === "DENIED" ? done("Refused.") : onError(outcome),
    onError,
  });
  const addNote = api.door.addNote.useMutation({
    onSuccess: () => done("Note added."),
    onError,
  });
  const busy =
    admit.isPending ||
    undo.isPending ||
    left.isPending ||
    takeBack.isPending ||
    refuse.isPending ||
    addNote.isPending;

  const target = { eventId, ticketId: ticket.id };
  const manager = access.door === "manager";
  const valid = ticket.status === "VALID";
  const inside = ticket.admittedAt !== null;
  const refused = ticket.deniedAt !== null;

  if (form) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (form === "note") {
            addNote.mutate({ ...target, note, deviceLabel: DEVICE });
          } else {
            refuse.mutate({
              ...target,
              reason,
              note: note.trim() || undefined,
              deviceLabel: DEVICE,
            });
          }
        }}
      >
        {form === "refuse" ? (
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as DenyReasonValue)}
            className="dark:bg-input/30 border-input h-8 rounded-md border bg-transparent px-2 text-sm"
            aria-label="Reason"
          >
            {DENY_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
        <Input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={form === "note" ? 500 : 200}
          placeholder={form === "note" ? "What happened" : "Note (optional)"}
          className="h-8 min-w-40 flex-1"
        />
        <Button
          type="submit"
          size="sm"
          variant={form === "refuse" ? "destructive" : "default"}
          disabled={busy || (form === "note" && !note.trim())}
        >
          {form === "note" ? "Add note" : "Refuse"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setForm(null)}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {refused ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => takeBack.mutate({ ...target, deviceLabel: DEVICE })}
        >
          Take back the refusal
        </Button>
      ) : null}
      {inside && scan.result === "DUPLICATE" && manager ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            admit.mutate({
              eventId,
              ticketNumber: ticket.ticketNumber,
              deviceLabel: DEVICE,
              override: true,
            })
          }
        >
          Let in anyway
        </Button>
      ) : null}
      {valid && !inside && !refused ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            admit.mutate({
              eventId,
              ticketNumber: ticket.ticketNumber,
              deviceLabel: DEVICE,
            })
          }
        >
          Let in
        </Button>
      ) : null}
      {inside && (manager || ticket.admittedByMe) ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => undo.mutate(target)}
        >
          Undo admission
        </Button>
      ) : null}
      {inside ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => left.mutate({ ...target, deviceLabel: DEVICE })}
        >
          Mark as left
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setForm("note")}
      >
        Add a note
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => open?.(orderDialog(live, ticket))}
      >
        Open the order
      </Button>
      {valid && !refused ? (
        <Button
          size="sm"
          variant="outline"
          className="ml-auto text-red-400 hover:text-red-400"
          disabled={busy}
          onClick={() => setForm("refuse")}
        >
          Refuse
        </Button>
      ) : null}
    </div>
  );
}

/** One scanner's night: a person on a device, as the door card lists them. */
export function ScannerDialog({
  eventId,
  timezone,
  userId,
  deviceLabel,
  name,
}: LiveDialogProps & {
  userId: string | null;
  deviceLabel: string | null;
  name: string;
}) {
  const detail = api.ticketAnalytics.scannerDetail.useQuery(
    { eventId, userId, deviceLabel },
    { refetchInterval: 10_000 },
  );
  const data = detail.data;
  const now = useNow(30_000);
  const time = (at: Date) => formatEventTime(at, timezone);

  // Every five minutes from their first admission to now, quiet ones too.
  const SLOT_MS = 5 * 60 * 1000;
  const counts = new Map(
    (data?.buckets ?? []).map((row) => [row.bucket.getTime(), row.count]),
  );
  const first = data?.buckets[0]?.bucket.getTime();
  const slots: number[] = [];
  if (first !== undefined) {
    for (let at = first; at <= now.getTime(); at += SLOT_MS) {
      slots.push(counts.get(at) ?? 0);
    }
  }

  return (
    <DialogFrame
      title={[name, deviceLabel].filter(Boolean).join(" · ")}
      sub={
        data?.firstAt ? `scanning since ${time(data.firstAt)}` : "no scans yet"
      }
    >
      {!data ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 border-b pb-4 sm:grid-cols-4">
            {[
              ["Let in", data.letIn],
              ["Turned back", data.turnedAway],
              ["Marked as left", data.departed],
              ["Busiest five", Math.max(0, ...slots)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-muted-foreground text-[0.72rem] font-semibold tracking-[0.06em] uppercase">
                  {label}
                </p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          {slots.length > 0 ? (
            <DetailSection
              title="Let in by the five minutes"
              meta="white is the current five"
            >
              <Bars values={slots} markLast className="h-24" />
            </DetailSection>
          ) : null}
          <DetailSection
            title="Their latest scans"
            meta={`the latest ${data.recent.length}`}
          >
            <Timeline
              rows={data.recent.map((row) => ({
                key: row.id,
                at: time(row.createdAt),
                label: [scanResultShort(row.result), row.ticket?.attendeeName]
                  .filter(Boolean)
                  .join(" · "),
                tone: SCAN_TONE[scanResultTone(row.result)],
                right: row.ticket?.ticketNumber,
              }))}
            />
          </DetailSection>
        </>
      )}
    </DialogFrame>
  );
}
