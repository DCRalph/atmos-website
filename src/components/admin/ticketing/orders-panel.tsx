"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Copy,
  Link2,
  Mail,
  Search,
  TimerOff,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { skipToken } from "@tanstack/react-query";

import type { PaymentMethodKind } from "~Prisma/client";
import { api, type RouterOutputs } from "~/trpc/react";
import { formatDateTime } from "~/lib/date-utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useConfirm } from "~/components/confirm-provider";
import { DetailRow, ExternalAnchor } from "~/components/admin/detail-row";
import { formatNZD } from "~/lib/ticketing/money";
import { deviceLabel } from "~/lib/ticketing/devices";
import {
  PAYMENT_METHODS,
  paidWithLabel,
  paymentMethodLabel,
} from "~/lib/ticketing/payment-methods";
import { InfiniteScrollTrigger } from "~/components/infinite-scroll-trigger";
import { FilterSelect, ListFilters } from "../list-filters";
import { OrderTimeline } from "./order-timeline";
import { TicketAccessLevelSelect } from "~/components/admin/ticketing/access-level-select";
import { ticketTypeName } from "~/lib/ticketing/access-levels";
import { useAccessLevels } from "~/hooks/use-access-levels";
import {
  DEFAULT_EVENT_TIMEZONE,
  formatEventDateTime,
} from "~/lib/ticketing/dates";

/** Orders, and the support actions that get run on them. */
type OrderRow = RouterOutputs["ticketAdmin"]["orders"]["orders"][number];

const statusLabel = (status: string) => status.replace("_", " ").toLowerCase();

type OrderFilters = {
  status:
    | "PAID"
    | "PENDING"
    | "AWAITING_APPROVAL"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED"
    | "CANCELLED"
    | "EXPIRED"
    | "FAILED"
    | null;
  paymentMethod: PaymentMethodKind | null;
  names: "COMPLETE" | "MISSING" | null;
  declined: "DECLINED" | null;
};

const NO_ORDER_FILTERS: OrderFilters = {
  status: null,
  paymentMethod: null,
  names: null,
  declined: null,
};

/** What came of a declined card, beside the order's status. */
function declineNote(row: OrderRow): string | null {
  const decline = row.decline;
  if (!decline) return null;
  const declines = row._count.paymentAttempts;
  switch (decline.outcome) {
    case "retried":
      return declines === 1 ? "after a decline" : `after ${declines} declines`;
    case "new_order":
      return `paid on ${decline.nextOrder?.orderNumber ?? "another order"}`;
    case "no_tickets":
      return "paid, no tickets";
    case "lost":
      return "declined";
  }
}

