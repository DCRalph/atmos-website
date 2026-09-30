"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { env } from "~/env";
import { Button, inputClass } from "~/components/site/ui";
import { api } from "~/trpc/react";
import { formatNZD } from "~/lib/ticketing/money";

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
 * Paying, in place.
 *
 * This renders inside the buy panel rather than replacing it: picking tickets
 * and paying for them are one step, and the screen that used to sit between
 * them existed only because the payment intent needed an order to exist first.
 * That's now handled behind the tick-box, so there is nothing left to click
 * through.
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

export function CheckoutSection({ session }: { session: CheckoutSession }) {
  if (session.isFree) {
    return <FreeClaim session={session} />;
  }

  const stripe = getStripePromise();

  if (!stripe || !session.clientSecret) {
    return (
      <p className="text-[14px] text-[var(--site-danger-text)]">
        Card payments aren&apos;t available right now. Try again shortly.
      </p>
    );
  }

  return (
    <Elements
      // Stripe won't accept a new client secret on a mounted Elements tree, so
      // changing the basket has to remount it. Keying on the secret is what
      // makes that happen instead of silently paying the old amount.
      key={session.clientSecret}
      stripe={stripe}
      options={{
        clientSecret: session.clientSecret,
        // Matches the site: true black, acid accent, soft 12px fields.
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#c6ff33",
            colorBackground: "#0b0b0b",
            colorText: "#ffffff",
            colorTextSecondary: "rgba(255,255,255,0.6)",
            colorDanger: "#ff8a8a",
            borderRadius: "12px",
            fontFamily: "system-ui, sans-serif",
          },
        },
      }}
    >
      <PaidCheckout session={session} />
    </Elements>
  );
}

function PaidCheckout({ session }: { session: CheckoutSession }) {
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
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={{ buttonHeight: 48 }}
        onClick={({ resolve }) => resolve({})}
        onConfirm={() => void pay()}
      />

      <p className="flex items-center gap-3 text-[12px] text-white/45">
        <span className="h-px flex-1 bg-white/10" />
        or pay by card
        <span className="h-px flex-1 bg-white/10" />
      </p>

      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <p
          role="alert"
          className="rounded-[var(--site-r-chip)] border border-[var(--site-danger)]/50 bg-[var(--site-danger)]/10 px-4 py-3 text-[14px] text-[var(--site-danger-text)]"
        >
          {error}
        </p>
      )}

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={!stripe || busy}
        aria-busy={busy}
        onClick={() => void pay()}
      >
        {busy ? "Paying…" : `Pay ${formatNZD(session.totalCents)}`}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-[12px] text-white/45">
        <ShieldCheck className="size-3.5" aria-hidden />
        Card details go straight to Stripe. We never see them.
      </p>
    </div>
  );
}

/**
 * Free tickets: one button.
 *
 * Nothing is asked here — the ticket is issued and the details page collects
 * the name and the email to send it to. The exception is a gated tier
 * (`needsDetailsUpFront`): a request awaiting approval has no ticket to hand
 * over yet and no way to tell anyone the answer, and a per-email cap checked
 * after issuing isn't a cap. Those two keep their form.
 */
function FreeClaim({ session }: { session: CheckoutSession }) {
  const router = useRouter();
  const askUpFront = session.needsDetailsUpFront;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const claim = api.ticketCheckout.claimFree.useMutation({
    onSuccess: (result) => {
      if ("awaitingApproval" in result && result.awaitingApproval) {
        toast.success("Request sent. We'll email you once it's approved.");
        router.push(`/tickets/${session.accessToken}`);
        return;
      }
      router.push(`/tickets/${session.accessToken}/details?new=1`);
    },
    onError: (cause) => setError(cause.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        claim.mutate({
          accessToken: session.accessToken,
          ...(askUpFront ? { email, name } : {}),
        });
      }}
    >
      {askUpFront && (
        <>
          <label className="block">
            <span className="t-label mb-2 block text-[10px] text-white/70">
              Your name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="t-label mb-2 block text-[10px] text-white/70">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
            <span className="mt-2 block pl-5 text-[12px] text-white/50">
              This ticket has to be checked against your email before it can be
              issued.
            </span>
          </label>
        </>
      )}

      {error && (
        <p role="alert" className="text-[14px] text-[var(--site-danger-text)]">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={claim.isPending}
        aria-busy={claim.isPending}
      >
        {claim.isPending ? "Getting your ticket…" : "Get my ticket"}
      </Button>

      <p className="text-center text-[12px] text-white/50">
        We&apos;ll ask who you are on the next page, once the ticket is yours.
      </p>
    </form>
  );
}
