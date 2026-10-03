"use client";

import {
  useEffect,
  useEffectEvent,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { FaApple, FaGoogle } from "react-icons/fa6";
import { Check, Minus, Plus, Ticket, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import { GlassCheckbox } from "../inputs";
import { Button } from "../primitives";
import { IssuedTicket, inputClass } from "../sections/checkout";
import {
  fmtDay,
  money,
  moneyExact,
  type Tier,
  type TicketEvent,
} from "./gigs-data";

/** Where the panel starts, so each board state can open mid-flow. */
export type BuyScenario =
  "select" | "basket" | "held" | "hold-expiring" | "declined" | "paid";

// Illustrative codes: one works, anything else shows the real error path.
const CODES: Record<string, number> = { ATMOS10: 0.1 };
const HOLD_MS = 10 * 60_000;

const unavailableLabel = (tier: Tier) => {
  switch (tier.state) {
    case "sold-out":
      return "Sold out";
    case "not-yet":
      return tier.salesStartAt
        ? `On sale ${fmtDay(tier.salesStartAt).slice(4)}`
        : "Not on sale yet";
    case "closed":
      return "Sales closed";
    default:
      return null;
  }
};

/** Panel frame: notched, hairline. `glass` only when a poster sits behind it. */
function Shell({
  glass,
  children,
  className,
}: {
  glass?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="Tickets"
      className={cn(
        "rounded-[var(--mx-r-panel)] rounded-tl-none",
        glass ? "mx-glass-dark" : "border border-white/12 bg-white/[0.03]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Header({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
      <h2 className="mx-label flex items-center gap-2 text-[12px]">
        <Ticket className="size-4 text-white/60" aria-hidden /> Tickets
      </h2>
      {children}
    </div>
  );
}

function Countdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: number;
  onExpired: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  // An effect event, so a new parent callback each render doesn't reset the timer.
  const expired = useEffectEvent(onExpired);
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= expiresAt) {
        clearInterval(id);
        expired();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const remaining = Math.max(0, expiresAt - now);
  const m = Math.floor(remaining / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const urgent = remaining < 60_000;
  return (
    <p
      aria-live="polite"
      className={cn(
        "mx-num flex items-center justify-between rounded-[var(--mx-r-chip)] px-3 py-2 text-[13px]",
        urgent
          ? "bg-[#ffcc4d]/12 text-[#ffcc4d]"
          : "bg-white/[0.05] text-white/65",
      )}
    >
      <span>
        {urgent ? "Your hold is about to lapse" : "Tickets held for you"}
      </span>
      <span className="mx-label text-[13px]">
        {m}:{String(s).padStart(2, "0")}
      </span>
    </p>
  );
}

/** Closed states: cancelled, sold out, not on sale yet. Mirrors the real copy. */
function ClosedPanel({
  event,
  glass,
}: {
  event: TicketEvent;
  glass?: boolean;
}) {
  const { toast } = useBoard();
  const [notify, setNotify] = useState(false);
  if (event.status === "CANCELLED") {
    return (
      <Shell glass={glass}>
        <Header />
        <div className="space-y-2 p-5">
          <p className="mx-display text-xl text-[#ff8a8a]">Cancelled</p>
          <p className="text-[14px] text-white/70">
            This event has been cancelled. If you bought tickets, check your
            email for refund details.
          </p>
        </div>
      </Shell>
    );
  }
  const soldOut = event.status === "SOLD_OUT";
  return (
    <Shell glass={glass}>
      <Header />
      <div className="space-y-4 p-5">
        <div>
          <p className="mx-display text-2xl">
            {soldOut ? "Sold out" : "Not on sale yet"}
          </p>
          <p className="mt-2 text-[14px] text-white/65">
            {soldOut
              ? "Every ticket is gone."
              : event.salesOpenAt
                ? `Tickets go on sale ${new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Pacific/Auckland" }).format(event.salesOpenAt)}.`
                : "Tickets aren't available for this event."}
          </p>
        </div>
        <Button
          variant={notify ? "outline" : "solid"}
          className="w-full"
          disabled={notify}
          onClick={() => {
            setNotify(true);
            toast({
              title: soldOut
                ? "We'll email you if tickets come back"
                : "We'll email you when tickets go on sale",
              tone: "success",
            });
          }}
        >
          {notify ? (
            <>
              <Check className="size-4" /> You&apos;ll hear from us
            </>
          ) : soldOut ? (
            "Email me if tickets come back"
          ) : (
            "Remind me"
          )}
        </Button>
      </div>
    </Shell>
  );
}

/** Free event where staff approve each request ("Get my ticket" in the real flow). */
function ApprovalPanel({
  event,
  glass,
}: {
  event: TicketEvent;
  glass?: boolean;
}) {
  const { toast } = useBoard();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "error" | "sending" | "sent">(
    "idle",
  );
  const tier = event.tiers[0];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return setState("error");
    setState("sending");
    setTimeout(() => {
      setState("sent");
      toast({
        title: "Request sent. We'll email you once it's approved.",
        tone: "success",
      });
    }, 900);
  };

  return (
    <Shell glass={glass}>
      <Header>
        <span className="mx-label rounded-[var(--mx-r-chip)] bg-white px-2 py-1 text-[10px] text-black">
          Free
        </span>
      </Header>
      {state === "sent" ? (
        <div className="space-y-3 p-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]">
            <Check className="size-5" />
          </span>
          <p className="mx-display text-xl">Request sent</p>
          <p className="text-[14px] text-white/70">
            We&apos;ll email {email} once it&apos;s approved. Your ticket and
            Wallet pass come with that email.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4 p-5">
          <div>
            <p className="mx-display text-base">{tier?.name}</p>
            {tier?.description ? (
              <p className="mt-1.5 text-[13px] text-white/60">
                {tier.description}
              </p>
            ) : null}
          </div>
          <label className="block">
            <span className="mx-label mb-2 block text-[10px] text-white/70">
              Name on ID
            </span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setState("idle");
              }}
              autoComplete="name"
              className={inputClass}
              aria-invalid={state === "error" && name.trim().length < 2}
            />
          </label>
          <label className="block">
            <span className="mx-label mb-2 block text-[10px] text-white/70">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setState("idle");
              }}
              autoComplete="email"
              className={inputClass}
              aria-invalid={state === "error" && !email.includes("@")}
            />
          </label>
          {state === "error" ? (
            <p className="text-[13px] text-[#ff8a8a]">
              Add your name and a working email so we can send your ticket.
            </p>
          ) : null}
          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            disabled={state === "sending"}
            aria-busy={state === "sending"}
          >
            {state === "sending" ? "Sending request…" : "Get my ticket"}
          </Button>
          {event.isR18 ? (
            <p className="text-center text-[12px] text-white/50">
              R18. Photo ID required at the door.
            </p>
          ) : null}
        </form>
      )}
    </Shell>
  );
}

