"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, Minus, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api, type RouterOutputs } from "~/trpc/react";
import { formatNZD, formatNZDCompact } from "~/lib/ticketing/money";
import { CheckoutPanel, type CheckoutSession } from "./checkout-panel";

type PublicEvent = NonNullable<RouterOutputs["ticketEvents"]["bySlug"]>;
type PublicTier = PublicEvent["tiers"][number];

/**
 * The buy panel.
 *
 * Asks for nothing but quantities. The booking fee is shown in the summary
 * before the buyer commits — NZ fair-trading rules mean unavoidable fees can't
 * appear for the first time at the payment step.
 */
export function BuyPanel({ event }: { event: PublicEvent }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [session, setSession] = useState<CheckoutSession | null>(null);

  const lines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([tierId, quantity]) => ({ tierId, quantity })),
    [quantities],
  );

  const totalTickets = lines.reduce((sum, line) => sum + line.quantity, 0);

  const quote = api.ticketCheckout.quote.useQuery(
    {
      eventId: event.id,
      lines,
      discountCode: appliedCode ?? undefined,
    },
    { enabled: lines.length > 0, staleTime: 0 },
  );

  const start = api.ticketCheckout.start.useMutation({
    onSuccess: (order) => {
      setSession({
        orderId: order.orderId,
        accessToken: order.accessToken,
        clientSecret: order.clientSecret,
        totalCents: order.totalCents,
        isFree: order.isFree,
        expiresAt: order.expiresAt,
        needsDetailsUpFront: order.needsDetailsUpFront,
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const setQuantity = useCallback(
    (tier: PublicTier, next: number) => {
      const capped = Math.max(
        0,
        Math.min(next, tier.maxPerOrder, event.maxTicketsPerOrder),
      );
      setQuantities((current) => ({ ...current, [tier.id]: capped }));
    },
    [event.maxTicketsPerOrder],
  );

  if (session) {
    return (
      <CheckoutPanel
        event={event}
        session={session}
        onCancel={() => {
          setSession(null);
          void quote.refetch();
        }}
      />
    );
  }

  if (event.status === "CANCELLED") {
    return (
      <PanelShell>
        <p className="text-sm text-red-300">
          This event has been cancelled. If you bought tickets, check your email
          for refund details.
        </p>
      </PanelShell>
    );
  }

  if (event.status === "SOLD_OUT" || !event.onSale) {
    return (
      <PanelShell>
        <p className="text-lg font-semibold text-white">
          {event.status === "SOLD_OUT" ? "Sold out" : "Not on sale"}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {event.status === "SOLD_OUT"
            ? "Every ticket is gone."
            : event.salesOpenAt
              ? `Tickets go on sale ${event.salesOpenAt.toLocaleDateString("en-NZ", { day: "numeric", month: "long" })}.`
              : "Tickets aren't available for this event."}
        </p>
      </PanelShell>
    );
  }

  const remainingAllowance = Math.max(0, event.maxTicketsPerOrder - totalTickets);

  return (
    <PanelShell>
      <div className="flex items-center gap-2 border-b-2 border-white/10 pb-3">
        <Ticket className="size-4 text-white/60" aria-hidden />
        <h2 className="text-sm font-semibold tracking-[0.18em] text-white/70 uppercase">
          Tickets
        </h2>
      </div>

      <ul className="divide-y-2 divide-white/5">
        {event.tiers.map((tier) => {
          const quantity = quantities[tier.id] ?? 0;
          const disabled = !tier.available;

          return (
            <li key={tier.id} className="flex items-start gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-white">{tier.name}</span>
                  <span className="text-white/60">
                    {tier.isFree ? "Free" : formatNZDCompact(tier.priceCents)}
                  </span>
                </div>

                {tier.description && (
                  <p className="mt-1 text-sm text-white/50">{tier.description}</p>
                )}

                {tier.lowStock && tier.available && (
                  <p className="mt-1 text-xs font-medium text-amber-300">
                    Only {tier.remainingIfLow} left
                  </p>
                )}

                {disabled && (
                  <p className="mt-1 text-xs text-white/40">
                    {unavailableLabel(tier)}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`One fewer ${tier.name}`}
                  disabled={disabled || quantity === 0}
                  onClick={() => setQuantity(tier, quantity - 1)}
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
                  disabled={
                    disabled ||
                    remainingAllowance === 0 ||
                    quantity >= tier.maxPerOrder
                  }
                  onClick={() => setQuantity(tier, quantity + 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {totalTickets > 0 && (
        <div className="space-y-4 border-t-2 border-white/10 pt-4">
          <div className="flex gap-2">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Discount code"
              className="uppercase"
              aria-label="Discount code"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setAppliedCode(codeInput.trim() || null)}
              disabled={!codeInput.trim() || quote.isFetching}
            >
              Apply
            </Button>
          </div>

          {quote.data?.discountError && (
            <p className="text-sm text-red-300">{quote.data.discountError}</p>
          )}

          <dl className="space-y-1.5 text-sm">
            <Row
              label={`Tickets (${totalTickets})`}
              value={formatNZD(quote.data?.subtotalCents ?? 0)}
            />
            {(quote.data?.discountCents ?? 0) > 0 && (
              <Row
                label={`Discount${quote.data?.discount ? ` (${quote.data.discount.code})` : ""}`}
                value={`−${formatNZD(quote.data?.discountCents ?? 0)}`}
                accent
              />
            )}
            {(quote.data?.bookingFeeCents ?? 0) > 0 && (
              <Row
                label="Booking fee"
                value={formatNZD(quote.data?.bookingFeeCents ?? 0)}
              />
            )}
            <div className="flex items-baseline justify-between border-t border-white/10 pt-2 text-base font-semibold text-white">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {quote.isPending ? "—" : formatNZD(quote.data?.totalCents ?? 0)}
              </dd>
            </div>
            {(quote.data?.gstCents ?? 0) > 0 && (
              <p className="text-xs text-white/40">
                Includes GST {formatNZD(quote.data?.gstCents ?? 0)}
              </p>
            )}
          </dl>

          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={start.isPending || quote.isPending}
            onClick={() =>
              start.mutate({
                eventId: event.id,
                lines,
                discountCode: appliedCode ?? undefined,
                utm: readUtm(),
              })
            }
          >
            {start.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Holding your tickets…
              </>
            ) : quote.data?.isFree ? (
              "Get tickets"
            ) : (
              `Pay ${formatNZD(quote.data?.totalCents ?? 0)}`
            )}
          </Button>

          {event.isR18 && (
            <p className="text-center text-xs text-white/40">
              R18 — photo ID required at the door
            </p>
          )}
        </div>
      )}
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-2 border-white/10 bg-black/80 p-5 backdrop-blur-sm">
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={accent ? "text-emerald-300" : "text-white/60"}>{label}</dt>
      <dd
        className={`tabular-nums ${accent ? "text-emerald-300" : "text-white/80"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function unavailableLabel(tier: PublicTier): string {
  switch (tier.unavailableReason) {
    case "SOLD_OUT":
      return "Sold out";
    case "NOT_ON_SALE_YET":
      return tier.salesStartAt
        ? `On sale ${tier.salesStartAt.toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "short",
          })}`
        : "Not on sale yet";
    case "SALES_CLOSED":
      return "Sales closed";
    default:
      return "Unavailable";
  }
}

/**
 * Campaign attribution, read from the URL the buyer arrived on. Stored with the
 * order so the analytics page can show which post actually sold tickets.
 */
function readUtm() {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const source = params.get("utm_source") ?? undefined;
  const medium = params.get("utm_medium") ?? undefined;
  const campaign = params.get("utm_campaign") ?? undefined;
  if (!source && !medium && !campaign) return undefined;
  return { source, medium, campaign };
}
