"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ArrowLeft, CreditCard, Heart, ShieldCheck } from "lucide-react";
import { z } from "zod";

import { api } from "~/trpc/react";
import { LexicalContent } from "~/components/lexical";
import {
  getStripePromise,
  stripeAppearance,
  stripeFonts,
} from "~/components/ticketing/checkout-panel";
import type { donateGig } from "~/server/donations";
import {
  DONATION_PAYMENT_METHODS,
  donationCentsSchema,
  MIN_DONATION_CENTS,
} from "~/lib/donations";
import { formatNZDCompact, parsePriceToCents } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";
import type { DonationAmountChoice } from "~/lib/donation-analytics";
import {
  DonationAnalyticsProvider,
  useDonationAnalytics,
} from "./donation-analytics";
import { DonationThanks } from "./donation-thanks";
import { AtmosLogo, Button, IconButton, inputClass } from "../ui";

/** What `/gigs/[id]/donate` loads. */
type DonateGig = NonNullable<Awaited<ReturnType<typeof donateGig>>>;

/**
 * The donate page: the poster, big and whole, over a blur of itself, and one
 * glass panel that takes the money in place. Wallet buttons sit right under
 * the amounts so most people give in two taps; paying by card slides the
 * panel over to Stripe's card form. Poster beside the panel on a wide screen,
 * above it on a phone.
 */
export function DonatePage({
  gig,
  thankedCents,
}: {
  gig: DonateGig;
  /** Set when a redirecting payment method has just sent them back paid. */
  thankedCents: number | null;
}) {
  return (
    <DonationAnalyticsProvider
      key={gig.id}
      gigId={gig.id}
      gigTitle={gig.title}
      thankedCents={thankedCents}
    >
      <DonateContent gig={gig} thankedCents={thankedCents} />
    </DonationAnalyticsProvider>
  );
}

function DonateContent({
  gig,
  thankedCents,
}: {
  gig: DonateGig;
  thankedCents: number | null;
}) {
  const { track } = useDonationAnalytics();
  const [thanked, setThanked] = useState(thankedCents);
  const poster = gig.posterUrl;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      {poster ? (
        <Image
          src={poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 scale-110 object-cover blur-2xl brightness-50"
        />
      ) : null}
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/30" />

      <div
        className={cn(
          "mx-auto flex min-h-dvh max-w-[1000px] flex-col items-center justify-end gap-6 px-4 pt-10 pb-7 md:justify-center md:py-16",
          poster &&
            "md:grid md:grid-cols-[minmax(0,460px)_minmax(0,380px)] md:gap-12",
        )}
      >
        {poster ? (
          // Whole, at its own shape: a poster is worth seeing uncropped.
          <Image
            src={poster}
            alt={`${gig.title} poster`}
            width={920}
            height={1150}
            priority
            sizes="(min-width: 768px) 460px, 100vw"
            className="h-auto w-full max-w-[420px] rounded-[var(--site-r-panel)] shadow-2xl shadow-black/60 md:max-w-none"
          />
        ) : null}

        <div className="w-full max-w-[420px] md:max-w-[380px]">
          {/* Never taller than the screen: the title stays put and the slides
              scroll inside it instead. */}
          <section
            className={cn(
              "glass-dark flex max-h-[calc(100dvh-6rem)] flex-col gap-4 rounded-[var(--site-r-panel)] rounded-tl-none p-[22px] md:max-h-[calc(100dvh-11rem)]",
              thanked !== null && "overflow-y-auto",
            )}
          >
            {thanked !== null ? (
              <DonationThanks gig={gig} cents={thanked} />
            ) : (
              <>
                <div className="shrink-0 space-y-4">
                  <p className="t-label text-site-accent-text text-[10px]">
                    Support the night
                  </p>
                  <h1 className="t-display text-[30px] [overflow-wrap:anywhere]">
                    {gig.title}
                  </h1>
                </div>
                <DonateForm
                  gig={gig}
                  intro={
                    gig.description ? (
                      <LexicalContent
                        value={gig.description}
                        namespace={`gig-donation-${gig.id}`}
                        ariaLabel="About donating"
                        contentClassName="text-[15px] leading-relaxed text-white/75 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4 [&_li]:mb-1 [&_p:not(:last-child)]:mb-3 [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-5"
                      />
                    ) : null
                  }
                  onPaid={(cents) => {
                    track("donation_thank_you_viewed", { amount_cents: cents });
                    setThanked(cents);
                  }}
                />
              </>
            )}
          </section>
          <Link
            href="/"
            className="mx-auto mt-5 block w-20 opacity-50 transition-opacity hover:opacity-100"
          >
            <AtmosLogo />
          </Link>
        </div>
      </div>
    </main>
  );
}

