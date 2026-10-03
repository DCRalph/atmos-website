"use client";

import { useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Check, Mail, Pencil } from "lucide-react";
import { toast } from "sonner";

import { WalletButtons } from "~/components/tickets/wallet-buttons";
import {
  DangerNotice,
  LevelChip,
  PassCard,
  PassCode,
  PassField,
  PassFields,
  PassHeader,
  TicketMessage,
  TicketShell,
  fieldLabelClass,
  ticketPanelClass,
} from "~/components/tickets/ticket-shell";
import { Button, Skeleton, inputClass } from "~/components/site/ui";
import { api, type RouterOutputs } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";
import { useIssuedOrder } from "~/hooks/use-issued-order";

/**
 * The buyer's tickets, as wallet-style passes over the event's blurred poster.
 *
 * Reached from the email and from the details step, with no login. Anything
 * still being asked of the buyer sits above the QR codes — a form underneath
 * three full-width codes is a form nobody scrolls to — and the receipt sits
 * below them, because it is the one thing here nobody is in a hurry to read.
 */
export default function TicketsPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = params.token;
  const isNew = searchParams.get("new") === "1";

  const { order, refresh } = useIssuedOrder(token, isNew);
  const [editingNames, setEditingNames] = useState(false);

  if (order.isPending) {
    return (
      <TicketShell>
        <Skeleton className="h-8 w-2/3 rounded-full" />
        <Skeleton className="mt-6 h-[560px] rounded-[var(--site-r-panel)] rounded-tl-none" />
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

  // Something the buyer still has to answer: an address to send the tickets
  // to, or a ticket in the group with nobody's name on it.
  // Locked tickets are excluded: their names are settled, so chasing the buyer
  // for one they cannot change would be a prompt with no way to satisfy it.
  const unanswered =
    !data.buyerEmail ||
    (data.event.requireAttendeeNames &&
      data.tickets.some(
        (ticket) => !ticket.attendeeName && !ticket.nameLocked,
      ));

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
      <h1 className="sr-only">Your tickets for {data.event.name}</h1>
      {isNew && (
        <div className="mb-6">
          <p className="t-label inline-flex items-center gap-1.5 rounded-full bg-[var(--site-accent)] py-2 pr-3.5 pl-3 text-[10px] text-[var(--site-accent-ink)]">
            <Check className="size-3.5" aria-hidden /> You&apos;re in
          </p>
          <p className="mt-3 text-[14px] text-white/70">
            {data.buyerEmail
              ? `We've emailed a copy to ${data.buyerEmail}.`
              : "Add an email below and we'll send you a copy."}
          </p>
        </div>
      )}

      {data.event.status === "CANCELLED" && (
        <DangerNotice>
          This event has been cancelled. These tickets are no longer valid.
        </DangerNotice>
      )}

      {/* Only while something is actually being asked for. Once it's all
          filled in this collapses to a quiet edit button below the codes;
          it sits up here to be answered, not to be admired. */}
      {unanswered && (
        <div className="mb-6">
          <AttendeeDetails token={token} data={data} onSaved={refresh} />
        </div>
      )}

      <Passes data={data} poster={poster} />

      <Receipt data={data} />

      {!unanswered && data.event.requireAttendeeNames && (
        <div className="mt-8">
          {editingNames ? (
            <AttendeeDetails
              token={token}
              data={data}
              onSaved={() => {
                refresh();
                setEditingNames(false);
              }}
              onCancel={() => setEditingNames(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingNames(true)}
              className="mx-auto flex items-center gap-2 text-[14px] text-white/55 underline underline-offset-4 transition-colors hover:text-white"
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit names
            </button>
          )}
        </div>
      )}

      <ResendButton token={token} email={data.buyerEmail} />
    </TicketShell>
  );
}

/**
 * Every ticket as a wallet-style pass. On a phone more than one swipes
 * sideways, with the next pass peeking in and dots that jump between them.
 */
function Passes({
  data,
  poster,
}: {
  data: TicketOrderView;
  poster: string | null;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const many = data.tickets.length > 1;

  const onScroll = () => {
    const el = rail.current;
    const first = el?.firstElementChild;
    if (!el || !first) return;
    // Card width plus the 12px gap between cards.
    setActive(
      Math.round(el.scrollLeft / (first.getBoundingClientRect().width + 12)),
    );
  };

  const goTo = (index: number) =>
    rail.current?.children[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });

  return (
    <section aria-label="Your tickets">
      <div
        ref={rail}
        onScroll={many ? onScroll : undefined}
        // Swipes on phones; wider screens have the room to stack them.
        className={cn(
          many &&
            "space-y-5 max-sm:-mx-5 max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-5 max-sm:[scrollbar-width:none] max-sm:gap-3 max-sm:space-y-0 max-sm:overflow-x-auto max-sm:px-5 max-sm:[&::-webkit-scrollbar]:hidden",
        )}
      >
        {data.tickets.map((ticket, index) => (
          <Pass
            key={ticket.id}
            data={data}
            ticket={ticket}
            index={index}
            poster={poster}
            className={
              many
                ? "max-sm:w-[88%] max-sm:shrink-0 max-sm:snap-start"
                : undefined
            }
          />
        ))}
      </div>
      {many && (
        <div className="mt-4 flex items-center justify-center gap-1.5 sm:hidden">
          {data.tickets.map((ticket, index) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show ticket ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color]",
                index === active ? "w-5 bg-white" : "w-1.5 bg-white/35",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type IssuedTicket = TicketOrderView["tickets"][number];

function Pass({
  data,
  ticket,
  index,
  poster,
  className,
}: {
  data: TicketOrderView;
  ticket: IssuedTicket;
  index: number;
  poster: string | null;
  className?: string;
}) {
  const { event } = data;
  const doors = event.doorsAt ?? event.startsAt;

  return (
    <PassCard className={className}>
      <PassHeader
        poster={poster}
        kicker={`${formatEventDate(event.startsAt, event.timezone)} · ${formatEventTime(event.startsAt, event.timezone)}`}
        title={event.name}
      />
      <PassFields>
        <PassField label="Name">
          {ticket.attendeeName ?? (
            <span className="text-white/45">Not named yet</span>
          )}
        </PassField>
        <PassField label={`Ticket ${index + 1} of ${data.tickets.length}`}>
          {/* The tier is what was bought; the chip is what it gets you past. */}
          {ticket.tierName}
          <LevelChip accessLevel={ticket.accessLevel} />
        </PassField>
        <PassField label={event.doorsAt ? "Doors" : "Starts"}>
          {formatEventTime(doors, event.timezone)}
        </PassField>
        {event.venueName ? (
          <PassField label="Venue">{event.venueName}</PassField>
        ) : null}
      </PassFields>
      <PassCode qrSvg={ticket.qrSvg} number={ticket.ticketNumber}>
        {event.isR18 && (
          <p className="t-label mt-3 text-[10px] text-white/60">
            R18 · Bring photo ID
          </p>
        )}
        <WalletButtons
          apple={ticket.appleWalletUrl}
          google={ticket.googleWalletUrl}
        />
      </PassCode>
    </PassCard>
  );
}

/**
 * Names, and an address to send the tickets to if the order hasn't got one.
 *
 * A free ticket can be issued without an email, so somebody can be sitting on
 * this page looking at a perfectly good QR code that exists nowhere else. The
 * email field is the way out of that, and it only appears while it is needed.
 */
function AttendeeDetails({
  token,
  data,
  onSaved,
  onCancel,
}: {
  token: string;
  data: TicketOrderView;
  onSaved: () => void;
  /** Present only when this was opened from the collapsed edit button. */
  onCancel?: () => void;
}) {
  const tickets = data.tickets;
  const needsEmail = !data.buyerEmail;
  const wantsNames = data.event.requireAttendeeNames;

  const [email, setEmail] = useState("");
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tickets.map((ticket, index) => [
        ticket.id,
        // The buyer already gave their name on the details page; the first
        // ticket is theirs unless they say otherwise, so don't ask twice.
        ticket.attendeeName ?? (index === 0 ? (data.buyerName ?? "") : ""),
      ]),
    ),
  );

  const save = api.tickets.setAttendeeNames.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.emailedTo
          ? `Sent to ${result.emailedTo}. See you there.`
          : "Saved. See you there.",
      );
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  const allNamed = tickets.every((ticket) => Boolean(ticket.attendeeName));

  return (
    <section className={ticketPanelClass}>
      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            accessToken: token,
            names: wantsNames
              ? tickets.map((ticket) => ({
                  ticketId: ticket.id,
                  attendeeName: names[ticket.id]?.trim() ?? "",
                }))
              : [],
            ...(needsEmail && email.trim() ? { buyerEmail: email.trim() } : {}),
          });
        }}
      >
        {needsEmail && (
          <div>
            <h2 className="t-display text-xl normal-case">
              Where should we send these?
            </h2>
            <p className="mt-2 text-[14px] text-white/60">
              We haven&apos;t got an email for this order. Add one and the
              tickets are on their way. Right now they only exist on this page.
            </p>

            <div className="mt-5 space-y-2">
              <label htmlFor="buyer-email" className={fieldLabelClass}>
                Email
              </label>
              <input
                className={inputClass}
                id="buyer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          </div>
        )}

        {wantsNames && (
          <div className={needsEmail ? "border-t border-white/10 pt-8" : ""}>
            <h2 className="t-display text-xl normal-case">
              {allNamed ? "Who's coming" : "Who's coming?"}
            </h2>
            <p className="mt-2 text-[14px] text-white/60">
              {allNamed
                ? "Change a name any time before the doors open."
                : "Optional, but it gets your group through the door faster."}
            </p>

            <div className="mt-5 space-y-4">
              {tickets.map((ticket, index) => (
                <div key={ticket.id} className="space-y-2">
                  <label
                    htmlFor={`name-${ticket.id}`}
                    className={fieldLabelClass}
                  >
                    Ticket {index + 1}
                    <LevelChip accessLevel={ticket.accessLevel} />
                    <span className="ml-2 text-white/40">
                      {ticket.tierName}
                    </span>
                  </label>
                  <input
                    className={cn(inputClass, "disabled:opacity-50")}
                    id={`name-${ticket.id}`}
                    value={names[ticket.id] ?? ""}
                    // Already somebody's: sent on in their name, or scanned in.
                    disabled={ticket.nameLocked}
                    onChange={(e) =>
                      setNames((current) => ({
                        ...current,
                        [ticket.id]: e.target.value,
                      }))
                    }
                    placeholder="Full name"
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
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={save.isPending}
          className="w-full"
        >
          {save.isPending
            ? "Saving…"
            : needsEmail
              ? "Send my tickets"
              : "Save names"}
        </Button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={save.isPending}
            className="mx-auto block text-[14px] text-white/55 underline underline-offset-4 transition-colors hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </form>
    </section>
  );
}

type TicketOrderView = NonNullable<RouterOutputs["tickets"]["byAccessToken"]>;

function Receipt({ data }: { data: TicketOrderView }) {
  return (
    <section className={cn(ticketPanelClass, "mt-8")}>
      <h2 className="t-label text-[10px] text-white/60">
        Receipt · Order {data.orderNumber}
      </h2>

      <dl className="mt-4 space-y-1.5 text-[14px]">
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
        <div className="flex items-baseline justify-between border-t border-white/10 pt-3 text-white">
          <dt className="t-label text-[12px]">Total paid</dt>
          <dd className="t-display text-xl tabular-nums">
            {formatNZD(data.totals.totalCents)}
          </dd>
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
        <p className="mt-4 text-[12px] text-white/45">
          {data.legalName} · GST {data.gstNumber}
        </p>
      )}
    </section>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/60">{label}</dt>
      <dd className="text-white/75 tabular-nums">{value}</dd>
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
        className="inline-flex items-center gap-2 text-[14px] text-white/55 underline underline-offset-4 transition-colors hover:text-white disabled:opacity-50"
      >
        <Mail className="size-3.5" aria-hidden />
        {resend.isPending ? "Sending…" : `Email these tickets to ${email}`}
      </button>
    </div>
  );
}
