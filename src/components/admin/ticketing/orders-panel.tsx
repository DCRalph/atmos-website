"use client";

import { useState } from "react";
import { Copy, Link2, Mail, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { useConfirm } from "~/components/confirm-provider";
import { formatNZD } from "~/lib/ticketing/money";
import {
  DEFAULT_EVENT_TIMEZONE,
  formatEventDateTime,
} from "~/lib/ticketing/dates";

/** Orders, and the support actions that get run on them. */
export function OrdersPanel({
  eventId,
  readOnly = false,
}: {
  eventId: string;
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const orders = api.ticketAdmin.orders.useQuery({
    eventId,
    search: search || undefined,
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Order number, name or email"
          className="pl-9"
        />
      </div>

      {orders.isPending && <Skeleton className="h-64 w-full" />}

      {orders.data?.orders.length === 0 && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          No orders yet.
        </p>
      )}

      <div className="space-y-2">
        {orders.data?.orders.map((order) => (
          <div key={order.id} className="rounded-lg border">
            <button
              type="button"
              className="hover:bg-accent/40 flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors"
              onClick={() =>
                setOpenOrderId(openOrderId === order.id ? null : order.id)
              }
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {order.orderNumber}
                  </span>
                  <Badge
                    variant={
                      order.status === "PAID"
                        ? "default"
                        : order.status === "REFUNDED" ||
                            order.status === "PARTIALLY_REFUNDED"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {order.status.replace("_", " ").toLowerCase()}
                  </Badge>
                  <Badge variant="outline">
                    {order.paymentMethod.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {order.buyerName ?? "No name"} ·{" "}
                  {order.buyerEmail ?? "no email"} · {order._count.tickets}{" "}
                  ticket
                  {order._count.tickets === 1 ? "" : "s"}
                </p>
              </div>

              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {formatNZD(order.totalCents)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatEventDateTime(order.createdAt, DEFAULT_EVENT_TIMEZONE)}
                </p>
              </div>
            </button>

            {openOrderId === order.id && (
              <OrderDetail orderId={order.id} readOnly={readOnly} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderDetail({
  orderId,
  readOnly,
}: {
  orderId: string;
  readOnly: boolean;
}) {
  const utils = api.useUtils();
  const confirm = useConfirm();
  const order = api.ticketAdmin.order.useQuery({ id: orderId });
  const [selected, setSelected] = useState<string[]>([]);

  const refund = api.ticketAdmin.refundTickets.useMutation({
    onSuccess: () => {
      toast.success("Refunded — tickets voided and the buyer notified.");
      setSelected([]);
      void utils.ticketAdmin.invalidate();
      void utils.ticketAnalytics.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resend = api.ticketAdmin.resendTickets.useMutation({
    onSuccess: () => toast.success("Sent."),
    onError: (error) => toast.error(error.message),
  });

  const rotate = api.ticketAdmin.rotateAccessLink.useMutation({
    onSuccess: (result) => {
      toast.success("Old link revoked.");
      void navigator.clipboard.writeText(result.ticketsUrl);
      void utils.ticketAdmin.order.invalidate({ id: orderId });
    },
  });

  if (order.isPending) {
    return <Skeleton className="m-4 h-40" />;
  }
  if (!order.data) return null;

  const data = order.data;
  const supportUrl = data.ticketsUrl;

  return (
    <div className="space-y-4 border-t p-4">
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <dl className="space-y-1">
          <Row label="Tickets" value={formatNZD(data.subtotalCents)} />
          {data.discountCents > 0 && (
            <Row label="Discount" value={`−${formatNZD(data.discountCents)}`} />
          )}
          {data.bookingFeeCents > 0 && (
            <Row label="Booking fee" value={formatNZD(data.bookingFeeCents)} />
          )}
          <Row label="Total" value={formatNZD(data.totalCents)} />
          <Row label="GST included" value={formatNZD(data.gstCents)} />
          {data.refundedCents > 0 && (
            <Row label="Refunded" value={formatNZD(data.refundedCents)} />
          )}
        </dl>

        <div className="space-y-2">
          {!readOnly && supportUrl && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={resend.isPending || !data.buyerEmail}
                onClick={() => resend.mutate({ orderId })}
              >
                <Mail className="size-3.5" /> Resend tickets
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(supportUrl);
                  toast.success("Ticket link copied.");
                }}
              >
                <Copy className="size-3.5" /> Copy link
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rotate.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Revoke the current ticket link?",
                    description:
                      "The old link stops working immediately. A new one is copied to your clipboard — send it to the buyer.",
                    confirmLabel: "Revoke and replace",
                    variant: "destructive",
                  });
                  if (ok) rotate.mutate({ orderId });
                }}
              >
                <Link2 className="size-3.5" /> Rotate link
              </Button>
            </div>
          )}
          {data.notes && (
            <p className="text-muted-foreground text-xs whitespace-pre-line">
              {data.notes}
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Tickets</p>
        <ul className="divide-y rounded-md border">
          {data.tickets.map((ticket) => {
            const admitted = ticket.scans.find(
              (scan) =>
                scan.result === "ADMITTED" ||
                scan.result === "OVERRIDE_ADMITTED" ||
                scan.result === "REENTRY",
            );
            return (
              <li
                key={ticket.id}
                className="flex flex-wrap items-center gap-3 p-3 text-sm"
              >
                {!readOnly && (
                  <input
                    type="checkbox"
                    className="size-4"
                    disabled={ticket.status !== "VALID"}
                    checked={selected.includes(ticket.id)}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, ticket.id]
                          : current.filter((id) => id !== ticket.id),
                      )
                    }
                    aria-label={`Select ${ticket.ticketNumber}`}
                  />
                )}
                <span className="font-mono text-xs">{ticket.ticketNumber}</span>
                <span className="min-w-0 flex-1 truncate">
                  {ticket.attendeeName ?? "—"} · {ticket.tier.name}
                </span>
                {ticket.status !== "VALID" && (
                  <Badge variant="destructive">
                    {ticket.status.toLowerCase()}
                  </Badge>
                )}
                {admitted && <Badge variant="secondary">admitted</Badge>}
              </li>
            );
          })}
        </ul>
      </div>

      {!readOnly && selected.length > 0 && (
        <Button
          variant="destructive"
          disabled={refund.isPending}
          onClick={async () => {
            const ok = await confirm({
              title: `Refund ${selected.length} ticket${selected.length === 1 ? "" : "s"}?`,
              description:
                "Refunds through Stripe, voids the QR codes immediately, puts the seats back on sale, and emails the buyer.",
              confirmLabel: "Refund",
              variant: "destructive",
            });
            if (ok) refund.mutate({ orderId, ticketIds: selected });
          }}
        >
          <Undo2 className="size-4" /> Refund selected
        </Button>
      )}

      {data.emails.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer">
            Email log ({data.emails.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {data.emails.map((email) => (
              <li key={email.id} className="text-muted-foreground text-xs">
                {email.createdAt.toLocaleString("en-NZ")} · {email.type} ·{" "}
                {email.toEmail} ·{" "}
                <span
                  className={
                    email.status === "sent"
                      ? "text-emerald-600"
                      : "text-red-600"
                  }
                >
                  {email.status}
                </span>
                {email.error ? ` — ${email.error}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
