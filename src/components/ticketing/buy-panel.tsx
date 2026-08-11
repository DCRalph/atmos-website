"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Minus, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { api, type RouterOutputs } from "~/trpc/react";
import { formatCountdown } from "~/lib/ticketing/dates";
import { formatNZD, formatNZDCompact } from "~/lib/ticketing/money";
import { CheckoutSection, type CheckoutSession } from "./checkout-panel";

type PublicEvent = NonNullable<RouterOutputs["ticketEvents"]["bySlug"]>;
type PublicTier = PublicEvent["tiers"][number];

/**
 * The buy panel — the whole purchase, on one screen.
 *
 * Quantities, the fee breakdown, the terms, and the payment all live here.
 * There used to be a separate payment screen in between, but it only existed
 * because Stripe needs an order before it can render a payment element. That
 * happens behind the tick-box now: accepting the terms is what takes the hold
 * and opens the payment, so a free ticket is one click and a paid one is a tap
 * on Apple Pay. The next thing anybody sees is their ticket.
 *
 * The booking fee is shown in the summary before any of that — NZ
 * fair-trading rules mean unavoidable fees can't appear for the first time at
 * the payment step.
 */
export function BuyPanel({ event }: { event: PublicEvent }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  // Which basket the held session was priced for. A session that no longer
  // matches must not be payable: the debounce leaves a window where the old
  // Apple Pay sheet is still on screen showing the old total.
  const [sessionKey, setSessionKey] = useState<string | null>(null);

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

  // What a hold would be *for*. Any change to it invalidates the one we hold.
  const basketKey = useMemo(
    () => JSON.stringify({ lines, code: appliedCode }),
    [lines, appliedCode],
  );

  // Read inside effects and callbacks that must not re-run when the hold
  // changes — an effect depending on `session` would take a second hold the
  // moment it received the first.
  const heldOrderId = useRef<string | null>(null);
  const heldKey = useRef<string | null>(null);

  const start = api.ticketCheckout.start.useMutation({
    onSuccess: (order) => {
      heldOrderId.current = order.orderId;
      setSessionKey(heldKey.current);
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
    onError: (error) => {
      toast.error(error.message);
      heldKey.current = null;
      setAccepted(false);
    },
  });

  const release = api.ticketCheckout.release.useMutation();

  // Un-ticking is the single path that gives a hold back, so everything that
  // wants to abandon one goes through here.
  const reset = useCallback(() => setAccepted(false), []);

  // Accepting the terms is what commits: it takes the hold and opens the
  // payment. Debounced, because a buyer nudging the quantity up and down would
  // otherwise mint an order per tap.
  useEffect(() => {
    if (!accepted) return;
    if (lines.length === 0) {
      // They emptied the basket after accepting; the acceptance goes with it.
      reset();
      return;
    }
    if (heldKey.current === basketKey) return;

    const timer = setTimeout(() => {
      heldKey.current = basketKey;
      start.mutate({
        eventId: event.id,
        lines,
        discountCode: appliedCode ?? undefined,
        acceptTerms: true,
        replaceOrderId: heldOrderId.current ?? undefined,
        utm: readUtm(),
      });
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted, basketKey, event.id, reset]);

  // Un-ticking hands the seats straight back rather than making the next buyer
  // wait out a hold nobody is using.
  useEffect(() => {
    if (accepted) return;
    heldKey.current = null;
    setSession(null);
    setSessionKey(null);
    const orderId = heldOrderId.current;
    if (!orderId) return;
    heldOrderId.current = null;
    release.mutate({ orderId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted]);

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

  const remainingAllowance = Math.max(
    0,
    event.maxTicketsPerOrder - totalTickets,
  );
  // Only a session priced for the basket currently on screen may be paid.
  const payable =
    session !== null && sessionKey === basketKey && !start.isPending;
  const preparing = accepted && !payable;

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
                  <p className="mt-1 text-sm text-white/50">
                    {tier.description}
                  </p>
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

          <label className="flex cursor-pointer items-start gap-3 border-t-2 border-white/10 pt-4 text-sm text-white/70">
            <Checkbox
              checked={accepted}
              onCheckedChange={(value) => setAccepted(Boolean(value))}
              aria-describedby="terms-note"
            />
            <span id="terms-note">
              I accept the{" "}
              <a
                href="/tickets/terms"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                ticket terms
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                privacy policy
              </a>
              {event.isR18 ? ", and I'm 18 or over" : ""}.
            </span>
          </label>

          {!accepted && (
            <p className="text-sm text-white/40">
              Tick to hold your tickets and pay.
            </p>
          )}

          {preparing && (
            <p className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Holding your tickets…
            </p>
          )}

          {payable && session && (
            <>
              {session.expiresAt && (
                <HoldCountdown
                  expiresAt={session.expiresAt}
                  onExpired={reset}
                />
              )}
              <CheckoutSection session={session} />
            </>
          )}

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

/**
 * The seats are held, not sold. Showing the clock is fairer than silently
 * dropping the reservation, and it nudges people through checkout.
 */
function HoldCountdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: Date;
  onExpired: () => void;
}) {
  const [remaining, setRemaining] = useState(
    () => expiresAt.getTime() - Date.now(),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const next = expiresAt.getTime() - Date.now();
      setRemaining(next);
      if (next <= 0) {
        clearInterval(timer);
        toast.error(
          "Your reservation expired. Please choose your tickets again.",
        );
        onExpired();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const urgent = remaining < 60_000;

  return (
    <p
      className={`text-sm tabular-nums ${urgent ? "text-amber-300" : "text-white/40"}`}
      aria-live="polite"
    >
      Held for {formatCountdown(remaining)}
    </p>
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
