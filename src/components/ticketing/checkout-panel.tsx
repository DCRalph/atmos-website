"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { env } from "~/env";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api, type RouterOutputs } from "~/trpc/react";
import { formatCountdown } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";

type PublicEvent = NonNullable<RouterOutputs["ticketEvents"]["bySlug"]>;

export type CheckoutSession = {
  orderId: string;
  accessToken: string;
  clientSecret: string | null;
  totalCents: number;
  isFree: boolean;
  expiresAt: Date | null;
  /** A gated tier that can't be issued before we know who is claiming it. */
  needsDetailsUpFront: boolean;
};

/**
 * The payment step.
 *
 * Express Checkout (Apple Pay / Google Pay / Link) sits at the top because it
 * is the whole point of the flow: one tap, no typing, and the buyer's email
 * arrives from the wallet rather than a form. The card form underneath is the
 * fallback, not the headline.
 *
 * Neither path asks who the buyer is. Everyone lands on
 * `/tickets/[token]/details` afterwards, ticket already in hand.
 */

let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  const key = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

export function CheckoutPanel({
  event,
  session,
  onCancel,
}: {
  event: PublicEvent;
  session: CheckoutSession;
  onCancel: () => void;
}) {
  if (session.isFree) {
    return <FreeClaimForm event={event} session={session} onCancel={onCancel} />;
  }

  const stripe = getStripePromise();

  if (!stripe || !session.clientSecret) {
    return (
      <Shell onCancel={onCancel} orderId={session.orderId} expiresAt={session.expiresAt}>
        <p className="text-sm text-red-300">
          Card payments aren&apos;t available right now. Try again shortly.
        </p>
      </Shell>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret: session.clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorBackground: "#0b0b0c",
            colorText: "#f4f4f5",
            borderRadius: "0px",
            fontFamily: "system-ui, sans-serif",
          },
        },
      }}
    >
      <PaidCheckout event={event} session={session} onCancel={onCancel} />
    </Elements>
  );
}

function PaidCheckout({
  event,
  session,
  onCancel,
}: {
  event: PublicEvent;
  session: CheckoutSession;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = api.ticketCheckout.confirm.useMutation();

  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/tickets/${session.accessToken}/details?new=1`;
  }, [session.accessToken]);

  async function pay() {
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        // Most card payments finish inline; only methods that genuinely need a
        // redirect (some wallets, bank redirects) will navigate away.
        redirect: "if_required",
      });

      if (result.error) {
        setError(result.error.message ?? "That payment didn't go through.");
        setBusy(false);
        return;
      }

      // Issue immediately rather than waiting for the webhook, so the tickets
      // are on screen by the time the buyer looks up.
      await confirm.mutateAsync({ accessToken: session.accessToken });
      router.push(`/tickets/${session.accessToken}/details?new=1`);
    } catch (cause) {
      setBusy(false);
      const message =
        cause instanceof Error ? cause.message : "Something went wrong.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Shell onCancel={onCancel} orderId={session.orderId} expiresAt={session.expiresAt}>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-white/50">{event.name}</p>
          <p className="text-2xl font-semibold text-white">
            {formatNZD(session.totalCents)}
          </p>
        </div>

        <ExpressCheckoutElement
          options={{ buttonHeight: 48 }}
          onClick={({ resolve }) => resolve({})}
          onConfirm={() => void pay()}
        />

        <div className="flex items-center gap-3 text-xs text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          OR PAY BY CARD
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <PaymentElement options={{ layout: "tabs" }} />

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!stripe || busy}
          onClick={() => void pay()}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Processing…
            </>
          ) : (
            `Pay ${formatNZD(session.totalCents)}`
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-white/30">
          <ShieldCheck className="size-3.5" aria-hidden />
          Card details go straight to Stripe — we never see them.
        </p>
      </div>
    </Shell>
  );
}

/**
 * Free tickets: a tick-box and a button.
 *
 * Nothing is asked here — the ticket is issued and the details page collects
 * the name and the email to send it to. The exception is a gated tier
 * (`needsDetailsUpFront`): a request awaiting approval has no ticket to hand
 * over yet and no way to tell anyone the answer, and a per-email cap checked
 * after issuing isn't a cap. Those two keep their form.
 */
function FreeClaimForm({
  event,
  session,
  onCancel,
}: {
  event: PublicEvent;
  session: CheckoutSession;
  onCancel: () => void;
}) {
  const router = useRouter();
  const askUpFront = session.needsDetailsUpFront;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const claim = api.ticketCheckout.claimFree.useMutation({
    onSuccess: (result) => {
      if ("awaitingApproval" in result && result.awaitingApproval) {
        toast.success("Request sent — we'll email you once it's approved.");
        router.push(`/tickets/${session.accessToken}`);
        return;
      }
      router.push(`/tickets/${session.accessToken}/details?new=1`);
    },
    onError: (cause) => setError(cause.message),
  });

  return (
    <Shell onCancel={onCancel} orderId={session.orderId} expiresAt={session.expiresAt}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          claim.mutate({
            accessToken: session.accessToken,
            ...(askUpFront ? { email, name } : {}),
          });
        }}
      >
        <div>
          <p className="text-sm text-white/50">{event.name}</p>
          <p className="text-2xl font-semibold text-white">Free entry</p>
        </div>

        {askUpFront ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="claim-name">Your name</Label>
              <Input
                id="claim-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="claim-email">Email</Label>
              <Input
                id="claim-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <p className="text-xs text-white/40">
                This ticket has to be checked against your email before it can
                be issued.
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/50">
            Grab it now — we&apos;ll ask who you are on the next page, once the
            ticket is yours.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={claim.isPending}
        >
          {claim.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Getting your ticket…
            </>
          ) : (
            "Get my ticket"
          )}
        </Button>
      </form>
    </Shell>
  );
}

/** Shared frame: back button and the hold countdown. */
function Shell({
  children,
  onCancel,
  orderId,
  expiresAt,
}: {
  children: React.ReactNode;
  onCancel: () => void;
  orderId: string;
  expiresAt: Date | null;
}) {
  const release = api.ticketCheckout.release.useMutation();

  return (
    <section className="space-y-4 border-2 border-white/10 bg-black/80 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b-2 border-white/10 pb-3">
        <button
          type="button"
          onClick={() => {
            // Hand the seats back straight away rather than making the next
            // buyer wait out the hold.
            release.mutate({ orderId });
            onCancel();
          }}
          className="flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        {expiresAt && <HoldCountdown expiresAt={expiresAt} onExpired={onCancel} />}
      </div>
      {children}
    </section>
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
        toast.error("Your reservation expired. Please choose your tickets again.");
        onExpired();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const urgent = remaining < 60_000;

  return (
    <span
      className={`text-sm tabular-nums ${urgent ? "text-amber-300" : "text-white/40"}`}
      aria-live="polite"
    >
      Held for {formatCountdown(remaining)}
    </span>
  );
}
