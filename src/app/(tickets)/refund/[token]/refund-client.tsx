"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";

import {
  TicketMessage,
  TicketShell,
  fieldLabelClass,
  outlinePillClass,
  ticketPanelClass,
} from "~/components/tickets/ticket-shell";
import { Button, Skeleton, inputClass } from "~/components/site/ui";
import { api, type RouterOutputs } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDate } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";

type Offer = NonNullable<RouterOutputs["refundOffers"]["get"]>;

/**
 * Taking a refund an admin offered. Opening the page changes nothing: the
 * buyer asks for a code, it goes to the order's email, and the right code
 * refunds. Three steps in one place: the offer, the code, done.
 */
export default function RefundPage() {
  const { token } = useParams<{ token: string }>();
  const offer = api.refundOffers.get.useQuery({ token });
  const [step, setStep] = useState<"offer" | "code" | "done">("offer");
  const [refundedCents, setRefundedCents] = useState(0);
  const poster = offer.data?.posterFileId
    ? buildMediaUrl(offer.data.posterFileId)
    : null;

  if (offer.isPending) {
    return (
      <TicketShell>
        <Skeleton className="h-8 w-2/3 rounded-full" />
        <Skeleton className="mt-6 h-[420px] rounded-[var(--site-r-panel)] rounded-tl-none" />
      </TicketShell>
    );
  }

  if (!offer.data) {
    return (
      <TicketShell>
        <TicketMessage title="Link not found" showEventsLink>
          This link is wrong or incomplete. Open it again from the email.
        </TicketMessage>
      </TicketShell>
    );
  }

  const data = offer.data;

  if (step === "done") {
    return (
      <TicketShell poster={poster}>
        <div>
          <p className="t-label bg-site-accent text-site-accent-ink inline-flex items-center gap-1.5 rounded-full py-2 pr-3.5 pl-3 text-[10px]">
            <Check className="size-3.5" aria-hidden /> Refunded
          </p>
        </div>
        <h1 className="t-display mt-4 text-[clamp(1.8rem,8vw,2.6rem)]">
          {formatNZD(refundedCents)} is on its way
        </h1>
        <section className={cn(ticketPanelClass, "mt-6 space-y-5")}>
          <p className="text-[14px] text-white/70">
            It lands back on your card in 5 to 10 business days. Your tickets
            for {data.eventName} no longer work, and we&apos;ve emailed you a
            receipt.
          </p>
          <Link href="/events" className={cn(outlinePillClass, "w-full")}>
            See what&apos;s on
          </Link>
        </section>
      </TicketShell>
    );
  }

  if (data.state !== "open") {
    return (
      <TicketShell poster={poster}>
        <TicketMessage title="This offer has ended" showEventsLink>
          {data.state === "taken"
            ? "It has already been taken, and the refund is on its way."
            : data.state === "withdrawn"
              ? "It was withdrawn. Your tickets still work."
              : "It closed. Your tickets still work."}
        </TicketMessage>
      </TicketShell>
    );
  }

  return (
    <TicketShell poster={poster}>
      {step === "offer" ? (
        <OfferStep
          token={token}
          offer={data}
          onCodeSent={() => setStep("code")}
        />
      ) : (
        <CodeStep
          token={token}
          offer={data}
          onRefunded={(cents) => {
            setRefundedCents(cents);
            setStep("done");
          }}
        />
      )}
    </TicketShell>
  );
}