/**
 * The ticket buy panel. Picks tiers, prices the basket (discount, booking fee,
 * GST), holds the seats once terms are accepted, then takes payment. Card
 * numbers ending 0000 decline.
 */
export function BuyPanel({
  event,
  scenario = "select",
  glass,
  className,
}: {
  event: TicketEvent;
  scenario?: BuyScenario;
  glass?: boolean;
  className?: string;
}) {
  const { toast } = useBoard();
  const startsInBasket = scenario !== "select";
  const [qty, setQty] = useState<Record<string, number>>(
    startsInBasket ? { general: 2 } : {},
  );
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState<
    { code: string; rate: number } | { error: string } | null
  >(null);
  const [accepted, setAccepted] = useState(
    scenario === "held" ||
      scenario === "hold-expiring" ||
      scenario === "declined",
  );
  const [holding, setHolding] = useState(false);
  const [holdUntil, setHoldUntil] = useState<number | null>(() =>
    scenario === "held" || scenario === "declined"
      ? Date.now() + HOLD_MS
      : scenario === "hold-expiring"
        ? Date.now() + 45_000
        : null,
  );
  const [card, setCard] = useState(
    scenario === "declined" ? "4000 0000 0000 0000" : "",
  );
  const [email, setEmail] = useState(
    scenario === "declined" ? "aroha@example.com" : "",
  );
  const [pay, setPay] = useState<"idle" | "paying" | "declined" | "paid">(
    scenario === "declined"
      ? "declined"
      : scenario === "paid"
        ? "paid"
        : "idle",
  );

  if (event.status !== "ON_SALE")
    return <ClosedPanel event={event} glass={glass} />;
  if (event.requiresApproval)
    return <ApprovalPanel event={event} glass={glass} />;

  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const subtotal = event.tiers.reduce(
    (sum, t) => sum + (qty[t.id] ?? 0) * t.priceCents,
    0,
  );
  const discount =
    code && "rate" in code ? Math.round(subtotal * code.rate) : 0;
  const fees =
    count * event.bookingFee.fixedCents +
    Math.round((subtotal * event.bookingFee.percentBp) / 10_000);
  const total = subtotal - discount + fees;
  const gst = Math.round((total * 3) / 23);
  const allowance = Math.max(0, event.maxTicketsPerOrder - count);

  // Any change to the basket drops the hold, as the real panel re-prices.
  const changeQty = (tier: Tier, n: number) => {
    setQty((q) => ({ ...q, [tier.id]: n }));
    setHoldUntil(null);
    setPay("idle");
  };

  const accept = (on: boolean) => {
    setAccepted(on);
    if (!on) return setHoldUntil(null);
    setHolding(true);
    setTimeout(() => {
      setHolding(false);
      setHoldUntil(Date.now() + HOLD_MS);
    }, 900);
  };

  const expire = () => {
    setHoldUntil(null);
    setAccepted(false);
    setQty({});
    toast({
      title: "Your reservation expired. Please choose your tickets again.",
      tone: "error",
    });
  };

  const submitPay = (e: FormEvent) => {
    e.preventDefault();
    setPay("paying");
    setTimeout(() => {
      if (card.replace(/\s/g, "").endsWith("0000")) {
        setPay("declined");
        toast({ title: "Your card was declined", tone: "error" });
      } else {
        setPay("paid");
        setHoldUntil(null);
        toast({
          title: `${count} ${count === 1 ? "ticket" : "tickets"} sent to ${email || "your email"}`,
          tone: "success",
        });
      }
    }, 1300);
  };

  if (pay === "paid") {
    const tier =
      event.tiers.find((t) => (qty[t.id] ?? 0) > 0) ?? event.tiers[0];
    return (
      <Shell glass={glass} className={className}>
        <Header>
          <span className="mx-label flex items-center gap-1.5 text-[10px] text-[var(--mx-accent-text)]">
            <Check className="size-3.5" /> Paid
          </span>
        </Header>
        <div className="space-y-4 p-5">
          <p className="mx-display text-2xl">You&apos;re in</p>
          <p className="text-[14px] text-white/70">
            Tickets and Wallet passes are on their way to{" "}
            {email || "your email"}.
          </p>
          <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1">
            {Array.from({ length: Math.max(1, count) }, (_, i) => (
              <IssuedTicket
                key={i}
                tier={tier?.name ?? "General"}
                holder="Aroha Ngata"
                serial={`ATM-GE-${String(5120 + i).padStart(5, "0")}`}
              />
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell glass={glass} className={className}>
      <Header>
        {event.isR18 ? (
          <span className="mx-label rounded-[var(--mx-r-chip)] border border-white/25 px-2 py-1 text-[10px] text-white/70">
            R18
          </span>
        ) : null}
      </Header>
      <ul className="divide-y divide-white/10">
        {event.tiers.map((tier) => {
          const n = qty[tier.id] ?? 0;
          const unavailable = unavailableLabel(tier);
          return (
            <li key={tier.id} className="flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={cn(
                      "mx-display text-base",
                      unavailable && "text-white/45",
                    )}
                  >
                    {tier.name}
                  </span>
                  <span
                    className={cn(
                      "mx-num text-[14px]",
                      unavailable ? "text-white/40" : "text-white/75",
                    )}
                  >
                    {tier.priceCents === 0 ? "Free" : money(tier.priceCents)}
                  </span>
                </p>
                {tier.description ? (
                  <p className="mt-1 text-[13px] text-white/55">
                    {tier.description}
                  </p>
                ) : null}
                {tier.state === "low" ? (
                  <p className="mt-1.5 text-[12px] font-medium text-[#ffcc4d]">
                    Only {tier.remaining} left
                  </p>
                ) : null}
                {unavailable ? (
                  <p className="mt-1.5 text-[12px] text-white/50">
                    {unavailable}
                  </p>
                ) : null}
              </div>
              {unavailable ? null : (
                <div className="inline-flex h-10 shrink-0 items-center rounded-full border border-white/20">
                  <button
                    type="button"
                    aria-label={`One fewer ${tier.name}`}
                    disabled={n === 0 || pay === "paying"}
                    onClick={() => changeQty(tier, n - 1)}
                    className="flex size-10 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span
                    className="mx-display mx-num w-5 text-center"
                    aria-live="polite"
                  >
                    {n}
                  </span>
                  <button
                    type="button"
                    aria-label={`One more ${tier.name}`}
                    disabled={
                      allowance === 0 ||
                      n >= tier.maxPerOrder ||
                      pay === "paying"
                    }
                    onClick={() => changeQty(tier, n + 1)}
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

      {count === 0 ? (
        <p className="border-t border-white/10 px-5 py-4 text-[13px] text-white/55">
          Up to {event.maxTicketsPerOrder} tickets per order.
        </p>
      ) : (
        <div className="space-y-4 border-t border-white/10 p-5">
          {/* Discount code */}
          <div>
            <form
              className="flex h-11 items-center rounded-full border border-white/15 bg-white/[0.03] p-1 pl-4 focus-within:border-white/50"
              onSubmit={(e) => {
                e.preventDefault();
                const c = codeInput.trim().toUpperCase();
                const rate = CODES[c];
                setCode(
                  rate
                    ? { code: c, rate }
                    : { error: "That code isn't valid for this event." },
                );
                setHoldUntil(null);
              }}
            >
              <label htmlFor={`code-${event.slug}`} className="sr-only">
                Discount code
              </label>
              <input
                id={`code-${event.slug}`}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Discount code"
                className="mx-label min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-white/40"
              />
              {code && "rate" in code ? (
                <button
                  type="button"
                  onClick={() => {
                    setCode(null);
                    setCodeInput("");
                  }}
                  className="mx-label flex h-full items-center gap-1 rounded-full px-3 text-[10px] text-[var(--mx-accent-text)]"
                >
                  {code.code} <X className="size-3.5" />
                </button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-full"
                  disabled={!codeInput.trim()}
                >
                  Apply
                </Button>
              )}
            </form>
            {code && "error" in code ? (
              <p className="mt-2 pl-4 text-[13px] text-[#ff8a8a]">
                {code.error}
              </p>
            ) : null}
            {!code ? (
              <p className="mt-2 pl-4 text-[12px] text-white/40">
                Try ATMOS10 (mock).
              </p>
            ) : null}
          </div>

          <dl className="space-y-1.5 text-[14px]">
            <div className="flex justify-between text-white/65">
              <dt>Tickets ({count})</dt>
              <dd className="mx-num">{moneyExact(subtotal)}</dd>
            </div>
            {discount > 0 && code && "code" in code ? (
              <div className="flex justify-between text-[var(--mx-accent-text)]">
                <dt>Discount ({code.code})</dt>
                <dd className="mx-num">−{moneyExact(discount)}</dd>
              </div>
            ) : null}
            {fees > 0 ? (
              <div className="flex justify-between text-white/65">
                <dt>Booking fee</dt>
                <dd className="mx-num">{moneyExact(fees)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
              <dt className="mx-label text-[12px]">Total</dt>
              <dd className="mx-display mx-num text-2xl">
                {moneyExact(total)}
              </dd>
            </div>
            <p className="text-right text-[12px] text-white/45">
              Includes GST {moneyExact(gst)}
            </p>
          </dl>

          <GlassCheckbox
            id={`terms-${event.slug}`}
            checked={accepted}
            onCheckedChange={accept}
          >
            I accept the{" "}
            <a href="#" className="underline underline-offset-2">
              ticket terms
            </a>{" "}
            and{" "}
            <a href="#" className="underline underline-offset-2">
              privacy policy
            </a>
            {event.isR18 ? ", and I'm 18 or over" : ""}.
          </GlassCheckbox>

          {!accepted ? (
            <p className="text-[13px] text-white/50">
              Tick to hold your tickets and pay.
            </p>
          ) : null}
          {holding ? (
            <p className="text-[13px] text-white/60" aria-live="polite">
              Holding your tickets…
            </p>
          ) : null}

          {accepted && holdUntil ? (
            <form onSubmit={submitPay} className="space-y-4">
              <Countdown
                key={holdUntil}
                expiresAt={holdUntil}
                onExpired={expire}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCard("4242 4242 4242 4242");
                    setEmail("aroha@example.com");
                  }}
                  className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-white text-[15px] font-semibold text-black"
                >
                  <FaApple className="size-5" /> Pay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCard("4242 4242 4242 4242");
                    setEmail("aroha@example.com");
                  }}
                  className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-white/25 text-[15px] font-semibold"
                >
                  <FaGoogle className="size-4" /> Pay
                </button>
              </div>
              <p className="flex items-center gap-3 text-[12px] text-white/45">
                <span className="h-px flex-1 bg-white/10" /> or pay by card{" "}
                <span className="h-px flex-1 bg-white/10" />
              </p>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email for your tickets"
                autoComplete="email"
                className={inputClass}
              />
              <input
                required
                inputMode="numeric"
                value={card}
                onChange={(e) =>
                  setCard(
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 16)
                      .replace(/(\d{4})(?=\d)/g, "$1 "),
                  )
                }
                placeholder="Card number"
                autoComplete="cc-number"
                aria-invalid={pay === "declined"}
                className={cn(inputClass, "mx-num")}
              />
              {pay === "declined" ? (
                <p
                  role="alert"
                  className="rounded-[var(--mx-r-chip)] border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 px-4 py-3 text-[14px] text-[#ffb3b3]"
                >
                  Your card was declined. Nothing was charged. Try another card
                  or Apple Pay.
                </p>
              ) : (
                <p className="text-[12px] text-white/40">
                  Mock: a card ending 0000 declines.
                </p>
              )}
              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={pay === "paying"}
                aria-busy={pay === "paying"}
              >
                {pay === "paying" ? "Paying…" : `Pay ${moneyExact(total)}`}
              </Button>
            </form>
          ) : null}

          {event.isR18 ? (
            <p className="text-center text-[12px] text-white/50">
              R18. Photo ID required at the door.
            </p>
          ) : null}
        </div>
      )}
    </Shell>
  );
}
