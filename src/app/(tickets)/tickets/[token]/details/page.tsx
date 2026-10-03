"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { SiteCheckbox } from "~/components/site/inputs";
import { Button, Skeleton, inputClass } from "~/components/site/ui";
import {
  PassCard,
  PassField,
  PassFields,
  PassHeader,
  TicketMessage,
  TicketShell,
  fieldLabelClass,
  ticketPanelClass,
} from "~/components/tickets/ticket-shell";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";
import { cn } from "~/lib/utils";
import { useIssuedOrder } from "~/hooks/use-issued-order";

type TicketOrderView = NonNullable<RouterOutputs["tickets"]["byAccessToken"]>;

/**
 * Split a stored name back into the two boxes.
 *
 * Names arrive from Stripe as one string and are stored as one string, because
 * plenty of people don't have two of them. The first whitespace-separated word
 * is treated as the given name and everything after it as the family name,
 * which is wrong for some people and right for most — and either way nothing
 * is lost, since the two boxes are joined back together on save.
 */
function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/**
 * The details step.
 *
 * The ticket already exists by the time anyone reaches this page — that's the
 * point. Nothing personal is asked for during checkout, so this is where the
 * buyer says who they are and, for a free order, where the email that the
 * ticket gets sent to finally arrives.
 *
 * The event leads, as the same pass the tickets page shows: poster, name,
 * when, where. Someone who has just paid wants to see what they bought before
 * they start typing.
 */
export default function TicketDetailsPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = params.token;
  const isNew = searchParams.get("new") === "1";

  const { order } = useIssuedOrder(token, isNew);

  if (order.isPending) {
    return (
      <TicketShell>
        <Skeleton className="h-64 rounded-[var(--site-r-panel)] rounded-tl-none" />
        <Skeleton className="mt-6 h-80 rounded-[var(--site-r-panel)] rounded-tl-none" />
      </TicketShell>
    );
  }

  if (!order.data) {
    return (
      <TicketShell>
        <TicketMessage title="Tickets not found" showEventsLink>
          This link is wrong, or it&apos;s been replaced by a newer one. Check
          the most recent email we sent you.
        </TicketMessage>
      </TicketShell>
    );
  }

  const data = order.data;
  const poster = data.event.posterFileUploadId
    ? buildMediaUrl(data.event.posterFileUploadId)
    : null;

  if (!data.issued) {
    // No spinner: the page polls and swaps itself in when the tickets exist.
    return (
      <TicketShell poster={poster}>
        <TicketMessage
          title={
            data.status === "AWAITING_APPROVAL"
              ? "Request received"
              : "Finishing up"
          }
        >
          {data.status === "AWAITING_APPROVAL"
            ? "We'll email your ticket once someone approves it."
            : "Your tickets are being issued. This page will update on its own."}
        </TicketMessage>
      </TicketShell>
    );
  }

  return (
    <TicketShell poster={poster}>
      <Banner
        ticketCount={data.tickets.length}
        emailed={Boolean(data.buyerEmail)}
        returning={Boolean(data.detailsCompletedAt)}
      />

      <EventPass event={data.event} poster={poster} />

      <DetailsForm token={token} data={data} />
    </TicketShell>
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
    <div className="mb-6">
      <p className="t-label inline-flex items-center gap-1.5 rounded-full bg-[var(--site-accent)] py-2 pr-3.5 pl-3 text-[10px] text-[var(--site-accent-ink)]">
        <Check className="size-3.5" aria-hidden /> You&apos;re in
      </p>
      <p className="mt-3 text-[14px] text-white/70">
        {subject} sorted.{" "}
        {emailed
          ? "Just tell us who's coming."
          : `Tell us where to send ${ticketCount === 1 ? "it" : "them"}.`}
      </p>
    </div>
  );
}

