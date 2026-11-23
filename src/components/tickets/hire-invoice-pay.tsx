"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ShieldCheck } from "lucide-react";

import { Button } from "~/components/site/ui";
import {
  getStripePromise,
  stripeAppearance,
  stripeFonts,
} from "~/components/ticketing/checkout-panel";
import { formatNZD } from "~/lib/ticketing/money";

/**
 * Paying a hire invoice on `/invoices/[token]`: wallets on top, then every
 * other method Stripe offers for invoices (card, Afterpay, Link...). The
 * client secret is the invoice's own payment, so paying here pays the Stripe
 * invoice. Afterwards the page reloads from the server, which asks Stripe and
 * shows it paid.
 */
export function HireInvoicePay({
  clientSecret,
  totalCents,
}: {
  clientSecret: string;
  totalCents: number;
}) {
  const stripe = getStripePromise();
  if (!stripe) {
    return (
      <p className="text-site-danger-text text-[14px]">
        Online payments aren&apos;t available right now. Try again shortly.
      </p>
    );
  }
  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: stripeAppearance,
        fonts: stripeFonts,
      }}
    >
      <PayForm totalCents={totalCents} />
    </Elements>
  );
}

function PayForm({ totalCents }: { totalCents: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      // Methods that leave the site (Afterpay, some banks) come back here.
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message ?? "That payment didn't go through.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={{ buttonHeight: 48 }}
        onConfirm={() => void pay()}
      />

      <p className="flex items-center gap-3 text-[12px] text-white/45">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </p>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void pay();
        }}
      >
        <PaymentElement options={{ layout: "tabs" }} />

        {error && (
          <p
            role="alert"
            className="border-site-danger/50 bg-site-danger/10 text-site-danger-text rounded-[var(--site-r-chip)] border px-4 py-3 text-[14px]"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={!stripe || busy}
          aria-busy={busy}
        >
          {busy ? "Paying…" : `Pay ${formatNZD(totalCents)}`}
        </Button>
      </form>

      <p className="flex items-center justify-center gap-1.5 text-[12px] text-white/45">
        <ShieldCheck className="size-3.5" aria-hidden />
        Payment details go straight to Stripe. We never see them.
      </p>
    </div>
  );
}