type Stage = "amount" | "card";

/**
 * Pick an amount, then pay with a wallet button right there, or tap through
 * to the card form. One Elements group holds both, in Stripe's deferred mode:
 * the intent is only made once they pay, for whatever amount is picked then.
 * The intro sits above the amounts and slides away with them.
 */
function DonateForm({
  gig,
  intro,
  onPaid,
}: {
  gig: DonateGig;
  intro: ReactNode;
  onPaid: (cents: number) => void;
}) {
  const { track } = useDonationAnalytics();
  const id = useId();
  // The recommended suggestion starts picked. Without one, nothing does.
  const [picked, setPicked] = useState<number | "custom" | null>(
    gig.recommendedIndex,
  );
  const [custom, setCustom] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("amount");

  const cents =
    picked === "custom"
      ? parsePriceToCents(custom)
      : picked === null
        ? null
        : (gig.amountsCents[picked] ?? null);
  const parsed = donationCentsSchema.safeParse(cents);
  const amount = parsed.success ? parsed.data : null;
  const amountChoice: DonationAmountChoice =
    picked === "custom"
      ? "custom"
      : picked === gig.recommendedIndex
        ? "recommended"
        : "suggested";

  /** True when the amount can be paid; otherwise says why and stays put. */
  const ready = () => {
    if (parsed.success) return true;
    track("donation_payment_failed", {
      stage: "amount",
      error_code: picked === null ? "amount_missing" : "amount_invalid",
    });
    setInvalid(
      picked === null
        ? "Pick an amount."
        : cents === null
          ? "Enter an amount, like 15."
          : (parsed.error.issues[0]?.message ?? "That amount won't work."),
    );
    return false;
  };

  const stripe = getStripePromise();
  if (!stripe) {
    return (
      <div className="min-h-0 space-y-4 overflow-y-auto">
        {intro}
        <p className="text-site-danger-text text-[14px]">
          Payments aren&apos;t available right now. Try again shortly.
        </p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        mode: "payment",
        currency: "nzd",
        // Stripe needs some amount from the start. Until one is valid the
        // wallet buttons are covered, so this placeholder is never charged.
        amount: amount ?? MIN_DONATION_CENTS,
        // Must match `donations.intent`. Apple Pay and Google Pay are cards.
        paymentMethodTypes: [...DONATION_PAYMENT_METHODS],
        appearance: stripeAppearance,
        fonts: stripeFonts,
      }}
    >
      <Slides
        stage={stage}
        amount={
          <div className="space-y-4">
            {intro}
            <div className="space-y-3 pt-3">
              <AmountPicker
                id={id}
                gig={gig}
                picked={picked}
                custom={custom}
                invalid={invalid}
                onPick={(next) => {
                  setPicked(next);
                  setInvalid(null);
                  track("donation_amount_selected", {
                    amount_cents:
                      next === "custom"
                        ? parsePriceToCents(custom)
                        : (gig.amountsCents[next] ?? null),
                    amount_choice:
                      next === "custom"
                        ? "custom"
                        : next === gig.recommendedIndex
                          ? "recommended"
                          : "suggested",
                  });
                }}
                onCustom={(value) => {
                  setCustom(value);
                  setPicked("custom");
                  setInvalid(null);
                }}
              />
              <PayButtons
                gigId={gig.id}
                amount={amount}
                amountChoice={amountChoice}
                ready={ready}
                onCard={() => {
                  if (!ready()) return;
                  track("donation_checkout_started", {
                    amount_cents: amount,
                    amount_choice: amountChoice,
                    payment_method: "card",
                  });
                  setStage("card");
                }}
                onPaid={onPaid}
              />
              <Consent />
            </div>
          </div>
        }
        card={
          amount === null ? null : (
            <CardForm
              gigId={gig.id}
              amount={amount}
              amountChoice={amountChoice}
              onBack={() => {
                track("donation_amount_revisited", {});
                setStage("amount");
              }}
              onPaid={onPaid}
            />
          )
        }
      />
    </Elements>
  );
}

