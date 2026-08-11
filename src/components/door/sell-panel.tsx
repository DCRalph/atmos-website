"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Gift,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { formatNZD } from "~/lib/ticketing/money";
import {
  ACCESS_LEVELS,
  type AccessLevelValue,
} from "~/lib/ticketing/access-levels";

type PaymentMethod = "CASH" | "TERMINAL";

const METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "TERMINAL", label: "Card", icon: CreditCard },
] as const satisfies readonly {
  value: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}[];

/**
 * Selling to somebody standing at the door with no ticket.
 *
 * The money has already changed hands by the time this is used — the staffer
 * has taken the cash or run the card on a terminal — so this is a record of a
 * sale, not a checkout. That's why there's no payment form and why it admits
 * them in the same breath by default: the person is walking in as it's tapped.
 *
 * Comping is a separate mode rather than a third payment method, because it is
 * a different act: nothing is drawn from a tier, a level is picked directly,
 * and the ticket goes out in somebody's name. Managers only, as before.
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
  const [mode, setMode] = useState<"SELL" | "COMP">("SELL");

  return (
    <div className="space-y-5">
      {isManager && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "SELL", label: "Sell" },
              { value: "COMP", label: "Comp" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setMode(tab.value)}
              aria-pressed={mode === tab.value}
              className={`flex h-12 items-center justify-center gap-2 border-2 text-sm font-semibold transition-colors ${
                mode === tab.value
                  ? "border-white bg-white text-black"
                  : "border-white/15 text-white/60"
              }`}
            >
              {tab.value === "COMP" && <Gift className="size-4" aria-hidden />}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {mode === "COMP" ? (
        <CompForm eventId={eventId} deviceLabel={deviceLabel} onSold={onSold} />
      ) : (
        <SellForm eventId={eventId} deviceLabel={deviceLabel} onSold={onSold} />
      )}
    </div>
  );
}

function SellForm({
  eventId,
  deviceLabel,
  onSold,
}: {
  eventId: string;
  deviceLabel: string;
  onSold: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [admitNow, setAdmitNow] = useState(true);
  const [receipt, setReceipt] = useState<{
    heading: string;
    detail: string;
    reference: string;
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

  const totalCents = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const tier = tiers.data?.find((entry) => entry.id === line.tierId);
        return sum + (tier?.priceCents ?? 0) * line.quantity;
      }, 0),
    [lines, tiers.data],
  );

  const ticketCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const sell = api.door.sellAtDoor.useMutation({
    onSuccess: (result) => {
      setReceipt({
        heading: result.admittedNow ? "Sold and in" : "Sold",
        detail: `${result.ticketCount === 1 ? "1 ticket" : `${result.ticketCount} tickets`} · ${formatNZD(totalCents)} ${method === "CASH" ? "cash" : "card"}`,
        reference: `Order ${result.orderNumber}`,
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
    return <Receipt receipt={receipt} onDone={() => setReceipt(null)} />;
  }

  if (tiers.isPending) return <Skeleton className="h-64 w-full" />;

  const available = (tiers.data ?? []).filter((tier) => tier.remaining > 0);

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
            <div className="mt-2 grid grid-cols-2 gap-2">
              {METHODS.map((entry) => {
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
          </div>

          <div className="flex items-baseline justify-between border-y-2 border-white/10 py-3 text-lg font-bold">
            <span>
              {ticketCount === 1 ? "1 ticket" : `${ticketCount} tickets`}
            </span>
            <span className="tabular-nums">{formatNZD(totalCents)}</span>
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

          <AdmitNow checked={admitNow} onChange={setAdmitNow} />

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
            ) : (
              `Took ${formatNZD(totalCents)} — issue ${ticketCount === 1 ? "ticket" : "tickets"}`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Giving somebody a ticket at the door.
 *
 * No tier list: the ticket is minted, so the only questions are who it's for
 * and what it gets them past. The name is the point — it goes on the ticket
 * and the door reads it back on every scan.
 */
