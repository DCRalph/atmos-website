"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Loader2,
  Mail,
  MapPin,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  formatEventDateLong,
  formatEventTime,
} from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";
import { useIssuedOrder } from "~/hooks/use-issued-order";

/**
 * The buyer's tickets.
 *
 * Reached straight after payment and from the email, with no login. The QR
 * codes render first and everything else — names, receipt — sits underneath,
 * because the only thing that matters at 11pm is the code being on screen.
 */
export default function TicketsPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = params.token;
  const isNew = searchParams.get("new") === "1";

  const { order, refresh } = useIssuedOrder(token, isNew);

  if (order.isPending) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16 md:px-8">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-80 w-full" />
      </main>
    );
  }

  if (!order.data) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center md:px-8">
        <h1 className="text-3xl font-bold text-white">Tickets not found</h1>
        <p className="mt-3 text-white/50">
          This link is wrong, or it&apos;s been replaced by a newer one. Check
          the most recent email we sent you.
        </p>
        <Link
          href="/events"
          className="mt-6 inline-block border-2 border-white/20 px-5 py-2.5 text-white transition-colors hover:bg-white hover:text-black"
        >
          What&apos;s on
        </Link>
      </main>
    );
  }

  const data = order.data;

  if (!data.issued) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center md:px-8">
        <Loader2 className="mx-auto size-8 animate-spin text-white/40" />
        <h1 className="mt-6 text-2xl font-semibold text-white">
          {data.status === "AWAITING_APPROVAL"
            ? "Request received"
            : "Finishing up…"}
        </h1>
        <p className="mt-3 text-white/50">
          {data.status === "AWAITING_APPROVAL"
            ? "We'll email your ticket once someone approves it."
            : "Your tickets are being issued. This page will update on its own."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 md:px-8 md:py-16">
      {isNew && (
        <div className="mb-8 flex items-center gap-3 border-2 border-emerald-500/30 bg-emerald-500/10 p-4">
          <Check className="size-5 shrink-0 text-emerald-300" aria-hidden />
          <p className="text-sm text-emerald-100">
            You&apos;re in. We&apos;ve emailed a copy to{" "}
            {data.buyerEmail ?? "your inbox"}.
          </p>
        </div>
      )}

      {!data.detailsCompletedAt && (
        <div className="mb-8 border-2 border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-100">
            {data.buyerEmail
              ? "We don't know who these tickets are for yet."
              : "We haven't got an email address for these tickets yet."}{" "}
            <Link
              href={`/tickets/${token}/details`}
              className="underline underline-offset-4"
            >
              Add your details
            </Link>
            .
          </p>
        </div>
      )}

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          {data.event.name}
        </h1>
        <div className="mt-4 space-y-1.5 text-white/60">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 text-white/40" aria-hidden />
            {formatEventDateLong(data.event.startsAt, data.event.timezone)}
            {" · "}
            {data.event.doorsAt
              ? `doors ${formatEventTime(data.event.doorsAt, data.event.timezone)}`
              : formatEventTime(data.event.startsAt, data.event.timezone)}
          </p>
          {data.event.venueName && (
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-white/40" aria-hidden />
              {data.event.venueName}
              {data.event.venueAddress ? `, ${data.event.venueAddress}` : ""}
            </p>
          )}
        </div>

        {data.event.isR18 && (
          <p className="mt-4 inline-block border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-200">
            R18 — bring photo ID
          </p>
        )}

        {data.event.status === "CANCELLED" && (
          <p className="mt-4 border-2 border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            This event has been cancelled. These tickets are no longer valid.
          </p>
        )}
      </header>

      <section className="mt-10 space-y-5">
        {data.tickets.map((ticket, index) => (
          <article
            key={ticket.id}
            className="border-2 border-white/10 bg-black/80 p-5 text-center backdrop-blur-sm"
          >
            <p className="text-xs tracking-[0.14em] text-white/40 uppercase">
              Ticket {index + 1} of {data.tickets.length} · {ticket.tierName}
            </p>

            <div
              className="mx-auto mt-4 w-full max-w-70 bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
              // The SVG comes from our own QR renderer, not user input.
              dangerouslySetInnerHTML={{ __html: ticket.qrSvg }}
            />

            {ticket.attendeeName && (
              <p className="mt-4 text-lg font-semibold text-white">
                {ticket.attendeeName}
              </p>
            )}
            <p className="mt-1 font-mono text-sm text-white/40">
              {ticket.ticketNumber}
            </p>

            {(ticket.appleWalletUrl ?? ticket.googleWalletUrl) && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {ticket.appleWalletUrl && (
                  <a
                    href={ticket.appleWalletUrl}
                    className="inline-flex items-center gap-2 border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white hover:text-black"
                  >
                    <Wallet className="size-4" aria-hidden />
                    Apple Wallet
                  </a>
                )}
                {ticket.googleWalletUrl && (
                  <a
                    href={ticket.googleWalletUrl}
                    className="inline-flex items-center gap-2 border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white hover:text-black"
                  >
                    <Wallet className="size-4" aria-hidden />
                    Google Wallet
                  </a>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      {data.event.requireAttendeeNames && (
        <AttendeeNames token={token} tickets={data.tickets} onSaved={refresh} />
      )}

      <Receipt data={data} />

      <ResendButton token={token} email={data.buyerEmail} />
    </main>
  );
}

function AttendeeNames({
  token,
  tickets,
  onSaved,
}: {
  token: string;
  tickets: { id: string; attendeeName: string | null; tierName: string }[];
  onSaved: () => void;
}) {
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tickets.map((ticket) => [ticket.id, ticket.attendeeName ?? ""]),
    ),
  );

  const save = api.tickets.setAttendeeNames.useMutation({
    onSuccess: () => {
      toast.success("Saved — see you there.");
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  const allNamed = tickets.every((ticket) => Boolean(ticket.attendeeName));

  return (
    <section className="mt-10 border-2 border-white/10 bg-black/60 p-5">
      <h2 className="text-lg font-semibold text-white">
        {allNamed ? "Who's coming" : "Who's coming?"}
      </h2>
      <p className="mt-1 text-sm text-white/50">
        {allNamed
          ? "Change a name any time before the doors open."
          : "Optional, but it gets your group through the door faster."}
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            accessToken: token,
            names: tickets.map((ticket) => ({
              ticketId: ticket.id,
              attendeeName: names[ticket.id]?.trim() ?? "",
            })),
          });
        }}
      >
        {tickets.map((ticket, index) => (
          <div key={ticket.id} className="space-y-1.5">
            <Label htmlFor={`name-${ticket.id}`}>
              Ticket {index + 1} · {ticket.tierName}
            </Label>
            <Input
              id={`name-${ticket.id}`}
              value={names[ticket.id] ?? ""}
              onChange={(e) =>
                setNames((current) => ({
                  ...current,
                  [ticket.id]: e.target.value,
                }))
              }
              placeholder="Full name"
              autoComplete="off"
            />
          </div>
        ))}

        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save names"
          )}
        </Button>
      </form>
    </section>
  );
}