/**
 * Two panes side by side, sliding to the active one. The frame takes the
 * active pane's height, so the panel grows and shrinks with it, but shrinks
 * to fit the panel's cap, where each pane scrolls on its own.
 */
function Slides({
  stage,
  amount,
  card,
}: {
  stage: Stage;
  amount: ReactNode;
  card: ReactNode;
}) {
  const amountRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const amountHeight = useHeight(amountRef);
  const cardHeight = useHeight(cardRef);
  const onCard = stage === "card";

  return (
    <div
      className="-mx-1 flex min-h-0 overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
      style={{ height: onCard ? cardHeight : amountHeight }}
    >
      <div
        className="flex w-full gap-3 transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{
          transform: onCard ? "translateX(calc(-100% - 0.75rem))" : "none",
        }}
      >
        <Pane paneRef={amountRef} inert={onCard}>
          {amount}
        </Pane>
        <Pane paneRef={cardRef} inert={!onCard}>
          {card}
        </Pane>
      </div>
    </div>
  );
}

/**
 * One slide, scrolling inside the frame when it's too tall. The padding keeps
 * focus outlines clear of the clip; `paneRef` measures the content's height.
 */
function Pane({
  paneRef,
  inert,
  children,
}: {
  paneRef: RefObject<HTMLDivElement | null>;
  inert: boolean;
  children: ReactNode;
}) {
  return (
    <div
      inert={inert}
      className="w-full shrink-0 overflow-y-auto overscroll-contain"
    >
      <div ref={paneRef} className="px-1 pb-1">
        {children}
      </div>
    </div>
  );
}

/** An element's border-box height, kept current. Undefined until measured. */
function useHeight(ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry?.borderBoxSize[0]?.blockSize),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

/** Three suggestions and a custom amount. */
function AmountPicker({
  id,
  gig,
  picked,
  custom,
  invalid,
  onPick,
  onCustom,
}: {
  id: string;
  gig: DonateGig;
  picked: number | "custom" | null;
  custom: string;
  invalid: string | null;
  onPick: (picked: number | "custom") => void;
  onCustom: (value: string) => void;
}) {
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Suggested amounts"
        className="grid grid-cols-3 gap-2"
      >
        {gig.amountsCents.map((amount, index) => {
          const on = picked === index;
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(index)}
              className={cn(
                "t-display relative h-16 rounded-full border text-[22px] tabular-nums transition-colors",
                on
                  ? "border-site-accent bg-site-accent text-site-accent-ink"
                  : "border-white/25 bg-black/30 hover:border-white/60",
              )}
            >
              {index === gig.recommendedIndex ? (
                <span className="t-label absolute -top-2 left-1/2 -translate-x-1/2 rounded-[var(--site-r-chip)] bg-white px-1.5 py-[3px] text-[8px] whitespace-nowrap text-black">
                  Most give
                </span>
              ) : null}
              {formatNZDCompact(amount)}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "flex h-14 items-center gap-2 rounded-full border bg-black/30 px-5 focus-within:border-white/70",
          picked === "custom" && invalid
            ? "border-site-danger"
            : picked === "custom"
              ? "border-white/70"
              : "border-white/25",
        )}
      >
        <label className="sr-only" htmlFor={id}>
          Other amount, in dollars
        </label>
        <span aria-hidden className="text-[16px] text-white/55">
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={custom}
          onFocus={() => onPick("custom")}
          onChange={(e) => onCustom(e.target.value)}
          aria-invalid={picked === "custom" && !!invalid}
          aria-describedby={invalid ? `${id}-err` : undefined}
          placeholder="Other amount"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/45"
        />
      </div>

      {invalid ? (
        <p
          id={`${id}-err`}
          role="alert"
          className="text-site-danger-text pl-5 text-[13px]"
        >
          {invalid}
        </p>
      ) : null}
    </>
  );
}

