"use client";

import Link from "next/link";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { OrderDetail } from "~/components/admin/ticketing/orders-panel";
import { HeldTickets } from "~/components/admin/ticketing/workspace/held-tickets";
import { sourceLabel } from "~/lib/ticketing/campaigns";
import { eventDayKey, formatTimeAgo } from "~/lib/ticketing/dates";
import { DAY_MS } from "~/lib/ticketing/lead-time";
import { formatNZD, formatNZDWhole } from "~/lib/ticketing/money";
import { type LiveDialogProps } from "./context";
import { Bars, DetailSection, KeyValues, useNow } from "./parts";
import { DialogFrame, useCloseRowDialog, useOpenRowDialog } from "./row-dialog";

/**
 * What the sales screen's rows open: an order, the approval queue, the
 * tickets on hold and a tier. The order and the holds are the admin's own
 * panels, so everything they can do there they can do from here.
 */

/** One order in full. Admins can act on it; anyone else just reads. */
export function LiveOrderDialog({
  orderId,
  ...live
}: LiveDialogProps & { orderId: string }) {
  const open = useOpenRowDialog();
  const close = useCloseRowDialog();
  const order = api.ticketAdmin.order.useQuery({ id: orderId });

  return (
    <DialogFrame
      title={
        <span className="font-mono">{order.data?.orderNumber ?? "Order"}</span>
      }
      sub={
        order.data
          ? `${order.data.buyerName ?? "No name"} · ${order.data.buyerEmail ?? "no email"}`
          : undefined
      }
    >
      <OrderDetail
        key={orderId}
        orderId={orderId}
        readOnly={!live.access.admin}
        onDeleted={close}
        onOpenOrder={(id) =>
          open?.({
            label: "Order",
            content: <LiveOrderDialog {...live} orderId={id} />,
          })
        }
      />
    </DialogFrame>
  );
}

/** Guest list requests waiting on a yes or no, oldest first. */
export function ApprovalsDialog({ eventId }: LiveDialogProps) {
  const utils = api.useUtils();
  const approvals = api.ticketAdmin.pendingApprovals.useQuery(
    { eventId },
    { refetchInterval: 15_000 },
  );
  const decide = api.ticketAdmin.decideApproval.useMutation({
    onSuccess: (result) => {
      toast.success(result.approved ? "Approved and emailed." : "Declined.");
      void utils.ticketAdmin.pendingApprovals.invalidate();
      void utils.ticketAnalytics.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const rows = approvals.data ?? [];

  return (
    <DialogFrame
      title="Waiting for approval"
      sub={
        approvals.data
          ? `${rows.length} guest list ${rows.length === 1 ? "request" : "requests"}`
          : undefined
      }
    >
      {approvals.isPending ? (
        <Skeleton className="h-24" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">Nothing waiting.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t py-3 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {row.buyerName ?? "No name"}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · asked {formatTimeAgo(row.createdAt)}
                  </span>
                </p>
                <p className="text-muted-foreground truncate">
                  {row.items
                    .map((item) => `${item.quantity} × ${item.tier.name}`)
                    .join(", ")}
                  {row.buyerEmail ? ` · ${row.buyerEmail}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ orderId: row.id, approve: true })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ orderId: row.id, approve: false })
                  }
                >
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DialogFrame>
  );
}

/** The checkouts holding tickets, with a way to put them back on sale. */
export function HoldsDialog({ eventId }: LiveDialogProps) {
  return (
    <DialogFrame
      title="Tickets on hold"
      sub="in somebody's checkout, held until they pay or run out of time"
    >
      <HeldTickets eventId={eventId} />
    </DialogFrame>
  );
}

/** One tier: where it stands, its last seven days, and how its buyers bought. */
export function TierDialog({
  eventId,
  access,
  tierId,
}: LiveDialogProps & { tierId: string }) {
  const tier = api.ticketAnalytics.tierDetail.useQuery(
    { eventId, tierId },
    { refetchInterval: 30_000 },
  );
  const data = tier.data;
  const now = useNow(60_000);

  if (!data) {
    return (
      <DialogFrame title="Tier">
        <Skeleton className="h-40" />
      </DialogFrame>
    );
  }

  // The last seven of the event's own days, oldest first, quiet ones too.
  const byDay = new Map(data.days.map((row) => [row.day, row.tickets]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const at = new Date(now.getTime() - (6 - i) * DAY_MS);
    return { at, tickets: byDay.get(eventDayKey(at, data.timezone)) ?? 0 };
  });
  const weekTickets = week.reduce((sum, day) => sum + day.tickets, 0);
  const aDay = weekTickets / 7;
  const onSale = data.allocation + Math.max(0, data.moved);
  const daysLeft = aDay > 0 ? Math.ceil(data.remaining / aDay) : null;

  return (
    <DialogFrame
      title={data.name}
      sub={`${formatNZD(data.priceCents)}${data.isActive ? "" : " · not on sale"}`}
      state={
        data.remaining === 0 ? (
          <span className="text-muted-foreground">Sold out</span>
        ) : daysLeft !== null ? (
          <span className="text-[var(--ticket-series-arrivals)]">
            Selling {aDay.toFixed(1)} a day, so about {daysLeft}{" "}
            {daysLeft === 1 ? "day" : "days"} until it sells out
          </span>
        ) : (
          <span className="text-muted-foreground">
            None sold in the last 7 days
          </span>
        )
      }
      footer={
        access.admin ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/events/${eventId}`}>
              Edit tiers on the event page
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3 border-b pb-4 sm:grid-cols-4">
        {[
          ["Sold", `${data.sold} / ${onSale}`],
          ["On hold", data.held],
          ["Left", data.remaining],
          ["Revenue", formatNZDWhole(data.revenueCents)],
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
      <DetailSection
        title="Sold by day"
        meta={`${weekTickets} in the last 7 days`}
      >
        <Bars
          values={week.map((day) => day.tickets)}
          tone="revenue"
          className="h-24"
        />
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>6 days ago</span>
          <span>today</span>
        </div>
      </DetailSection>
      <DetailSection title="How it's been bought">
        <KeyValues
          className="lg:[mask-image:none] lg:text-sm"
          rows={[
            { key: "orders", label: "Orders", value: String(data.orders) },
            {
              key: "each",
              label: "Tickets an order",
              value:
                data.orders > 0
                  ? (data.ticketsBought / data.orders).toFixed(1)
                  : "–",
            },
            {
              key: "codes",
              label: "Bought with a code",
              value: `${data.ordersWithCode} of ${data.orders} orders`,
            },
            {
              key: "source",
              label: "Most came from",
              value: data.topSource
                ? `${sourceLabel(data.topSource.source, data.topSource.medium)} · ${data.topSource.orders} orders`
                : "–",
            },
          ]}
        />
      </DetailSection>
    </DialogFrame>
  );
}
