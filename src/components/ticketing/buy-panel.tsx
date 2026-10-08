"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

import { SiteCheckbox } from "~/components/site/inputs";
import { Button } from "~/components/site/ui";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { formatCountdown } from "~/lib/ticketing/dates";
import { formatNZD, formatNZDCompact } from "~/lib/ticketing/money";
import { tierUnavailableLabel } from "~/lib/ticketing/tiers";
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
export function BuyPanel({
  event,
  className,
}: {
  event: PublicEvent;
  /** Restyles the panel shell, e.g. as glass when it sits over a poster. */
  className?: string;
}) {
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

  // People, not purchases: a group tier's one purchase is several tickets, and
  // the per-order cap counts people.
  const totalTickets = event.tiers.reduce(
    (sum, tier) => sum + (quantities[tier.id] ?? 0) * tier.groupSize,
    0,
  );

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
      setQuantities((current) => {
        const others = event.tiers.reduce(
          (sum, t) =>
            t.id === tier.id ? sum : sum + (current[t.id] ?? 0) * t.groupSize,
          0,
        );
        const fits = Math.floor(
          (event.maxTicketsPerOrder - others) / tier.groupSize,
        );
        const capped = Math.max(0, Math.min(next, tier.maxPerOrder, fits));
        return { ...current, [tier.id]: capped };
      });
    },
    [event.tiers, event.maxTicketsPerOrder],
  );

  if (event.status === "CANCELLED") {
    return (
      <PanelShell className={className}>
        <div className="space-y-2 p-5">
          <p className="t-display text-xl text-[var(--site-danger-text)]">
            Cancelled
          </p>
          <p className="text-[14px] text-white/70">
            This event has been cancelled. If you bought tickets, check your
            email for refund details.
          </p>
        </div>
      </PanelShell>
    );
  }

  if (event.status === "SOLD_OUT" || !event.onSale) {
    return (
      <PanelShell className={className}>
        <div className="space-y-2 p-5">
          <p className="t-display text-2xl">
            {event.status === "SOLD_OUT"
              ? event.doorSales
                ? "Sold out online"
                : "Sold out"
              : "Not on sale"}
          </p>
          <p className="text-[14px] text-white/65">
            {event.status !== "SOLD_OUT" && event.salesOpenAt
              ? `Tickets go on sale ${event.salesOpenAt.toLocaleDateString("en-NZ", { day: "numeric", month: "long" })}.`
              : event.doorSales
                ? "Tickets are held back for the door, so you can still buy one on the night."
                : event.status === "SOLD_OUT"
                  ? "Every ticket is gone."
                  : "Tickets aren't available for this event."}
          </p>
        </div>
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
    <PanelShell r18={event.isR18} className={className}>
      <ul className="divide-y divide-white/10">
        {event.tiers.map((tier) => {
          const quantity = quantities[tier.id] ?? 0;
          const disabled = !tier.available;

          return (
            <li key={tier.id} className="flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={cn(
                      "t-display text-base normal-case",
                      disabled && "text-white/45",
                    )}
                  >
                    {tier.name}
                  </span>
                  <span
                    className={cn(
                      "text-[14px] tabular-nums",
                      disabled ? "text-white/40" : "text-white/75",
                    )}
                  >
                    {tier.isFree ? "Free" : formatNZDCompact(tier.priceCents)}
                  </span>
                </p>
                {tier.groupSize > 1 && (
                  <p
                    className={cn(
                      "mt-1 text-[13px]",
                      disabled ? "text-white/40" : "text-white/70",
                    )}
                  >
                    Admits {tier.groupSize}, one ticket each
                  </p>
                )}
                {tier.description && (
                  <p className="mt-1 text-[13px] text-white/55">
                    {tier.description}
                  </p>
                )}
                {tier.lowStock && tier.available && (
                  <p className="mt-1.5 text-[12px] font-medium text-[var(--site-warn)]">
                    Only {tier.remainingIfLow} left
                  </p>
                )}
                {disabled && (
                  <p className="mt-1.5 text-[12px] text-white/50">
                    {tierUnavailableLabel(tier)}
                  </p>
                )}
              </div>

              {disabled ? null : (
                <div className="inline-flex h-10 shrink-0 items-center rounded-full border border-white/20">
                  <button
                    type="button"
                    aria-label={`One fewer ${tier.name}`}
                    disabled={quantity === 0}
                    onClick={() => setQuantity(tier, quantity - 1)}
                    className="flex size-10 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span
                    className="t-display w-6 text-center tabular-nums"
                    aria-live="polite"
                    aria-label={`${quantity} ${tier.name}`}
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`One more ${tier.name}`}
                    disabled={
                      remainingAllowance < tier.groupSize ||
                      quantity >= tier.maxPerOrder
                    }
                    onClick={() => setQuantity(tier, quantity + 1)}
                    className="flex size-10 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {totalTickets === 0 ? (
        <p className="border-t border-white/10 px-5 py-4 text-[13px] text-white/55">
          Up to {event.maxTicketsPerOrder} tickets per order.
        </p>
      ) : (
        <div className="space-y-4 border-t border-white/10 p-5">
          <div>
            <form
              className="flex h-11 items-center rounded-full border border-white/15 bg-white/[0.03] p-1 pl-4 focus-within:border-white/50"
              onSubmit={(e) => {
                e.preventDefault();
                setAppliedCode(codeInput.trim() || null);
              }}
            >
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Discount code"
                aria-label="Discount code"
                className="t-label min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-white/40"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-full"
                disabled={!codeInput.trim() || quote.isFetching}
              >
                Apply
              </Button>
            </form>
            {quote.data?.discountError && (
              <p className="mt-2 pl-4 text-[13px] text-[var(--site-danger-text)]">
                {quote.data.discountError}
              </p>
            )}
          </div>

          <dl className="space-y-1.5 text-[14px]">
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
            <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
              <dt className="t-label text-[12px]">Total</dt>
              <dd className="t-display text-2xl tabular-nums">
                {quote.isPending
                  ? "--"
                  : formatNZD(quote.data?.totalCents ?? 0)}
              </dd>
            </div>
            {(quote.data?.gstCents ?? 0) > 0 && (
              <p className="text-right text-[12px] text-white/45">
                Includes GST {formatNZD(quote.data?.gstCents ?? 0)}
              </p>
            )}
          </dl>

          <SiteCheckbox
            id={`terms-${event.id}`}
            checked={accepted}
            onCheckedChange={setAccepted}
          >
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
          </SiteCheckbox>

          {!accepted && (
            <p className="text-[13px] text-white/50">
              Tick to hold your tickets and pay.
            </p>
          )}

          {preparing && (
            <p className="text-[13px] text-white/60" aria-live="polite">
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
            <p className="text-center text-[12px] text-white/50">
              R18. Photo ID required at the door.
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
      className={cn(
        "flex items-center justify-between rounded-[var(--site-r-chip)] px-3 py-2 text-[13px] tabular-nums",
        urgent
          ? "bg-[var(--site-warn)]/12 text-[var(--site-warn)]"
          : "bg-white/[0.05] text-white/65",
      )}
      aria-live="polite"
    >
      <span>
        {urgent ? "Your hold is about to lapse" : "Tickets held for you"}
      </span>
      <span className="t-label text-[13px]">{formatCountdown(remaining)}</span>
    </p>
  );
}

/** Notched panel with the "Tickets" header every state shares. */
function PanelShell({
  children,
  r18,
  className,
}: {
  children: React.ReactNode;
  r18?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-label="Tickets"
      className={cn(
        "rounded-[var(--site-r-panel)] rounded-tl-none border border-white/12 bg-white/[0.03]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <h2 className="t-label flex items-center gap-2 text-[12px]">
          <Ticket className="size-4 text-white/60" aria-hidden /> Tickets
        </h2>
        {r18 ? (
          <span className="t-label rounded-[var(--site-r-chip)] border border-white/25 px-2 py-1 text-[10px] text-white/70">
            R18
          </span>
        ) : null}
      </div>
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
    <div
      className={cn(
        "flex items-baseline justify-between",
        accent ? "text-[var(--site-accent-text)]" : "text-white/65",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
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