type TicketOrderView = NonNullable<RouterOutputs["tickets"]["byAccessToken"]>;

function Receipt({ data }: { data: TicketOrderView }) {
  return (
    <section className="mt-10 border-2 border-white/10 bg-black/60 p-5">
      <h2 className="text-xs tracking-[0.14em] text-white/40 uppercase">
        Receipt · Order {data.orderNumber}
      </h2>

      <dl className="mt-4 space-y-1.5 text-sm">
        <ReceiptRow
          label="Tickets"
          value={formatNZD(data.totals.subtotalCents)}
        />
        {data.totals.discountCents > 0 && (
          <ReceiptRow
            label="Discount"
            value={`−${formatNZD(data.totals.discountCents)}`}
          />
        )}
        {data.totals.bookingFeeCents > 0 && (
          <ReceiptRow
            label="Booking fee"
            value={formatNZD(data.totals.bookingFeeCents)}
          />
        )}
        <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
          <dt>Total paid</dt>
          <dd className="tabular-nums">{formatNZD(data.totals.totalCents)}</dd>
        </div>
        {data.totals.gstCents > 0 && (
          <ReceiptRow
            label="Includes GST"
            value={formatNZD(data.totals.gstCents)}
          />
        )}
        {data.totals.refundedCents > 0 && (
          <ReceiptRow
            label="Refunded"
            value={formatNZD(data.totals.refundedCents)}
          />
        )}
      </dl>

      {data.gstNumber && (
        <p className="mt-4 text-xs text-white/30">
          {data.legalName} · GST {data.gstNumber}
        </p>
      )}
    </section>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/50">{label}</dt>
      <dd className="tabular-nums text-white/70">{value}</dd>
    </div>
  );
}

function ResendButton({
  token,
  email,
}: {
  token: string;
  email: string | null;
}) {
  const resend = api.tickets.resend.useMutation({
    onSuccess: (result) =>
      toast.success(`Sent to ${result.sentTo ?? "your inbox"}.`),
    onError: (error) => toast.error(error.message),
  });

  if (!email) return null;

  return (
    <div className="mt-8 text-center">
      <button
        type="button"
        onClick={() => resend.mutate({ accessToken: token })}
        disabled={resend.isPending}
        className="inline-flex items-center gap-2 text-sm text-white/40 underline underline-offset-4 transition-colors hover:text-white disabled:opacity-50"
      >
        <Mail className="size-3.5" aria-hidden />
        {resend.isPending ? "Sending…" : `Email these tickets to ${email}`}
      </button>
    </div>
  );
}
