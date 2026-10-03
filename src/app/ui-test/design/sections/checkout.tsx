"use client";

import { Suspense, use, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { ArrowLeft, Check, Minus, Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPrice, useBoard } from "../board-state";
import { formatDay, formatTime, ticketTiers, upcomingGigs } from "../fixtures";
import { Button, Media, VariantTag } from "../primitives";

const gig = upcomingGigs[0];
const FEE = 2.5; // Illustrative per-ticket booking fee.
const steps = ["Tickets", "Details", "Payment", "Done"] as const;
type Step = (typeof steps)[number];
type Qty = Record<string, number>;

// QR generation is async; cache one promise per payload so `use()` stays stable.
const qrCache = new Map<string, Promise<string>>();
const qrSvg = (payload: string) => {
  let p = qrCache.get(payload);
  if (!p) {
    p = QRCode.toString(payload, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
    });
    qrCache.set(payload, p);
  }
  return p;
};

function Qr({ payload }: { payload: string }) {
  const svg = use(qrSvg(payload));
  return (
    <div
      className="size-full [&>svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function Stepper({ current }: { current: Step }) {
  const index = steps.indexOf(current);
  return (
    <ol className="flex items-center gap-2" aria-label="Checkout progress">
      {steps.map((s, i) => (
        <li
          key={s}
          className="flex flex-1 items-center gap-2"
          aria-current={i === index ? "step" : undefined}
        >
          <span
            className={cn(
              "mx-label flex size-7 shrink-0 items-center justify-center rounded-full text-[10px]",
              i < index && "bg-white text-black",
              i === index &&
                "bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]",
              i > index && "border border-white/25 text-white/50",
            )}
          >
            {i < index ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span
            className={cn(
              "mx-label text-[10px] max-sm:sr-only",
              i === index ? "text-white" : "text-white/50",
            )}
          >
            {s}
          </span>
          {i < steps.length - 1 ? (
            <span className="h-px flex-1 bg-white/15" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
}) {
  const id = `co-${label.toLowerCase().replace(/\W+/g, "-")}`;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="mx-label mb-2 block text-[10px] text-white/70"
      >
        {label}
      </label>
      {children({
        id,
        "aria-invalid": !!error,
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={`${id}-err`} className="mt-2 pl-5 text-[13px] text-[#ff8a8a]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 pl-5 text-[13px] text-white/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-full border border-white/15 bg-white/[0.04] px-5 text-[15px] text-white outline-none placeholder:text-white/40 hover:border-white/30 focus:border-white/60 aria-[invalid=true]:border-[#ff6b6b]";

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/**
 * Ticket purchase, start to issued ticket. Card numbers ending 0000 decline,
 * so the failure path is testable.
 */
export function CheckoutFlow({
  initialQty = { General: 2 },
  initialStep = "Tickets",
  compact = false,
}: {
  initialQty?: Qty;
  initialStep?: Step;
  compact?: boolean;
}) {
  const { toast } = useBoard();
  const [step, setStep] = useState<Step>(initialStep);
  const [qty, setQty] = useState<Qty>(initialQty);
  const [details, setDetails] = useState({ name: "", email: "", confirm: "" });
  const [detailErrors, setDetailErrors] = useState<
    Partial<Record<keyof typeof details, string>>
  >({});
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [payState, setPayState] = useState<"idle" | "paying" | "declined">(
    "idle",
  );

  const lines = ticketTiers.filter((t) => (qty[t.name] ?? 0) > 0);
  const count = lines.reduce((n, t) => n + (qty[t.name] ?? 0), 0);
  const subtotal = lines.reduce(
    (sum, t) => sum + (qty[t.name] ?? 0) * t.price,
    0,
  );
  const total = subtotal + count * FEE;

  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    const errors: typeof detailErrors = {};
    if (details.name.trim().length < 2)
      errors.name = "Add the name on your ID. Door staff check it.";
    if (!emailOk(details.email))
      errors.email = "That email doesn't look right. Tickets are sent here.";
    else if (details.confirm !== details.email)
      errors.confirm = "Emails don't match.";
    setDetailErrors(errors);
    if (Object.keys(errors).length === 0) setStep("Payment");
  };

  const pay = (e: FormEvent) => {
    e.preventDefault();
    setPayState("paying");
    setTimeout(() => {
      if (card.number.replace(/\s/g, "").endsWith("0000")) {
        setPayState("declined");
        toast({ title: "Payment declined. Try another card.", tone: "error" });
      } else {
        setPayState("idle");
        setStep("Done");
        toast({
          title: `${count} ${count === 1 ? "ticket" : "tickets"} sent to ${details.email}`,
          tone: "success",
        });
      }
    }, 1400);
  };

  const reset = () => {
    setStep("Tickets");
    setQty({ General: 2 });
    setDetails({ name: "", email: "", confirm: "" });
    setCard({ number: "", expiry: "", cvc: "" });
    setPayState("idle");
  };

  const summary = (
    <div className="space-y-2 border-t border-white/10 pt-4 text-[14px]">
      {lines.map((t) => (
        <div key={t.name} className="flex justify-between text-white/75">
          <span>
            {qty[t.name]} × {t.name}
          </span>
          <span className="mx-num">
            {formatPrice((qty[t.name] ?? 0) * t.price)}
          </span>
        </div>
      ))}
      <div className="flex justify-between text-white/55">
        <span>Booking fees</span>
        <span className="mx-num">{formatPrice(count * FEE)}</span>
      </div>
      <div className="flex items-baseline justify-between pt-2">
        <span className="mx-label text-[12px]">Total</span>
        <span className="mx-display mx-num text-2xl">{formatPrice(total)}</span>
      </div>
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-6", compact ? "p-5" : "")}>
      <Stepper current={step} />

      {step === "Tickets" ? (
        <div className="space-y-4">
          <ul>
            {ticketTiers.map((t) => {
              const n = qty[t.name] ?? 0;
              const available = t.state === "on-sale";
              return (
                <li
                  key={t.name}
                  className="flex items-center gap-4 border-b border-white/10 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "mx-display text-base",
                        !available && "text-white/45",
                      )}
                    >
                      {t.name}
                    </p>
                    <p className="mt-1.5 text-[13px] text-white/60">
                      {formatPrice(t.price)}{" "}
                      {t.state === "sold-out"
                        ? "· Sold out"
                        : t.state === "upcoming"
                          ? "· Opens when General sells out"
                          : `+ ${formatPrice(FEE)} fee`}
                    </p>
                  </div>
                  {available ? (
                    <div className="inline-flex h-10 items-center rounded-full border border-white/20">
                      <button
                        type="button"
                        aria-label={`Fewer ${t.name}`}
                        disabled={n === 0}
                        onClick={() =>
                          setQty((q) => ({ ...q, [t.name]: n - 1 }))
                        }
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
                        aria-label={`More ${t.name}`}
                        disabled={n >= 8}
                        onClick={() =>
                          setQty((q) => ({ ...q, [t.name]: n + 1 }))
                        }
                        className="flex size-10 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {count > 0 ? (
            summary
          ) : (
            <p className="text-[14px] text-white/55">
              Pick at least one ticket.
            </p>
          )}
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={count === 0}
            onClick={() => setStep("Details")}
          >
            Continue
          </Button>
        </div>
      ) : null}

      {step === "Details" ? (
        <form className="space-y-4" onSubmit={submitDetails} noValidate>
          <Field label="Name on ID" error={detailErrors.name}>
            {(p) => (
              <input
                {...p}
                autoComplete="name"
                value={details.name}
                onChange={(e) =>
                  setDetails({ ...details, name: e.target.value })
                }
                className={inputClass}
                placeholder="Full name"
              />
            )}
          </Field>
          <Field
            label="Email"
            error={detailErrors.email}
            hint="Tickets and your Wallet pass go here."
          >
            {(p) => (
              <input
                {...p}
                type="email"
                autoComplete="email"
                value={details.email}
                onChange={(e) =>
                  setDetails({ ...details, email: e.target.value })
                }
                className={inputClass}
                placeholder="you@example.com"
              />
            )}
          </Field>
          <Field label="Confirm email" error={detailErrors.confirm}>
            {(p) => (
              <input
                {...p}
                type="email"
                autoComplete="email"
                value={details.confirm}
                onChange={(e) =>
                  setDetails({ ...details, confirm: e.target.value })
                }
                className={inputClass}
                placeholder="Same again"
              />
            )}
          </Field>
          {summary}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setStep("Tickets")}
              aria-label="Back to tickets"
              className="px-5"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Button type="submit" variant="accent" size="lg" className="flex-1">
              Continue to payment
            </Button>
          </div>
        </form>
      ) : null}

      {step === "Payment" ? (
        <form className="space-y-4" onSubmit={pay}>
          {payState === "declined" ? (
            <p
              role="alert"
              className="rounded-[var(--mx-r-chip)] border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 px-4 py-3 text-[14px] text-[#ffb3b3]"
            >
              Your bank declined the payment. Nothing was charged. Try another
              card.
            </p>
          ) : null}
          <Field
            label="Card number"
            hint="Mock: ends in 0000 to see a decline."
          >
            {(p) => (
              <input
                {...p}
                inputMode="numeric"
                autoComplete="cc-number"
                required
                value={card.number}
                onChange={(e) =>
                  setCard({
                    ...card,
                    number: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 16)
                      .replace(/(\d{4})(?=\d)/g, "$1 "),
                  })
                }
                className={cn(inputClass, "mx-num")}
                placeholder="4242 4242 4242 4242"
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry">
              {(p) => (
                <input
                  {...p}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  required
                  value={card.expiry}
                  onChange={(e) =>
                    setCard({
                      ...card,
                      expiry: e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 4)
                        .replace(/(\d{2})(?=\d)/, "$1 / "),
                    })
                  }
                  className={cn(inputClass, "mx-num")}
                  placeholder="MM / YY"
                />
              )}
            </Field>
            <Field label="CVC">
              {(p) => (
                <input
                  {...p}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  required
                  value={card.cvc}
                  onChange={(e) =>
                    setCard({
                      ...card,
                      cvc: e.target.value.replace(/\D/g, "").slice(0, 4),
                    })
                  }
                  className={cn(inputClass, "mx-num")}
                  placeholder="123"
                />
              )}
            </Field>
          </div>
          {summary}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setStep("Details")}
              aria-label="Back to details"
              className="px-5"
              disabled={payState === "paying"}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="flex-1"
              disabled={payState === "paying"}
              aria-busy={payState === "paying"}
            >
              {payState === "paying" ? "Paying…" : `Pay ${formatPrice(total)}`}
            </Button>
          </div>
        </form>
      ) : null}

      {step === "Done" ? (
        <div className="space-y-5">
          <p className="text-[15px] text-white/75">
            You&apos;re in. We&apos;ve emailed{" "}
            {count === 1 ? "your ticket" : `all ${count} tickets`} to{" "}
            <span className="text-white">{details.email}</span>.
          </p>
          <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
            {lines.flatMap((t) =>
              Array.from({ length: qty[t.name] ?? 0 }, (_, i) => (
                <IssuedTicket
                  key={`${t.name}-${i}`}
                  tier={t.name}
                  holder={details.name}
                  serial={`ATM-${t.name.slice(0, 2).toUpperCase()}-${String(4821 + i).padStart(5, "0")}`}
                />
              )),
            )}
          </div>
          <Button variant="outline" onClick={reset}>
            Start again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Customer ticket: hard poster strip on top, white QR block, notch panel. */
export function IssuedTicket({
  tier,
  holder,
  serial,
}: {
  tier: string;
  holder: string;
  serial: string;
}) {
  return (
    <article className="w-[280px] shrink-0 snap-start overflow-hidden rounded-[var(--mx-r-panel)] rounded-tl-none bg-white/[0.06] ring-1 ring-white/12">
      <div className="relative h-24">
        <Media
          src={gig.poster}
          alt=""
          sizes="280px"
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <p className="mx-display absolute bottom-3 left-4 text-xl">
          {gig.headline}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
        <div>
          <dt className="mx-label text-[9px] text-white/50">Date</dt>
          <dd className="mt-1">{formatDay(gig.date)}</dd>
        </div>
        <div>
          <dt className="mx-label text-[9px] text-white/50">Doors</dt>
          <dd className="mt-1">{formatTime(gig.date)}</dd>
        </div>
        <div>
          <dt className="mx-label text-[9px] text-white/50">Ticket</dt>
          <dd className="mt-1">{tier}</dd>
        </div>
        <div>
          <dt className="mx-label text-[9px] text-white/50">Holder</dt>
          <dd className="mt-1 truncate">{holder || "Guest"}</dd>
        </div>
      </dl>
      {/* Perforation: the one place a dashed rule means something. */}
      <div className="mx-4 border-t border-dashed border-white/20" />
      <div className="flex flex-col items-center gap-3 p-4">
        <div className="size-40 bg-white p-3">
          <Suspense fallback={<div className="size-full bg-black/10" />}>
            <Qr payload={`atmos:ticket:${serial}`} />
          </Suspense>
        </div>
        <p className="mx-num font-mono text-[11px] text-white/55">{serial}</p>
        <a href="#" aria-label="Add to Apple Wallet">
          <Image
            src="/US-UK_Add_to_Apple_Wallet_RGB_101421.svg"
            alt=""
            width={110}
            height={34}
            className="h-[34px] w-auto"
          />
        </a>
      </div>
    </article>
  );
}

export function CheckoutSection() {
  return (
    <div className="grid gap-10 px-5 pb-16 md:px-10 lg:grid-cols-[minmax(0,480px)_1fr]">
      <div>
        <VariantTag className="px-0 md:px-0">
          Flow · try validation, a decline (card ending 0000), then a success
        </VariantTag>
        <CheckoutFlow />
      </div>
      <div>
        <VariantTag className="px-0 md:px-0">Issued ticket</VariantTag>
        <div className="flex flex-wrap gap-4">
          <IssuedTicket
            tier="General"
            holder="Aroha Ngata"
            serial="ATM-GE-04821"
          />
        </div>
      </div>
    </div>
  );
}
