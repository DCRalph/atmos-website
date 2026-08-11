"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Gift, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { formatNZD } from "~/lib/ticketing/money";

type PaymentMethod = "CASH" | "TERMINAL" | "COMP";

const METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote, managerOnly: false },
  { value: "TERMINAL", label: "Card", icon: CreditCard, managerOnly: false },
  { value: "COMP", label: "Comp", icon: Gift, managerOnly: true },
] as const satisfies readonly {
  value: PaymentMethod;
  label: string;
  icon: typeof Banknote;
  managerOnly: boolean;
}[];

/**
 * Selling to somebody standing at the door with no ticket.
 *
 * The money has already changed hands by the time this is used — the staffer
 * has taken the cash or run the card on a terminal — so this is a record of a
 * sale, not a checkout. That's why there's no payment form and why it admits
 * them in the same breath by default: the person is walking in as it's tapped.
 *
 * Nothing personal is required. A name and email are there for the buyer who
 * wants their ticket emailed, and that's the only reason to ask.
 */
export function SellPanel({
  eventId,
  deviceLabel,
  isManager,
  onSold,
}: {
  eventId: string;
  deviceLabel: string;
  isManager: boolean;
  onSold: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [admitNow, setAdmitNow] = useState(true);
  const [receipt, setReceipt] = useState<{
    orderNumber: string;
    ticketCount: number;
    totalCents: number;
    method: PaymentMethod;
    admitted: boolean;
  } | null>(null);

  const tiers = api.door.sellableTiers.useQuery({ eventId });

  const lines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([tierId, quantity]) => ({ tierId, quantity })),
    [quantities],
  );

  const totalCents = useMemo(() => {
    if (method === "COMP") return 0;
    return lines.reduce((sum, line) => {
      const tier = tiers.data?.find((entry) => entry.id === line.tierId);
      return sum + (tier?.priceCents ?? 0) * line.quantity;
    }, 0);
  }, [lines, tiers.data, method]);

  const ticketCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const sell = api.door.sellAtDoor.useMutation({
    onSuccess: (result) => {
      setReceipt({
        orderNumber: result.orderNumber,
        ticketCount: result.ticketCount,
        totalCents,
        method,
        admitted: result.admittedNow,
      });
      setQuantities({});
      setBuyerName("");
      setBuyerEmail("");
      onSold();
    },
    onError: (error) => toast.error(error.message),
  });

  if (receipt) {
    return (
      <Receipt
        receipt={receipt}
        onDone={() => setReceipt(null)}
      />
    );
  }

  if (tiers.isPending) return <Skeleton className="h-64 w-full" />;

  const available = (tiers.data ?? []).filter((tier) => tier.remaining > 0);
  const methods = METHODS.filter((entry) => isManager || !entry.managerOnly);

  return (
    <div className="space-y-5">
      {available.length === 0 ? (
        <p className="border-2 border-white/10 p-6 text-center text-sm text-white/40">
          Nothing left to sell — every tier is out of stock.
        </p>
      ) : (
        <ul className="divide-y-2 divide-white/5 border-2 border-white/10">
          {available.map((tier) => {
            const quantity = quantities[tier.id] ?? 0;
            return (
              <li key={tier.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tier.name}</p>
                  <p className="text-xs text-white/40">
                    {tier.priceCents === 0
                      ? "Free"
                      : formatNZD(tier.priceCents)}{" "}
                    · {tier.remaining} left
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
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
                  <span
                    className="w-8 text-center tabular-nums"
                    aria-live="polite"
                    aria-label={`${quantity} ${tier.name}`}
                  >
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={`One more ${tier.name}`}
                    disabled={quantity >= Math.min(tier.remaining, 20)}
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
              </li>
            );
          })}
        </ul>
      )}

      {ticketCount > 0 && (
        <div className="space-y-5 border-t-2 border-white/10 pt-5">
          <div>
            <p className="text-xs tracking-[0.14em] text-white/40 uppercase">
              How did they pay?
            </p>
            <div
              className="mt-2 grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))`,
              }}
            >
              {methods.map((entry) => {
                const Icon = entry.icon;
                const active = method === entry.value;
                return (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => setMethod(entry.value)}
                    aria-pressed={active}
                    className={`flex h-14 items-center justify-center gap-2 border-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-white bg-white text-black"
                        : "border-white/15 text-white/60"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                    {entry.label}
                  </button>
                );
              })}
            </div>
            {method === "COMP" && (
              <p className="mt-2 text-xs text-amber-300">
                Comped — no money taken, and it&apos;s logged against your name.
              </p>
            )}
          </div>

          <div className="flex items-baseline justify-between border-y-2 border-white/10 py-3 text-lg font-bold">
            <span>{ticketCount === 1 ? "1 ticket" : `${ticketCount} tickets`}</span>
            <span className="tabular-nums">
              {method === "COMP" ? "Free" : formatNZD(totalCents)}
            </span>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-white/50">
              Email them a copy (optional)
            </summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-name">Name</Label>
                <Input
                  id="sale-name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="h-12 bg-white/5"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-email">Email</Label>
                <Input
                  id="sale-email"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="h-12 bg-white/5"
                  autoComplete="off"
                />
              </div>
            </div>
          </details>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={admitNow}
              onChange={(e) => setAdmitNow(e.target.checked)}
              className="size-4 accent-white"
            />
            Let them in now
          </label>

          <Button
            type="button"
            size="lg"
            className="h-16 w-full text-base"
            disabled={sell.isPending}
            onClick={() =>
              sell.mutate({
                eventId,
                lines,
                paymentMethod: method,
                buyerName: buyerName.trim() || undefined,
                buyerEmail: buyerEmail.trim() || undefined,
                deviceLabel: deviceLabel || undefined,
                admitNow,
              })
            }
          >
            {sell.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Issuing…
              </>
            ) : method === "COMP" ? (
              `Comp ${ticketCount === 1 ? "a ticket" : `${ticketCount} tickets`}`
            ) : (
              `Took ${formatNZD(totalCents)} — issue ${ticketCount === 1 ? "ticket" : "tickets"}`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function Receipt({
  receipt,
  onDone,
}: {
  receipt: {
    orderNumber: string;
    ticketCount: number;
    totalCents: number;
    method: PaymentMethod;
    admitted: boolean;
  };
  onDone: () => void;
}) {
  return (
    <div className="border-2 border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
      <p className="text-2xl font-black tracking-tight text-emerald-100">
        {receipt.admitted ? "Sold and in" : "Sold"}
      </p>
      <p className="mt-2 text-sm text-emerald-100/80">
        {receipt.ticketCount === 1
          ? "1 ticket"
          : `${receipt.ticketCount} tickets`}{" "}
        ·{" "}
        {receipt.method === "COMP"
          ? "comped"
          : `${formatNZD(receipt.totalCents)} ${receipt.method === "CASH" ? "cash" : "card"}`}
      </p>
      <p className="mt-1 font-mono text-xs text-emerald-100/60">
        Order {receipt.orderNumber}
      </p>
      <p className="mt-4 text-sm text-emerald-100/70">
        {receipt.admitted
          ? "They're counted as inside. Find them in the list if that was wrong."
          : "Not admitted yet — scan them or admit from the list."}
      </p>

      <Button
        type="button"
        size="lg"
        className="mt-6 h-14 w-full text-base"
        onClick={onDone}
      >
        Next sale
      </Button>
    </div>
  );
}
