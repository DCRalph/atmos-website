"use client";

import { useState } from "react";
import { Copy, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatNZD } from "~/lib/ticketing/money";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];

/**
 * Box office.
 *
 * Cash on the night, an eftpos tap, or a comp for the promoter's mate — all of
 * it goes through the same inventory and issuance path as an online sale, so
 * the door list, the scan log and the analytics stay honest.
 */
export function BoxOfficePanel({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Comps are not a payment method: they are minted rather than sold, so they
  // live on the Comps tab where a level is picked instead of a tier.
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TERMINAL">(
    "CASH",
  );
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [lastSale, setLastSale] = useState<{
    orderNumber: string;
    ticketsUrl: string;
  } | null>(null);

  const sell = api.ticketAdmin.boxOfficeSale.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.ticketCount} ticket(s) issued.`);
      setLastSale({
        orderNumber: result.orderNumber,
        ticketsUrl: result.ticketsUrl,
      });
      setQuantities({});
      setBuyerName("");
      setBuyerEmail("");
      setNotes("");
      void utils.ticketEvents.byId.invalidate();
      void utils.ticketAnalytics.invalidate();
      void utils.ticketAdmin.orders.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const lines = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([tierId, quantity]) => ({ tierId, quantity }));

  const total = lines.reduce((sum, line) => {
    const tier = event.tiers.find((t) => t.id === line.tierId);
    return sum + (tier?.priceCents ?? 0) * line.quantity;
  }, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Box office</h2>
        <p className="text-muted-foreground text-sm">
          Issue tickets at the door. Booking fees never apply here.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        {event.tiers.map((tier) => {
          const quantity = quantities[tier.id] ?? 0;
          const remaining = Math.max(
            0,
            tier.allocation - tier.soldCount - tier.heldCount,
          );
          return (
            <div key={tier.id} className="flex items-center gap-3 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{tier.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatNZD(tier.priceCents)} · {remaining} left
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`One fewer ${tier.name}`}
                  disabled={quantity === 0}
                  onClick={() =>
                    setQuantities((current) => ({
                      ...current,
                      [tier.id]: quantity - 1,
                    }))
                  }
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center tabular-nums">{quantity}</span>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`One more ${tier.name}`}
                  disabled={quantity >= remaining}
                  onClick={() =>
                    setQuantities((current) => ({
                      ...current,
                      [tier.id]: quantity + 1,
                    }))
                  }
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Payment</Label>
          <Select
            value={paymentMethod}
            onValueChange={(value) =>
              setPaymentMethod(value as "CASH" | "TERMINAL")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="TERMINAL">Card / eftpos</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Giving one away? That&apos;s the Comps tab — it mints a ticket at
            any level instead of taking one from a tier.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bo-name">Name</Label>
          <Input
            id="bo-name"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Who's it for"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bo-email">Email</Label>
          <Input
            id="bo-email"
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="Optional — leave blank for a walk-up"
          />
          <p className="text-muted-foreground text-xs">
            With an email we send the ticket. Without one, hand them the link
            below or just scan them straight in.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bo-notes">Notes</Label>
          <Textarea
            id="bo-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Guest of the promoter, paid $40 cash, etc."
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <p className="text-muted-foreground text-sm">To collect</p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatNZD(total)}
          </p>
        </div>
        <Button
          size="lg"
          disabled={lines.length === 0 || sell.isPending}
          onClick={() =>
            sell.mutate({
              eventId: event.id,
              lines,
              paymentMethod,
              buyerName: buyerName || undefined,
              buyerEmail: buyerEmail || undefined,
              notes: notes || undefined,
              sendEmail: Boolean(buyerEmail),
            })
          }
        >
          {sell.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Issuing…
            </>
          ) : (
            "Issue tickets"
          )}
        </Button>
      </div>

      {lastSale && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div>
            <p className="font-mono text-sm font-semibold">
              {lastSale.orderNumber}
            </p>
            <p className="text-muted-foreground text-xs">
              Issued. Open the link to show them their QR code.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(lastSale.ticketsUrl);
                toast.success("Copied.");
              }}
            >
              <Copy className="size-3.5" /> Copy link
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={lastSale.ticketsUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