/** What they bought, before anything is asked of them. No QR yet. */
function EventPass({
  event,
  poster,
}: {
  event: TicketOrderView["event"];
  poster: string | null;
}) {
  return (
    <PassCard>
      <PassHeader
        as="h1"
        poster={poster}
        kicker={`${formatEventDate(event.startsAt, event.timezone)} · ${formatEventTime(event.startsAt, event.timezone)}`}
        title={event.name}
      />
      <PassFields>
        <PassField label={event.doorsAt ? "Doors" : "Starts"}>
          {formatEventTime(event.doorsAt ?? event.startsAt, event.timezone)}
        </PassField>
        {event.venueName ? (
          <PassField label="Venue">
            {event.venueName}
            {event.venueAddress ? (
              <span className="mt-0.5 block text-[12px] text-white/55">
                {event.venueAddress}
              </span>
            ) : null}
          </PassField>
        ) : null}
        {event.isR18 ? (
          <PassField label="Age">R18, bring photo ID</PassField>
        ) : null}
      </PassFields>
    </PassCard>
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
  const utils = api.useUtils();
  const tickets = data.tickets;
  const isGroup = tickets.length > 1;

  const existing = splitName(data.buyerName);
  const [firstName, setFirstName] = useState(existing.first);
  const [lastName, setLastName] = useState(existing.last);
  const [buyerEmail, setBuyerEmail] = useState(data.buyerEmail ?? "");
  // Carried over rather than defaulted: a buyer who ticked this at checkout
  // must not be quietly un-subscribed by saving their name.
  const [marketing, setMarketing] = useState(data.marketingOptIn);
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tickets.map((ticket) => [ticket.id, ticket.attendeeName ?? ""]),
    ),
  );
  // Which attendee fields the buyer has actually typed in. The first ticket
  // mirrors the name above until they do, so nobody types their own name twice.
  const [edited, setEdited] = useState<Record<string, boolean>>({});

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const attendeeName = (ticket: (typeof tickets)[number], index: number) => {
    const typed = names[ticket.id] ?? "";
    // A field they've touched wins even when they've cleared it.
    if (edited[ticket.id] === true || typed !== "") return typed;
    return index === 0 ? fullName : "";
  };

  const save = api.tickets.saveDetails.useMutation({
    onSuccess: async (result) => {
      toast.success(
        result.emailedTo
          ? `Sent to ${result.emailedTo}. See you there.`
          : "Saved. See you there.",
      );
      // Both pages read the same query, so the tickets page would otherwise
      // render the pre-save order and ask for the email all over again.
      await utils.tickets.byAccessToken.invalidate();
      router.push(`/tickets/${token}`);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          accessToken: token,
          buyerName: fullName,
          buyerEmail: buyerEmail.trim(),
          marketingOptIn: marketing,
          // On a single ticket the buyer is the person going, so their name is
          // the attendee name.
          names: isGroup
            ? tickets.map((ticket, index) => ({
                ticketId: ticket.id,
                attendeeName: attendeeName(ticket, index).trim(),
              }))
            : tickets.map((ticket) => ({
                ticketId: ticket.id,
                attendeeName: fullName,
              })),
        });
      }}
    >
      <section className={ticketPanelClass}>
        <h2 className="t-display text-xl normal-case">Who are you?</h2>
        <p className="mt-2 text-[14px] text-white/60">
          {data.buyerEmail
            ? "We've got this from your payment. Change it if it's wrong."
            : `We'll email ${isGroup ? "the tickets" : "your ticket"} here. Nothing else without your say-so.`}
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="first-name" className={fieldLabelClass}>
                First name
              </label>
              <input
                className={inputClass}
                id="first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="last-name" className={fieldLabelClass}>
                Last name
              </label>
              <input
                className={inputClass}
                id="last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="buyer-email" className={fieldLabelClass}>
              Email
            </label>
            <input
              className={inputClass}
              id="buyer-email"
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          {/* The only marketing ask in the whole flow, and it lives here
              rather than beside the pay button on purpose: consent given
              next to a payment is consent nobody read. */}
          <div className="border-t border-white/10 pt-4">
            <SiteCheckbox
              id="marketing"
              checked={marketing}
              onCheckedChange={setMarketing}
            >
              Email me about future Atmos events.
              <span className="mt-1 block text-[12px] text-white/50">
                Entirely optional. Your ticket works either way, and you can
                unsubscribe from any email we send.
              </span>
            </SiteCheckbox>
          </div>
        </div>
      </section>

      {isGroup && (
        <section className={ticketPanelClass}>
          <h2 className="t-display text-xl normal-case">Who&apos;s coming?</h2>
          <p className="mt-2 text-[14px] text-white/60">
            A name on each ticket gets your group through the door faster. You
            can change these any time before the doors open.
          </p>

          <div className="mt-5 space-y-4">
            {tickets.map((ticket, index) => (
              <div key={ticket.id} className="space-y-2">
                <label
                  htmlFor={`name-${ticket.id}`}
                  className={fieldLabelClass}
                >
                  Ticket {index + 1}
                  <span className="ml-2 text-white/40">{ticket.tierName}</span>
                </label>
                <input
                  className={cn(inputClass, "disabled:opacity-50")}
                  id={`name-${ticket.id}`}
                  value={attendeeName(ticket, index)}
                  // A locked ticket already belongs to somebody: it went out in
                  // their name, or they have walked in on it.
                  disabled={ticket.nameLocked}
                  onChange={(e) => {
                    setEdited((current) => ({ ...current, [ticket.id]: true }));
                    setNames((current) => ({
                      ...current,
                      [ticket.id]: e.target.value,
                    }));
                  }}
                  placeholder={index === 0 ? "You" : "Full name"}
                  autoComplete="off"
                />
                {ticket.nameLocked && (
                  <p className="pl-5 text-[12px] text-white/50">
                    Set for good. Get in touch if this needs changing.
                  </p>
                )}
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
          {save.isPending ? "Saving…" : "Save and show my tickets"}
        </Button>

        <p className="text-center">
          <Link
            href={`/tickets/${token}`}
            className="text-[14px] text-white/55 underline underline-offset-4 transition-colors hover:text-white"
          >
            Skip, take me to my tickets
          </Link>
        </p>
      </div>
    </form>
  );
}