export function OrdersPanel({
  eventId,
  readOnly = false,
}: {
  eventId: string;
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  // `?order=` opens one straight away: the declined payments feed links here.
  const searchParams = useSearchParams();
  const [openOrderId, setOpenOrderId] = useState<string | null>(() =>
    searchParams.get("order"),
  );
  const [filters, setFilters] = useState<OrderFilters>(NO_ORDER_FILTERS);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const set = <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  // Paged, and filtered in the query: every order is reachable by scrolling.
  const orders = api.ticketAdmin.orders.useInfiniteQuery(
    {
      eventId,
      search: search || undefined,
      status: filters.status ?? undefined,
      paymentMethod: filters.paymentMethod ?? undefined,
      names: filters.names ?? undefined,
      declined: filters.declined ? true : undefined,
      limit: 50,
    },
    { getNextPageParam: (page) => page.nextCursor ?? undefined },
  );

  const rows = orders.data?.pages.flatMap((page) => page.orders) ?? [];

  const columns: DataTableColumn<OrderRow>[] = [
    {
      id: "orderNumber",
      header: "Order",
      accessor: (row) => row.orderNumber,
      cell: (row) => (
        <span className="font-mono font-medium">{row.orderNumber}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => statusLabel(row.status),
      cell: (row) => {
        const note = declineNote(row);
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Badge
              variant={
                row.status === "PAID"
                  ? "default"
                  : row.status === "REFUNDED" ||
                      row.status === "PARTIALLY_REFUNDED"
                    ? "destructive"
                    : "outline"
              }
            >
              {statusLabel(row.status)}
            </Badge>
            {note && (
              <span
                className={
                  row.decline?.outcome === "no_tickets"
                    ? "text-destructive text-xs"
                    : "text-muted-foreground text-xs"
                }
              >
                {note}
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: "paymentMethod",
      header: "Payment",
      type: "badge",
      accessor: (row) => row.paymentMethod.toLowerCase(),
      badge: (value) => ({ label: String(value), variant: "outline" }),
    },
    {
      id: "paidWith",
      header: "Paid with",
      accessor: (row) => (row.paidWith ? paidWithLabel(row.paidWith) : ""),
      cell: (row) =>
        row.paidWith ? (
          <Badge variant="outline">{paidWithLabel(row.paidWith)}</Badge>
        ) : null,
    },
    {
      id: "buyer",
      header: "Buyer",
      accessor: (row) => row.buyerName ?? "",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.buyerName ?? "No name"}</p>
          <p className="text-muted-foreground truncate text-xs">
            {row.buyerEmail ?? "no email"}
          </p>
        </div>
      ),
    },
    {
      id: "tickets",
      header: "Tickets",
      type: "number",
      align: "right",
      accessor: (row) => row._count.tickets,
    },
    {
      id: "total",
      header: "Total",
      type: "number",
      align: "right",
      accessor: (row) => row.totalCents,
      cell: (row) => (
        <span className="tabular-nums">{formatNZD(row.totalCents)}</span>
      ),
    },
    {
      id: "createdAt",
      header: "Placed",
      type: "date",
      accessor: (row) => row.createdAt,
      cell: (row) => formatEventDateTime(row.createdAt, DEFAULT_EVENT_TIMEZONE),
    },
  ];

  return (
    <div className="space-y-4">
      <ListFilters
        activeCount={activeFilters}
        onClear={() => setFilters(NO_ORDER_FILTERS)}
        summary={
          orders.isPending
            ? null
            : `${rows.length}${orders.hasNextPage ? "+" : ""} order${
                rows.length === 1 ? "" : "s"
              }`
        }
      >
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => set("status", value)}
          options={[
            { value: "PAID", label: "Paid" },
            { value: "AWAITING_APPROVAL", label: "Awaiting approval" },
            { value: "PENDING", label: "Pending" },
            { value: "REFUNDED", label: "Refunded" },
            { value: "PARTIALLY_REFUNDED", label: "Partly refunded" },
            { value: "CANCELLED", label: "Cancelled" },
            { value: "EXPIRED", label: "Expired" },
            { value: "FAILED", label: "Failed" },
          ]}
        />
        <FilterSelect
          label="Payment"
          value={filters.paymentMethod}
          onChange={(value) => set("paymentMethod", value)}
          options={PAYMENT_METHODS.map((method) => ({
            value: method,
            label: paymentMethodLabel(method),
          }))}
        />
        <FilterSelect
          label="Names"
          value={filters.names}
          onChange={(value) => set("names", value)}
          options={[
            { value: "MISSING", label: "Tickets still unnamed" },
            { value: "COMPLETE", label: "Every ticket named" },
          ]}
        />
        <FilterSelect
          label="Declines"
          value={filters.declined}
          onChange={(value) => set("declined", value)}
          options={[
            { value: "DECLINED", label: "Card declined at least once" },
          ]}
        />
      </ListFilters>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        isLoading={orders.isPending}
        isFetching={orders.isFetching && !orders.isFetchingNextPage}
        onRowClick={(row) => setOpenOrderId(row.id)}
        storageKey="admin-ticket-orders"
        emptyMessage="No orders yet."
        toolbarActions={
          <div className="relative w-full max-w-xs">
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
        }
      />

      <InfiniteScrollTrigger
        hasMore={orders.hasNextPage}
        loading={orders.isFetchingNextPage}
        onLoadMore={() => void orders.fetchNextPage()}
      />

      <OrderDialog
        orderId={openOrderId}
        readOnly={readOnly}
        onClose={() => setOpenOrderId(null)}
        onOpenOrder={setOpenOrderId}
      />
    </div>
  );
}

/**
 * One order, opened from a list: its money, buyer, tickets and the support
 * actions on them. Used by an event's Orders tab and the Payments page.
 * Closed while `orderId` is null. `onOpenOrder` swaps in another order the
 * timeline links to.
 */
export function OrderDialog({
  orderId,
  readOnly = false,
  onClose,
  onOpenOrder,
}: {
  orderId: string | null;
  readOnly?: boolean;
  onClose: () => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const order = api.ticketAdmin.order.useQuery(
    orderId ? { id: orderId } : skipToken,
  );

  return (
    <Dialog open={orderId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {order.data?.orderNumber ?? "Order"}
          </DialogTitle>
          <DialogDescription>
            {order.data ? (
              <>
                {order.data.buyerName ?? "No name"} ·{" "}
                {order.data.buyerEmail ??
                  order.data.decline?.email ??
                  "no email"}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {orderId && (
          <OrderDetail
            key={orderId}
            orderId={orderId}
            readOnly={readOnly}
            onDeleted={onClose}
            onOpenOrder={onOpenOrder}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderDetail({
  orderId,
  readOnly,
  onDeleted,
  onOpenOrder,
}: {
  orderId: string;
  readOnly: boolean;
  onDeleted: () => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const utils = api.useUtils();
  const confirm = useConfirm();
  const order = api.ticketAdmin.order.useQuery({ id: orderId });
  // Only admins get `stripeUrl`, and only they may ask Stripe for the receipt.
  const receipt = api.ticketAdmin.stripeReceiptUrl.useQuery(
    { orderId },
    { enabled: !!order.data?.stripeUrl && !!order.data.stripeChargeId },
  );
  const { level } = useAccessLevels();
  const [selected, setSelected] = useState<string[]>([]);
  // Deleting is superadmin-only; admins refund, void, or expire instead.
  const me = api.user.me.useQuery();
  const canDelete =
    !readOnly &&
    (me.data?.effectivePermissions.includes("SUPERADMIN") ?? false);
  const [deleteReason, setDeleteReason] = useState<string | null>(null);

  const removeOrder = api.ticketAdmin.deleteOrder.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Order deleted${result.tickets > 0 ? ` with ${result.tickets} ticket${result.tickets === 1 ? "" : "s"}` : ""}.`,
      );
      void utils.ticketAdmin.invalidate();
      void utils.ticketEvents.byId.invalidate();
      void utils.ticketAnalytics.invalidate();
      void utils.payments.invalidate();
      onDeleted();
    },
    onError: (error) => toast.error(error.message),
  });

  const refund = api.ticketAdmin.refundTickets.useMutation({
    onSuccess: () => {
      toast.success("Refunded — tickets voided and the buyer notified.");
      setSelected([]);
      void utils.ticketAdmin.invalidate();
      void utils.ticketAnalytics.invalidate();
      void utils.payments.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const refundOrder = api.ticketAdmin.refundOrder.useMutation({
    onSuccess: () => {
      toast.success("Order refunded.");
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

  const expire = api.ticketAdmin.expireOrder.useMutation({
    onSuccess: () => {
      toast.success("Hold released. The seats are back on sale.");
      void utils.ticketAdmin.invalidate();
      void utils.ticketAnalytics.invalidate();
      void utils.payments.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (order.isPending) {
    return <Skeleton className="h-40" />;
  }
  if (!order.data) return null;

  const data = order.data;
  const supportUrl = data.ticketsUrl;
  // Stripe took money and some of it is still ours, tickets or not: a
  // payment that landed after the order failed has none.
  const canRefundOrder =
    !readOnly &&
    !!data.stripeUrl &&
    data.refundedCents < data.totalCents &&
    (!!data.paidAt ||
      data.paymentAttempts.some((attempt) => attempt.status === "SUCCEEDED"));
  const cameFrom = [
    data.utmSource,
    data.utmMedium,
    data.utmCampaign,
    data.utmContent,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <dl className="space-y-1">
          <DetailRow label="Tickets" value={formatNZD(data.subtotalCents)} />
          {data.discountCents > 0 && (
            <DetailRow
              label="Discount"
              value={`−${formatNZD(data.discountCents)}`}
            />
          )}
          {data.venueFeeCents > 0 && (
            <DetailRow
              label="Venue booking fee"
              value={formatNZD(data.venueFeeCents)}
            />
          )}
          {data.bookingFeeCents > 0 && (
            <DetailRow
              label="Booking fee"
              value={formatNZD(data.bookingFeeCents)}
            />
          )}
          <DetailRow label="Total" value={formatNZD(data.totalCents)} />
          <DetailRow label="GST included" value={formatNZD(data.gstCents)} />
          {data.paidWith && (
            <DetailRow
              label="Paid with"
              value={
                <Badge variant="outline">{paidWithLabel(data.paidWith)}</Badge>
              }
            />
          )}
          {data.refundedCents > 0 && (
            <DetailRow label="Refunded" value={formatNZD(data.refundedCents)} />
          )}
          {data.buyerPhone && (
            <DetailRow label="Phone" value={data.buyerPhone} />
          )}
          {data.buyerAddress && (
            <DetailRow label="Address" value={data.buyerAddress} />
          )}
          {data.status === "PENDING" && data.expiresAt && (
            <DetailRow
              label="Held until"
              value={formatDateTime(data.expiresAt)}
            />
          )}
        </dl>

        <div className="space-y-2">
          {!readOnly && data.status === "PENDING" && (
            <Button
              size="sm"
              variant="outline"
              disabled={expire.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Expire this held order?",
                  description:
                    "Cancels the checkout and puts its seats back on sale. The buyer can no longer pay for it.",
                  confirmLabel: "Expire order",
                  variant: "destructive",
                });
                if (ok) expire.mutate({ orderId });
              }}
            >
              <TimerOff className="size-3.5" /> Expire hold
            </Button>
          )}
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

      <dl className="grid gap-x-8 gap-y-1 border-t pt-4 text-sm sm:grid-cols-2">
        {data.device && (
          <DetailRow
            label="Bought on"
            value={deviceLabel(data.device, data.os)}
          />
        )}
        {cameFrom && <DetailRow label="Came from" value={cameFrom} />}
        {data.codeUsed && (
          <DetailRow
            label="Code used"
            value={<span className="font-mono">{data.codeUsed}</span>}
          />
        )}
        {data.soldByName && (
          <DetailRow label="Sold by" value={data.soldByName} />
        )}
        {/* Only checkout asks, so door sales have no answer to show. */}
        {data.termsAcceptedAt && (
          <DetailRow
            label="Marketing"
            value={data.marketingOptIn ? "Opted in" : "No"}
          />
        )}
        {data.termsAcceptedAt && (
          <DetailRow
            label="Terms accepted"
            value={`${formatDateTime(data.termsAcceptedAt)}${data.termsVersion ? ` · ${data.termsVersion}` : ""}`}
          />
        )}
        {data.stripeUrl && (
          <DetailRow
            label="Stripe"
            value={
              <span className="flex gap-3">
                <ExternalAnchor href={data.stripeUrl}>Payment</ExternalAnchor>
                {receipt.data && (
                  <ExternalAnchor href={receipt.data}>Receipt</ExternalAnchor>
                )}
              </span>
            }
          />
        )}
      </dl>

      <div className="border-t pt-4">
        <OrderTimeline order={data} onOpenOrder={onOpenOrder} />
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
                {/* Wraps: this is the dialog somebody opened to read the name
                    on a ticket, so the name has to be all there. */}
                <span className="min-w-0 flex-1 break-words">
                  {ticket.attendeeName ?? "—"} · {ticketTypeName(ticket)}
                </span>
                {ticket.status !== "VALID" && (
                  <Badge variant="destructive">
                    {ticket.status.toLowerCase()}
                  </Badge>
                )}
                {admitted && <Badge variant="secondary">admitted</Badge>}
                {readOnly ? (
                  <Badge variant="outline">
                    {level(ticket.accessLevel).short}
                  </Badge>
                ) : (
                  <TicketAccessLevelSelect
                    ticketId={ticket.id}
                    value={ticket.accessLevel}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {((!readOnly && selected.length > 0) || canRefundOrder) && (
        <div className="flex flex-wrap gap-2">
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
          {canRefundOrder && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={refundOrder.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Refund all of ${data.orderNumber}?`,
                  description:
                    "Refunds everything Stripe still holds for this order, voids any tickets on it, and emails the buyer if we have their email.",
                  confirmLabel: "Refund order",
                  variant: "destructive",
                });
                if (ok) refundOrder.mutate({ orderId });
              }}
            >
              <Undo2 className="size-4" /> Refund order
            </Button>
          )}
        </div>
      )}

      {canDelete &&
        (deleteReason === null ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-muted-foreground text-xs">
              Deleting removes the order and its tickets for good. Nothing is
              refunded, so refund a paid order first.
            </p>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteReason("")}
            >
              <Trash2 className="size-4" /> Delete order
            </Button>
          </div>
        ) : (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="delete-order-reason">
              Why delete {data.orderNumber}?
            </Label>
            <Textarea
              id="delete-order-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              maxLength={200}
              placeholder="Kept in the activity log — it's all that's left afterwards"
              className="min-h-16"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={removeOrder.isPending}
                onClick={() => setDeleteReason(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  removeOrder.isPending || deleteReason.trim().length === 0
                }
                onClick={() =>
                  removeOrder.mutate({ orderId, reason: deleteReason.trim() })
                }
              >
                <Trash2 className="size-4" />
                {removeOrder.isPending ? "Deleting…" : "Delete for good"}
              </Button>
            </div>
          </div>
        ))}

      {data.emails.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer">
            Email log ({data.emails.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {data.emails.map((email) => (
              <li
                key={email.id}
                className="text-muted-foreground text-xs break-words"
              >
                {formatDateTime(email.createdAt)} · {email.type} ·{" "}
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
