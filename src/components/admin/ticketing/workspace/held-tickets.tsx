"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useConfirm } from "~/components/confirm-provider";
import { formatDateTime } from "~/lib/date-utils";

/**
 * Tickets sitting in somebody's checkout: how many, when each hold lapses, and
 * a way to put them back on sale now instead of waiting.
 */
export function HeldTickets({ eventId }: { eventId: string }) {
  const utils = api.useUtils();
  const confirm = useConfirm();
  const holds = api.ticketAdmin.holds.useQuery(
    { eventId },
    { refetchInterval: 30_000 },
  );
  const now = useNow(15_000);

  const invalidate = () => {
    void utils.ticketAdmin.invalidate();
    void utils.ticketAnalytics.invalidate();
  };

  const expireOne = api.ticketAdmin.expireOrder.useMutation({
    onSuccess: () => {
      toast.success("Hold released. The seats are back on sale.");
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const expireAll = api.ticketAdmin.expireHolds.useMutation({
    onSuccess: ({ expired, paid }) => {
      toast.success(
        paid > 0
          ? `Released ${expired}. ${paid} had already paid and will be issued.`
          : `Released ${expired}. The seats are back on sale.`,
      );
      invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      invalidate();
    },
  });

  const orders = holds.data ?? [];
  const tickets = orders.reduce((sum, order) => sum + order.tickets, 0);
  const busy = expireOne.isPending || expireAll.isPending;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground font-medium">Held</span>{" "}
          <span className="ml-1 text-xl font-semibold tabular-nums">
            {tickets}
          </span>{" "}
          <span className="text-muted-foreground">
            {tickets === 1 ? "ticket" : "tickets"} in {orders.length}{" "}
            {orders.length === 1 ? "checkout" : "checkouts"}
          </span>
        </p>
        {orders.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: `Release ${tickets} held ${tickets === 1 ? "ticket" : "tickets"}?`,
                description:
                  "Anyone still in checkout loses their seats and can't finish paying. Buyers who have already paid keep theirs.",
                confirmLabel: "Release all",
                variant: "destructive",
              });
              if (ok) expireAll.mutate({ eventId });
            }}
          >
            {expireAll.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Expire all now
          </Button>
        ) : null}
      </div>

      {orders.length > 0 ? (
        <ul className="mt-3 divide-y text-sm">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate">
                  <span className="font-mono font-medium">
                    {order.orderNumber}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {order.tickets} ·{" "}
                    {order.buyerName ?? order.buyerEmail ?? "No details yet"}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className="text-muted-foreground tabular-nums"
                  title={
                    order.expiresAt
                      ? formatDateTime(order.expiresAt)
                      : undefined
                  }
                >
                  {expiresIn(order.expiresAt, now)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Expire this held order?",
                      description:
                        "Cancels the checkout and puts its seats back on sale. The buyer can no longer pay for it.",
                      confirmLabel: "Expire order",
                      variant: "destructive",
                    });
                    if (ok) expireOne.mutate({ orderId: order.id });
                  }}
                >
                  Expire
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "expires in 8m", or "releasing" once lapsed and waiting on the sweep. */
function expiresIn(expiresAt: Date | null, now: number): string {
  if (!expiresAt) return "no expiry";
  const minutes = Math.ceil((expiresAt.getTime() - now) / 60_000);
  if (minutes <= 0) return "releasing";
  if (minutes < 60) return `expires in ${minutes}m`;
  return `expires in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** The current time, refreshed every `intervalMs` so countdowns move. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