/**
 * Apple Pay, Google Pay and Link as Stripe offers them on this device, then
 * the way through to the card form. Without a valid amount the wallet buttons
 * are covered by one that just says so, since a wallet sheet can't be opened
 * for nothing.
 */
function PayButtons({
  gigId,
  amount,
  amountChoice,
  ready,
  onCard,
  onPaid,
}: {
  gigId: string;
  amount: number | null;
  amountChoice: DonationAmountChoice;
  ready: () => boolean;
  onCard: () => void;
  onPaid: (cents: number) => void;
}) {
  const { track } = useDonationAnalytics();
  const donate = useDonate(gigId, amountChoice);
  // Null until Stripe says which wallets this device has, if any.
  const [wallets, setWallets] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className={cn("relative", amount === null && "opacity-50")}>
        <ExpressCheckoutElement
          options={{
            buttonHeight: 52,
            buttonType: { applePay: "donate", googlePay: "donate" },
            buttonTheme: { applePay: "white", googlePay: "white" },
            layout: { maxColumns: 1, overflow: "never" },
          }}
          onReady={({ availablePaymentMethods }) => {
            const methods = Object.entries(availablePaymentMethods ?? {})
              .filter(([, available]) => available)
              .map(([method]) => method);
            setWallets(methods.length > 0);
            track("donation_wallets_available", { payment_methods: methods });
          }}
          onLoadError={({ error }) =>
            track("donation_payment_failed", {
              stage: "loading",
              error_code: error.code ?? "wallet_load_failed",
            })
          }
          // The wallet already knows it, so a receipt costs them nothing.
          onClick={({ resolve, expressPaymentType }) => {
            track("donation_checkout_started", {
              amount_cents: amount,
              amount_choice: amountChoice,
              payment_method: expressPaymentType,
            });
            resolve({ emailRequired: true });
          }}
          onCancel={() => track("donation_wallet_cancelled", {})}
          onConfirm={async (event) => {
            if (amount === null) return event.paymentFailed();
            setError(null);
            const failed = await donate(
              amount,
              event.billingDetails?.email,
              event.expressPaymentType,
            );
            if (failed === null) return onPaid(amount);
            event.paymentFailed({ reason: "fail" });
            setError(failed);
          }}
        />
        {amount === null && wallets ? (
          <button
            type="button"
            aria-label="Pick an amount first"
            onClick={ready}
            className="absolute inset-0 z-10 cursor-pointer"
          />
        ) : null}
      </div>

      {wallets ? (
        <p className="flex items-center gap-3 text-[12px] text-white/45">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </p>
      ) : null}

      {error ? <PayError message={error} /> : null}

      <Button
        variant={wallets ? "outline" : "accent"}
        size="lg"
        className="w-full"
        onClick={onCard}
      >
        <CreditCard className="size-4" aria-hidden />
        {wallets
          ? "Pay by card"
          : amount !== null
            ? `Donate ${formatNZDCompact(amount)}`
            : "Donate"}
      </Button>
    </>
  );
}

const emailSchema = z.email();

/** The card form, slid in once they tap through. */
function CardForm({
  gigId,
  amount,
  amountChoice,
  onBack,
  onPaid,
}: {
  gigId: string;
  amount: number;
  amountChoice: DonationAmountChoice;
  onBack: () => void;
  onPaid: (cents: number) => void;
}) {
  const id = useId();
  const { track } = useDonationAnalytics();
  const donate = useDonate(gigId, amountChoice);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (trimmed && !emailSchema.safeParse(trimmed).success) {
      track("donation_payment_failed", {
        stage: "email",
        error_code: "email_invalid",
      });
      return setError("That email doesn't look right. Leave it empty to skip.");
    }
    setBusy(true);
    setError(null);
    const failed = await donate(amount, trimmed || undefined, "card");
    if (failed === null) return onPaid(amount);
    setError(failed);
    setBusy(false);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="space-y-3 pt-3"
    >
      <div className="flex items-center gap-3">
        <IconButton label="Change the amount" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
        </IconButton>
        <p className="t-display text-[22px]">
          Donate {formatNZDCompact(amount)}
        </p>
      </div>

      <label className="sr-only" htmlFor={id}>
        Email for a receipt, optional
      </label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email for a receipt (optional)"
        className={cn(inputClass, "text-[16px]")}
      />

      <PaymentElement
        onLoadError={({ error }) =>
          track("donation_payment_failed", {
            stage: "loading",
            error_code: error.code ?? "card_load_failed",
          })
        }
        options={{
          layout: "tabs",
          // The wallets have their own buttons a slide back.
          wallets: { applePay: "never", googlePay: "never" },
        }}
      />

      {error ? <PayError message={error} /> : null}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={busy}
        aria-busy={busy}
      >
        <Heart className="size-4 fill-current" aria-hidden />
        {busy ? "Donating…" : `Donate ${formatNZDCompact(amount)}`}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-white/45">
        <ShieldCheck className="size-3.5" aria-hidden />
        Card details go straight to Stripe. We never see them.
      </p>
      <Consent />
    </form>
  );
}