function CompForm({
  eventId,
  deviceLabel,
  onSold,
}: {
  eventId: string;
  deviceLabel: string;
  onSold: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<AccessLevelValue>("GUEST");
  const [admitNow, setAdmitNow] = useState(true);
  const [overage, setOverage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    heading: string;
    detail: string;
    reference: string;
    admitted: boolean;
  } | null>(null);

  const comp = api.door.compAtDoor.useMutation({
    onSuccess: (result) => {
      setReceipt({
        heading: result.admittedNow ? "Comped and in" : "Comped",
        detail: `${name} · ${ACCESS_LEVELS.find((l) => l.value === level)?.label ?? level}`,
        reference: result.hostTicketNumber,
        admitted: result.admittedNow,
      });
      setName("");
      setEmail("");
      setOverage(null);
      onSold();
    },
    onError: (error) => {
      // Over the cap or the allowance. A warning, never a refusal.
      if (error.data?.code === "PRECONDITION_FAILED") {
        setOverage(error.message);
        return;
      }
      toast.error(error.message);
    },
  });

  const submit = (acknowledge: boolean) =>
    comp.mutate({
      eventId,
      recipientName: name.trim(),
      recipientEmail: email.trim() || undefined,
      accessLevel: level,
      deviceLabel: deviceLabel || undefined,
      admitNow,
      acknowledge,
    });

  if (receipt) {
    return <Receipt receipt={receipt} onDone={() => setReceipt(null)} />;
  }

  if (overage) {
    return (
      <div className="space-y-4 border-2 border-amber-500/40 bg-amber-500/10 p-5">
        <p className="flex items-center gap-2 text-lg font-bold text-amber-100">
          <AlertTriangle className="size-5" aria-hidden />
          Over the line
        </p>
        <p className="text-sm text-amber-100/80">{overage}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-14"
            onClick={() => setOverage(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-14"
            disabled={comp.isPending}
            onClick={() => submit(true)}
          >
            {comp.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Comp anyway"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="comp-name">Who&apos;s it for</Label>
        <Input
          id="comp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 bg-white/5"
          placeholder="Name on the door"
          autoComplete="off"
        />
        <p className="text-xs text-white/40">
          Goes on the ticket for good — it&apos;s what you check their ID
          against.
        </p>
      </div>

      <div>
        <p className="text-xs tracking-[0.14em] text-white/40 uppercase">
          What does it get them past?
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ACCESS_LEVELS.map((option) => {
            const active = level === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLevel(option.value)}
                aria-pressed={active}
                className={`flex h-14 items-center justify-center border-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-white bg-white text-black"
                    : "border-white/15 text-white/60"
                }`}
              >
                {option.short}
              </button>
            );
          })}
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-white/50">
          Email it to them (optional)
        </summary>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="comp-email">Email</Label>
          <Input
            id="comp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 bg-white/5"
            autoComplete="off"
          />
        </div>
      </details>

      <AdmitNow checked={admitNow} onChange={setAdmitNow} />

      <p className="text-xs text-amber-300">
        Comped — no money taken, and it&apos;s logged against your name.
      </p>

      <Button
        type="button"
        size="lg"
        className="h-16 w-full text-base"
        disabled={comp.isPending || name.trim().length === 0}
        onClick={() => submit(false)}
      >
        {comp.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Issuing…
          </>
        ) : (
          "Comp a ticket"
        )}
      </Button>
    </div>
  );
}

function AdmitNow({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-white"
      />
      Let them in now
    </label>
  );
}

function Receipt({
  receipt,
  onDone,
}: {
  receipt: {
    heading: string;
    detail: string;
    reference: string;
    admitted: boolean;
  };
  onDone: () => void;
}) {
  return (
    <div className="border-2 border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
      <p className="text-2xl font-black tracking-tight text-emerald-100">
        {receipt.heading}
      </p>
      <p className="mt-2 text-sm text-emerald-100/80">{receipt.detail}</p>
      <p className="mt-1 font-mono text-xs text-emerald-100/60">
        {receipt.reference}
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
        Next
      </Button>
    </div>
  );
}
