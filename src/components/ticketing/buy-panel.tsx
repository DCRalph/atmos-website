"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, Info, Minus, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/site/ui";
import { cn } from "~/lib/utils";
import { siteFontVariables } from "~/lib/site-fonts";
import { api, type RouterOutputs } from "~/trpc/react";
import { formatCountdown } from "~/lib/ticketing/dates";
import { formatNZD, formatNZDCompact } from "~/lib/ticketing/money";
import { openTiers, tierUnavailableLabel } from "~/lib/ticketing/tiers";
import { CheckoutSection, type CheckoutSession } from "./checkout-panel";

type PublicEvent = NonNullable<RouterOutputs["ticketEvents"]["bySlug"]>;
type PublicTier = PublicEvent["tiers"][number];

/**
 * The buy panel — the whole purchase, on one screen.
 *
 * Quantities, the fee breakdown, the terms, and the payment all live here.
 * There used to be a separate payment screen in between, but it only existed
 * because Stripe needs an order before it can render a payment element. That
 * happens behind one button now: "Hold & pay" accepts the terms, takes the
 * hold and opens the payment, so a paid ticket is that tap and then Apple Pay.
 * The next thing anybody sees is their ticket.
 *
 * The booking and venue fees are shown in the summary before any of that — NZ
 * fair-trading rules mean unavoidable fees can't appear for the first time at
 * the payment step.
 *
 * The code box is open before anything is picked, because an event's code can
 * unlock hidden tiers (a presale, a guest list) that then join the list.
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

  const checkedCode = api.ticketEvents.checkCode.useQuery(
    { eventId: event.id, code: appliedCode ?? "" },
    { enabled: !!appliedCode, staleTime: Infinity },
  );
  const codeCheck = appliedCode ? checkedCode.data : undefined;

  // The event's tiers, plus any hidden ones the applied code has opened.
  const tiers = useMemo(
    () => [...event.tiers, ...(codeCheck?.ok ? codeCheck.tiers : [])],
    [event.tiers, codeCheck],
  );

  // What can be picked: what's on sale, plus a locked tier whose tier above
  // is all in the basket.
  const open = useMemo(() => openTiers(tiers, quantities), [tiers, quantities]);

  // Only tiers still open on screen: swapping the code away drops what it
  // unlocked, and putting back the last early bird drops what that opened.
  const lines = useMemo(
    () =>
      tiers
        .map((tier) => ({
          tierId: tier.id,
          quantity: open.has(tier.id) ? (quantities[tier.id] ?? 0) : 0,
        }))
        .filter((line) => line.quantity > 0),
    [tiers, quantities, open],
  );

  // People, not purchases: a group tier's one purchase is several tickets, and
  // the per-order cap counts people.
  const totalTickets = tiers.reduce(
    (sum, tier) =>
      open.has(tier.id)
        ? sum + (quantities[tier.id] ?? 0) * tier.groupSize
        : sum,
    0,
  );

  const quote = api.ticketCheckout.quote.useQuery(
    {
      eventId: event.id,
      lines,
      discountCode: appliedCode ?? undefined,
    },
    {
      enabled: lines.length > 0,
      staleTime: 0,
      // Keep the last total on screen while the next one loads, rather than
      // flashing $0.00 on every tap.
      placeholderData: (previous) => previous,
    },
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

  // Dropping the acceptance is the single path that gives a hold back, so
  // everything that wants to abandon one goes through here.
  const reset = useCallback(() => setAccepted(false), []);

  // "Hold & pay" is what commits: it takes the hold and opens the payment.
  // Debounced, because a buyer nudging the quantity up and down after that
  // would otherwise mint an order per tap.
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

  // Backing out hands the seats straight back rather than making the next
  // buyer wait out a hold nobody is using.
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
        const others = tiers.reduce(
          (sum, t) =>
            t.id === tier.id ? sum : sum + (current[t.id] ?? 0) * t.groupSize,
          0,
        );
        const fits = Math.floor(
          (event.maxTicketsPerOrder - others) / tier.groupSize,
        );
        const capped = Math.max(0, Math.min(next, tier.maxPerOrder, fits));
        const updated = { ...current, [tier.id]: capped };
        // A tier that locks again loses its picks, rather than having them
        // come back the next time it opens.
        const stillOpen = openTiers(tiers, updated);
        return Object.fromEntries(
          Object.entries(updated).filter(([id]) => stillOpen.has(id)),
        );
      });
    },
    [tiers, event.maxTicketsPerOrder],
  );

  const codeBox = (
    <CodeBox
      value={codeInput}
      onChange={setCodeInput}
      onApply={() => setAppliedCode(codeInput.trim() || null)}
      busy={checkedCode.isFetching || quote.isFetching}
      error={
        codeCheck?.ok === false
          ? codeCheck.message
          : (quote.data?.discountError ?? null)
      }
      note={
        codeCheck?.ok && lines.length === 0
          ? codeCheck.tiers.length > 0
            ? `${codeCheck.code} unlocked ${codeCheck.tiers.length === 1 ? "a ticket" : `${codeCheck.tiers.length} tickets`}.`
            : `${codeCheck.code} applies once you pick tickets.`
          : null
      }
    />
  );

  if (event.status === "CANCELLED") {
    return (
      <PanelShell className={className}>
        <div className="space-y-2 p-5">
          <p className="t-display text-site-danger-text text-xl">Cancelled</p>
          <p className="text-[14px] text-white/70">
            This event has been cancelled. If you bought tickets, check your
            email for refund details.
          </p>
        </div>
      </PanelShell>
    );
  }

  const unlockedOnSale = codeCheck?.ok
    ? codeCheck.tiers.some((tier) => tier.available)
    : false;

  if ((event.status === "SOLD_OUT" || !event.onSale) && !unlockedOnSale) {
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
        {/* Checkout refuses a sold out event outright, so a code can only
            open a presale on one that isn't on sale yet. */}
        {event.status !== "SOLD_OUT" && (
          <div className="border-t border-white/10 p-5">{codeBox}</div>
        )}
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
        {tiers.map((tier) => {
          const quantity = quantities[tier.id] ?? 0;
          const disabled = !open.has(tier.id);

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
                  <p className="text-site-warn mt-1.5 text-[12px] font-medium">
                    Only {tier.remainingIfLow} left
                  </p>
                )}
                {disabled ? (
                  <p className="mt-1.5 text-[12px] text-white/50">
                    {tierUnavailableLabel(tier)}
                  </p>
                ) : !tier.available && tier.waitingFor ? (
                  <p className="text-site-accent-text mt-1.5 text-[12px] font-medium">
                    Unlocked, you have the last {tier.waitingFor.name}
                  </p>
                ) : null}
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
        <div className="space-y-3 border-t border-white/10 p-5">
          {codeBox}
          <p className="pl-4 text-[13px] text-white/55">
            Up to {event.maxTicketsPerOrder} tickets per order.
          </p>
        </div>
      ) : (
        <div className="space-y-4 border-t border-white/10 p-5">
          {codeBox}

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
            {(quote.data?.venueFeeCents ?? 0) > 0 && (
              <Row
                label={
                  <span className="inline-flex items-center gap-1.5">
                    Venue booking fee <VenueFeeInfo />
                  </span>
                }
                value={formatNZD(quote.data?.venueFeeCents ?? 0)}
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

          {!accepted && (
            <>
              <Button
                variant="accent"
                size="lg"
                className="w-full"
                onClick={() => setAccepted(true)}
              >
                {quote.data && quote.data.totalCents > 0
                  ? `Hold & pay ${formatNZD(quote.data.totalCents)}`
                  : quote.data
                    ? "Continue"
                    : "Hold & pay"}
              </Button>
              <p className="text-center text-[12px] leading-relaxed text-white/55">
                Continuing means you accept the{" "}
                <a
                  href="/legal/ticket-terms"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  ticket terms
                </a>{" "}
                and{" "}
                <a
                  href="/legal/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  privacy policy
                </a>
                {event.isR18 ? ", and that you're 18 or over" : ""}.
              </p>
              <ul className="space-y-2 border-t border-white/10 pt-4 text-[13px] text-white/70">
                {REASSURANCE.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <Check
                      className="text-site-accent-text mt-0.5 size-3.5 shrink-0"
                      aria-hidden
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </>
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
                  onCancel={reset}
                />
              )}
              <CheckoutSection session={session} />
            </>
          )}
        </div>
      )}
    </PanelShell>
  );
}