/**
 * What paying agrees to, under each way to pay. New tabs, so reading them
 * doesn't lose a half-filled card form.
 */
function Consent() {
  const link = "underline underline-offset-2 hover:text-white";
  return (
    <p className="text-center text-[12px] leading-relaxed text-white/45">
      Donating means you accept the{" "}
      <a
        href="/legal/donation-terms"
        target="_blank"
        rel="noreferrer"
        className={link}
      >
        donation terms
      </a>{" "}
      and{" "}
      <a
        href="/legal/privacy#donating"
        target="_blank"
        rel="noreferrer"
        className={link}
      >
        privacy policy
      </a>
      .
    </p>
  );
}

function PayError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border-site-danger/50 bg-site-danger/10 text-site-danger-text rounded-[var(--site-r-chip)] border px-4 py-3 text-[14px]"
    >
      {message}
    </p>
  );
}

/**
 * Pay a donation with whatever the Elements group holds: the wallet that was
 * just tapped, or the card form. Makes the intent, confirms it in place, then
 * records it. Resolves to an error to show, or null once paid. A method that
 * has to leave for its own page comes back to this page, which thanks them.
 */
function useDonate(gigId: string, amountChoice: DonationAmountChoice) {
  const { track, paymentContext } = useDonationAnalytics();
  const stripe = useStripe();
  const elements = useElements();
  const intent = api.donations.intent.useMutation();
  const confirm = api.donations.confirm.useMutation();

  return async (
    amountCents: number,
    email: string | undefined,
    paymentMethod: string,
  ): Promise<string | null> => {
    track("donation_payment_submitted", {
      amount_cents: amountCents,
      payment_method: paymentMethod,
    });
    let stage: "loading" | "validation" | "intent" | "payment" = "loading";
    try {
      if (!stripe || !elements) {
        track("donation_payment_failed", {
          stage,
          error_code: "stripe_not_ready",
        });
        return "Payments are still loading.";
      }
      stage = "validation";
      const submitted = await elements.submit();
      if (submitted.error) {
        track("donation_payment_failed", {
          stage,
          error_code: submitted.error.code ?? "validation_failed",
        });
        return submitted.error.message ?? "Check the details and try again.";
      }
      stage = "intent";
      const { clientSecret } = await intent.mutateAsync({
        gigId,
        amountCents,
        email,
        analytics: paymentContext(amountChoice),
      });
      stage = "payment";
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}`,
        },
        redirect: "if_required",
      });
      if (result.error) {
        track("donation_payment_failed", {
          stage,
          error_code:
            result.error.decline_code ?? result.error.code ?? "payment_failed",
        });
        return result.error.message ?? "That payment didn't go through.";
      }
      if (result.paymentIntent.status !== "succeeded") {
        track("donation_payment_processing", {
          amount_cents: amountCents,
          payment_method: paymentMethod,
        });
        return "Your payment is still processing. Please wait before trying again.";
      }
      // Recording here is a head start on the webhook, which does it anyway.
      await confirm
        .mutateAsync({ gigId, paymentIntentId: result.paymentIntent.id })
        .catch(() => null);
      return null;
    } catch (cause) {
      // Error messages can contain user input or Stripe secrets; report codes only.
      track("donation_payment_failed", { stage, error_code: "request_failed" });
      return cause instanceof Error ? cause.message : "Something went wrong.";
    }
  };
}
