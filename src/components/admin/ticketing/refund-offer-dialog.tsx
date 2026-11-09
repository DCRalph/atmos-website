"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { useConfirm } from "~/components/confirm-provider";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { formatNZD } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";

type Target =
  | { orderId: string; buyerName: string | null }
  | { eventId: string; eventName: string };

type Amount = "everything" | "ticketsOnly";

/**
 * Offer a refund the buyer takes themselves: on one order (from the order
 * dialog) or on every paid order with a ticket on chosen tiers (from the
 * event menu). Nothing is refunded until a buyer takes it.
 */
export function RefundOfferDialog({
  target,
  open,
  onOpenChange,
}: {
  target: Target;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so every visit starts clean. */}
        {open && (
          <OfferForm target={target} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OfferForm({ target, onDone }: { target: Target; onDone: () => void }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const isEvent = "eventId" in target;
  const firstName =
    !isEvent && target.buyerName ? target.buyerName.split(" ")[0] : null;

  const event = api.refundOffers.forEvent.useQuery(
    { eventId: isEvent ? target.eventId : "" },
    { enabled: isEvent },
  );
  const orderExpiry = api.refundOffers.defaultExpiry.useQuery(
    { orderId: isEvent ? "" : target.orderId },
    { enabled: !isEvent },
  );

  const [tierIds, setTierIds] = useState<string[] | null>(null);
  const [amount, setAmount] = useState<Amount>("everything");
  const [message, setMessage] = useState(firstName ? `Hi ${firstName}, ` : "");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  // Every tier with something to offer starts ticked.
  const tiers = event.data?.tiers ?? [];
  const chosenTiers =
    tierIds ?? tiers.filter((tier) => tier.orders > 0).map((tier) => tier.id);
  const closes = expiresAt ?? event.data?.defaultExpiresAt ?? orderExpiry.data;

  const offerTarget = isEvent
    ? { eventId: target.eventId, tierIds: chosenTiers }
    : { orderId: target.orderId };
  const ready = !isEvent || chosenTiers.length > 0;
  const preview = api.refundOffers.preview.useQuery(
    { target: offerTarget },
    { enabled: ready },
  );

  const onError = (error: { message: string }) => toast.error(error.message);
  const sendTest = api.refundOffers.sendTest.useMutation({
    onSuccess: ({ to }) => toast.success(`Test sent to ${to}`),
    onError,
  });
  const offer = api.refundOffers.offer.useMutation({
    onSuccess: ({ offered, emailed }) => {
      toast.success(
        emailed === offered
          ? `Offered and emailed to ${offered} ${offered === 1 ? "buyer" : "buyers"}`
          : `Offered to ${offered}, but ${offered - emailed} emails did not send. Resend them from each order.`,
      );
      void utils.ticketAdmin.invalidate();
      void utils.refundOffers.invalidate();
      onDone();
    },
    onError,
  });

  const orders = preview.data?.orders ?? 0;
  const maxCents =
    amount === "everything"
      ? (preview.data?.everythingCents ?? 0)
      : (preview.data?.ticketsOnlyCents ?? 0);
  const canSend =
    ready && orders > 0 && message.trim().length > 0 && closes !== undefined;
  const input = () => ({
    target: offerTarget,
    amount,
    message,
    expiresAt: closes ?? new Date(),
  });
  const who = isEvent
    ? `${orders} ${orders === 1 ? "buyer" : "buyers"}`
    : (firstName ?? "the buyer");

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSend) return;
        const ok = await confirm({
          title: `Email ${who}?`,
          description:
            isEvent && orders > 1
              ? `Up to ${formatNZD(maxCents)} between them if every one is taken. Whoever takes it, their tickets stop working.`
              : `${formatNZD(maxCents)} back if they take it, and their tickets stop working.`,
          confirmLabel: `Email ${who}`,
        });
        if (ok) offer.mutate(input());
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {isEvent ? `Offer refunds for ${target.eventName}` : "Offer a refund"}
        </DialogTitle>
        <DialogDescription>
          {isEvent
            ? "Each buyer gets their own email and link. Nothing is refunded until they take it."
            : `${firstName ?? "The buyer"} gets this by email and can take it until it closes. Nothing is refunded until they do.`}
        </DialogDescription>
      </DialogHeader>

      {isEvent && (
        <div className="space-y-2">
          <Label>Who</Label>
          {tiers.map((tier) => (
            <label
              key={tier.id}
              className={cn(
                "flex items-center gap-2 text-sm",
                tier.orders === 0 && "text-muted-foreground",
              )}
            >
              <Checkbox
                checked={chosenTiers.includes(tier.id)}
                disabled={tier.orders === 0}
                onCheckedChange={(checked) =>
                  setTierIds(
                    checked
                      ? [...chosenTiers, tier.id]
                      : chosenTiers.filter((id) => id !== tier.id),
                  )
                }
              />
              {tier.name}
              <span className="text-muted-foreground ml-auto tabular-nums">
                {tier.orders} {tier.orders === 1 ? "order" : "orders"}
              </span>
            </label>
          ))}
          <p className="text-muted-foreground text-xs">
            Only card orders with a ticket still valid. Comps, door sales,
            refunded orders and orders with an open offer are left out.
            {event.data && event.data.offered > 0
              ? ` ${event.data.offered} offered so far, ${event.data.taken} taken.`
              : ""}
          </p>
        </div>
      )}

      <div className="space-y-2" role="radiogroup" aria-label="Amount">
        <Label>Amount</Label>
        {(
          [
            {
              value: "everything",
              label: "Everything they paid",
              hint: "Tickets and booking fees",
              cents: preview.data?.everythingCents,
            },
            {
              value: "ticketsOnly",
              label: "Tickets only",
              hint: "Keeps the booking fees",
              cents: preview.data?.ticketsOnlyCents,
            },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={amount === option.value}
            onClick={() => setAmount(option.value)}
            className={cn(
              "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm",
              amount === option.value
                ? "border-foreground/40"
                : "border-border",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0 rounded-full border",
                amount === option.value
                  ? "border-foreground border-[5px]"
                  : "border-muted-foreground",
              )}
            />
            <span className="min-w-0">
              {option.label}
              <span className="text-muted-foreground block text-xs">
                {option.hint}
              </span>
            </span>
            <span className="ml-auto tabular-nums">
              {option.cents === undefined ? "" : formatNZD(option.cents)}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="offer-message">Message</Label>
        <Textarea
          id="offer-message"
          rows={4}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Vol. 3 has moved to Saturday 14 March. If you can't make the new date, you can have your money back."
        />
        <p className="text-muted-foreground text-xs">
          Shown in the email above the refund button, signed with your first
          name.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Open until</Label>
        <DateTimePicker date={closes} onDateChange={setExpiresAt} />
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={!canSend || sendTest.isPending}
          onClick={() => sendTest.mutate(input())}
        >
          Send a test to me
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSend || offer.isPending}>
            Email {who}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