/** What a buyer wants to know before paying, in the ticket terms' own words. */
const REASSURANCE = [
  "Sold by Atmos Media. Card details go straight to Stripe.",
  "Your tickets show on the next screen and by email.",
  "Full refund if we cancel.",
];

/**
 * The seats are held, not sold. Showing the clock is fairer than silently
 * dropping the reservation, and it nudges people through checkout. "Change"
 * gives the hold back and returns to picking.
 */
function HoldCountdown({
  expiresAt,
  onExpired,
  onCancel,
}: {
  expiresAt: Date;
  onExpired: () => void;
  onCancel: () => void;
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
          "Your hold ran out and the tickets went back on sale. Your picks are still here.",
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
          ? "bg-site-warn/12 text-site-warn"
          : "bg-white/[0.05] text-white/65",
      )}
      aria-live="polite"
    >
      <span>
        {urgent ? "Your hold is about to lapse" : "Tickets held for you"}
      </span>
      <span className="flex items-center gap-3">
        <span className="t-label text-[13px]">
          {formatCountdown(remaining)}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="t-label text-[11px] text-white/70 underline underline-offset-4 hover:text-white"
        >
          Change
        </button>
      </span>
    </p>
  );
}

/** A code: a discount, or the key to an event's hidden tiers. */
function CodeBox({
  value,
  onChange,
  onApply,
  busy,
  error,
  note,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  busy: boolean;
  error: string | null;
  note: string | null;
}) {
  return (
    <div>
      <form
        className="flex h-11 items-center rounded-full border border-white/15 bg-white/[0.03] p-1 pl-4 focus-within:border-white/50"
        onSubmit={(e) => {
          e.preventDefault();
          onApply();
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="Code"
          aria-label="Discount or access code"
          className="t-label min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-white/40"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-full"
          disabled={!value.trim() || busy}
        >
          Apply
        </Button>
      </form>
      {error ? (
        <p className="text-site-danger-text mt-2 pl-4 text-[13px]">{error}</p>
      ) : note ? (
        <p className="mt-2 pl-4 text-[13px] text-white/65">{note}</p>
      ) : null}
    </div>
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
  label: ReactNode;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between",
        accent ? "text-site-accent-text" : "text-white/65",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The "i" beside the venue booking fee. Hover opens it for a mouse, a tap for
 * a finger. A popover rather than a tooltip, because Radix tooltips never open
 * on touch. It portals to the body, so it carries the site's type itself.
 */
function VenueFeeInfo() {
  const [open, setOpen] = useState(false);
  const pointer = useRef("");
  const onHover = (next: boolean) => (e: PointerEvent) => {
    pointer.current = e.pointerType;
    if (e.pointerType === "mouse") setOpen(next);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="What is the venue booking fee?"
        onPointerEnter={onHover(true)}
        onPointerLeave={onHover(false)}
        // Hover already opened it, so a click shouldn't toggle it shut.
        onClick={(e) => {
          if (pointer.current === "mouse" && open) e.preventDefault();
        }}
        className={cn(
          // The pseudo-element pads the tap target without growing the dot.
          "relative inline-flex size-4 items-center justify-center transition-colors after:absolute after:-inset-3 after:content-['']",
          open ? "text-site-accent-text" : "text-white/70 hover:text-white",
        )}
      >
        <Info className="size-4" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          alignOffset={-10}
          sideOffset={8}
          collisionPadding={12}
          // Opened by hover, it mustn't take focus from wherever it was.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "site",
            siteFontVariables,
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 z-[80] w-[17rem] max-w-[calc(100vw-1.5rem)] rounded-[var(--site-r-chip)] border border-white/15 bg-[#141414] px-3.5 py-3 text-[13px] leading-snug text-white/85 shadow-[0_12px_32px_rgb(0_0_0/0.6)]",
          )}
        >
          <p className="t-label text-site-accent-text mb-1.5 text-[11px]">
            Straight to the venue
          </p>
          <p>
            This covers the cost of booking the venue, split evenly across every
            ticket. It goes straight to the venue. We never see this money.
          </p>
          <Popover.Arrow className="fill-[#141414]" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
