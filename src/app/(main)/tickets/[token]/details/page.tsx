"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";
import { useIssuedOrder } from "~/hooks/use-issued-order";

type TicketOrderView = NonNullable<RouterOutputs["tickets"]["byAccessToken"]>;

/**
 * The details step.
 *
 * The ticket already exists by the time anyone reaches this page — that's the
 * point. Nothing personal is asked for during checkout, so this is where the
 * buyer says who they are and, for a free order, where the email that the
 * ticket gets sent to finally arrives.
 *
 * The event leads: poster, name, when, where. Someone who has just paid wants
 * to see what they bought before they start typing.
 */
export default function TicketDetailsPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = params.token;
  const isNew = searchParams.get("new") === "1";

  const { order } = useIssuedOrder(token, isNew);

  if (order.isPending) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16 md:px-8">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="mt-6 h-10 w-2/3" />
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
    <main className="mx-auto w-full max-w-2xl px-5 py-10 md:px-8 md:py-14">
      <Banner
        ticketCount={data.tickets.length}
        emailed={Boolean(data.buyerEmail)}
        returning={Boolean(data.detailsCompletedAt)}
      />

      <EventHeader event={data.event} />

      <DetailsForm token={token} data={data} />
    </main>
  );
}

/**
 * This page is reached three ways and each one wants a different sentence:
 * fresh from a card payment (the email already went out), fresh from a free
 * claim (nothing has been sent, because there was nowhere to send it), or from
 * the "add names" link in the email much later.
 */
function Banner({
  ticketCount,
  emailed,
  returning,
}: {
  ticketCount: number;
  emailed: boolean;
  returning: boolean;
}) {
  if (returning) return null;

  const subject = ticketCount === 1 ? "Your ticket is" : "Your tickets are";

  return (
    <div className="flex items-center gap-3 border-2 border-emerald-500/30 bg-emerald-500/10 p-4">
      <Check className="size-5 shrink-0 text-emerald-300" aria-hidden />
      <p className="text-sm text-emerald-100">
        {subject} sorted.{" "}
        {emailed
          ? "Just tell us who's coming."
          : `Tell us where to send ${ticketCount === 1 ? "it" : "them"}.`}
      </p>
    </div>
  );
}

function EventHeader({ event }: { event: TicketOrderView["event"] }) {
  return (
    <header className="mt-8">
      {event.posterFileUploadId && (
        <div className="relative mb-6 aspect-square w-full max-w-xs overflow-hidden border-2 border-white/10 bg-black/20">
          <Image
            src={buildMediaUrl(event.posterFileUploadId)}
            alt={`${event.name} poster`}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
        {event.name}
      </h1>

      <div className="mt-4 space-y-1.5 text-white/60">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 text-white/40" aria-hidden />
          {formatEventDateLong(event.startsAt, event.timezone)}
          {" · "}
          {event.doorsAt
            ? `doors ${formatEventTime(event.doorsAt, event.timezone)}`
            : formatEventTime(event.startsAt, event.timezone)}
        </p>
        {event.venueName && (
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-white/40" aria-hidden />
            {event.venueName}
            {event.venueAddress ? `, ${event.venueAddress}` : ""}
          </p>
        )}
      </div>

      {event.isR18 && (
        <p className="mt-4 inline-block border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-200">
          R18 — bring photo ID
        </p>
      )}
    </header>
  );
}

function DetailsForm({
  token,
  data,
}: {
  token: string;
  data: TicketOrderView;
}) {
  const router = useRouter();
  const tickets = data.tickets;
  const isGroup = tickets.length > 1;

  const [buyerName, setBuyerName] = useState(data.buyerName ?? "");
  const [buyerEmail, setBuyerEmail] = useState(data.buyerEmail ?? "");
  // Carried over rather than defaulted: a buyer who ticked this at checkout
  // must not be quietly un-subscribed by saving their name.
  const [marketing, setMarketing] = useState(data.marketingOptIn);
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tickets.map((ticket) => [ticket.id, ticket.attendeeName ?? ""]),
    ),
  );

  const save = api.tickets.saveDetails.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.emailedTo
          ? `Sent to ${result.emailedTo}. See you there.`
          : "Saved — see you there.",
      );
      router.push(`/tickets/${token}`);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <form
      className="mt-10 space-y-10"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          accessToken: token,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          marketingOptIn: marketing,
          // On a single ticket the buyer is the person going, so there's no
          // reason to make them type their own name a second time.
          names: isGroup
            ? tickets.map((ticket) => ({
                ticketId: ticket.id,
                attendeeName: names[ticket.id]?.trim() ?? "",
              }))
            : tickets.map((ticket) => ({
                ticketId: ticket.id,
                attendeeName: buyerName.trim(),
              })),
        });
      }}
    >
      <section className="border-2 border-white/10 bg-black/60 p-5">
        <h2 className="text-lg font-semibold text-white">Who are you?</h2>
        <p className="mt-1 text-sm text-white/50">
          {data.buyerEmail
            ? "We've got this from your payment — change it if it's wrong."
            : `We'll email ${isGroup ? "the tickets" : "your ticket"} here. Nothing else without your say-so.`}
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="buyer-name">Your name</Label>
            <Input
              id="buyer-name"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="buyer-email">Email</Label>
            <Input
              id="buyer-email"
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 pt-1 text-sm text-white/50">
            <Checkbox
              checked={marketing}
              onCheckedChange={(value) => setMarketing(Boolean(value))}
            />
            <span>Email me about future Atmos events. Optional.</span>
          </label>
        </div>
      </section>

      {isGroup && (
        <section className="border-2 border-white/10 bg-black/60 p-5">
          <h2 className="text-lg font-semibold text-white">Who&apos;s coming?</h2>
          <p className="mt-1 text-sm text-white/50">
            A name on each ticket gets your group through the door faster. You
            can change these any time before the doors open.
          </p>

          <div className="mt-5 space-y-4">
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
                  placeholder={index === 0 ? "You" : "Full name"}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={save.isPending}
        >
          {save.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save and show my tickets"
          )}
        </Button>

        <p className="text-center">
          <Link
            href={`/tickets/${token}`}
            className="text-sm text-white/40 underline underline-offset-4 transition-colors hover:text-white"
          >
            Skip — take me to my tickets
          </Link>
        </p>
      </div>
    </form>
  );
}