function OfferStep({
  token,
  offer,
  onCodeSent,
}: {
  token: string;
  offer: Offer;
  onCodeSent: () => void;
}) {
  const sendCode = api.refundOffers.sendCode.useMutation({
    onSuccess: onCodeSent,
  });
  const tickets = offer.ticketCount === 1 ? "your ticket" : "both tickets";
  return (
    <>
      <div>
        <p className="t-label bg-site-accent text-site-accent-ink inline-flex rounded-full px-3.5 py-2 text-[10px]">
          Refund offered
        </p>
      </div>
      <h1 className="t-display mt-4 text-[clamp(1.8rem,8vw,2.6rem)]">
        {offer.eventName}
      </h1>
      <p className="mt-2 text-[14px] text-white/60">
        {formatEventDate(offer.eventStartsAt, offer.timezone)}
      </p>

      <section className={cn(ticketPanelClass, "mt-6 space-y-5")}>
        <blockquote className="border-l-2 border-white/25 pl-3 text-[14px] whitespace-pre-line text-white/85">
          {offer.message}
          <span className="mt-1.5 block text-[12px] text-white/45">
            {offer.offeredBy ? `${offer.offeredBy}, Atmos` : "Atmos"}
          </span>
        </blockquote>

        <dl className="space-y-1.5 text-[14px]">
          {offer.lines.map((line) => (
            <div key={line.tier} className="flex justify-between gap-4">
              <dt className="text-white/60">
                {line.count} × {line.tier}
              </dt>
              <dd className="text-white/80 tabular-nums">
                {formatNZD(line.cents)}
              </dd>
            </div>
          ))}
          {offer.feeCents > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-white/60">Booking fee</dt>
              <dd className="text-white/80 tabular-nums">
                {formatNZD(offer.feeCents)}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-white/10 pt-3 text-white">
            <dt className="t-label text-[12px]">Back to your card</dt>
            <dd className="t-display text-xl tabular-nums">
              {formatNZD(offer.amountCents)}
            </dd>
          </div>
        </dl>

        <p className="text-[14px] text-white/70">
          {offer.ticketCount > 2
            ? `Taking it cancels all ${offer.ticketCount} tickets.`
            : `Taking it cancels ${tickets}.`}{" "}
          To make sure it&apos;s you, we&apos;ll email a code to{" "}
          <span className="text-white">{offer.maskedEmail}</span>.
        </p>

        <Button
          variant="accent"
          size="lg"
          className="w-full"
          disabled={sendCode.isPending}
          onClick={() => sendCode.mutate({ token })}
        >
          {sendCode.isPending ? "Sending…" : "Email me a code"}
        </Button>
        {sendCode.error && (
          <p role="alert" className="text-site-danger-text text-[14px]">
            {sendCode.error.message}
          </p>
        )}
        <p className="text-center text-[12px] text-white/50">
          Open until {formatEventDate(offer.expiresAt, offer.timezone)}. Keeping
          your {offer.ticketCount === 1 ? "ticket" : "tickets"}? Close this
          page.
        </p>
      </section>
    </>
  );
}

function CodeStep({
  token,
  offer,
  onRefunded,
}: {
  token: string;
  offer: Offer;
  onRefunded: (cents: number) => void;
}) {
  const [code, setCode] = useState("");
  const take = api.refundOffers.take.useMutation({
    onSuccess: ({ amountCents }) => onRefunded(amountCents),
  });
  const resend = api.refundOffers.sendCode.useMutation();
  const error = take.error?.message ?? resend.error?.message;

  return (
    <>
      <h1 className="t-display mt-4 text-[clamp(1.8rem,8vw,2.6rem)]">
        Check your email
      </h1>
      <form
        className={cn(ticketPanelClass, "mt-6 space-y-5")}
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) take.mutate({ token, code });
        }}
      >
        <p className="text-[14px] text-white/70">
          We sent a 6-digit code to {offer.maskedEmail}. It works for 10
          minutes.
        </p>
        <div className="space-y-2">
          <label htmlFor="refund-code" className={fieldLabelClass}>
            Code
          </label>
          <input
            id="refund-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={cn(
              inputClass,
              "text-center text-[22px] tracking-[0.5em] tabular-nums",
            )}
            aria-invalid={!!take.error}
          />
        </div>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={code.length !== 6 || take.isPending}
        >
          {take.isPending
            ? "Refunding…"
            : `Refund ${formatNZD(offer.amountCents)}`}
        </Button>
        {error && (
          <p role="alert" className="text-site-danger-text text-[14px]">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => {
            setCode("");
            take.reset();
            resend.mutate({ token });
          }}
          className="mx-auto block text-[14px] text-white/55 underline underline-offset-4 transition-colors hover:text-white disabled:opacity-50"
        >
          {resend.isSuccess ? "New code sent" : "Send a new code"}
        </button>
      </form>
    </>
  );
}
