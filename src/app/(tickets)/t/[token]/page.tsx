"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Check, Copy, Send, Undo2 } from "lucide-react";
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
import { api, type RouterOutputs } from "~/trpc/react";
import { Button, Skeleton, inputClass } from "~/components/site/ui";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";

type TicketView = NonNullable<RouterOutputs["tickets"]["byTicketToken"]>;
type Handout = TicketView["handouts"][number];

/**
 * One person's ticket.
 *
 * The comp counterpart to `/tickets/[token]`, and the difference is the whole
 * point: that page shows everything somebody bought, this one shows exactly one
 * QR code. A comp recipient cannot swap their ticket for a lesser one and hand
 * the good one on, because there is no second code here to hand on — and their
 * name is on the ticket anyway, which the door reads back on every scan.
 *
 * When the ticket has hand-outs attached, they appear below as things to send
 * rather than as codes to screenshot. The guest gets their own ticket, at their
 * own link, in their own name.
 */
export default function TicketPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const ticket = api.tickets.byTicketToken.useQuery({ ticketToken: token });

  if (ticket.isPending) {
    return (
      <TicketShell>
        <Skeleton className="h-[560px] rounded-[var(--site-r-panel)] rounded-tl-none" />
      </TicketShell>
    );
  }

  if (!ticket.data) {
    return (
      <TicketShell>
        <TicketMessage title="Ticket not found" showEventsLink>
          This link is wrong, or it&apos;s been replaced by a newer one. Check
          the most recent email you were sent.
        </TicketMessage>
      </TicketShell>
    );
  }

  const data = ticket.data;
  const { event } = data;
  const poster = event.posterFileUploadId
    ? buildMediaUrl(event.posterFileUploadId)
    : null;

  return (
    <TicketShell poster={poster}>
      {data.invitedByName && (
        <p className="t-label mb-6 text-[11px] text-[var(--site-accent-text)]">
          {data.invitedByName} put you on the list
        </p>
      )}

      {event.status === "CANCELLED" && (
        <DangerNotice>
          This event has been cancelled. This ticket is no longer valid.
        </DangerNotice>
      )}

      <PassCard>
        <PassHeader
          as="h1"
          poster={poster}
          kicker={`${formatEventDate(event.startsAt, event.timezone)} · ${formatEventTime(event.startsAt, event.timezone)}`}
          title={event.name}
        />
        <PassFields>
          <PassField label="Name">
            {data.attendeeName ?? (
              <span className="text-white/45">Not named yet</span>
            )}
          </PassField>
          <PassField label="Ticket">
            {data.typeName}
            <LevelChip accessLevel={data.accessLevel} always />
          </PassField>
          <PassField label={event.doorsAt ? "Doors" : "Starts"}>
            {formatEventTime(event.doorsAt ?? event.startsAt, event.timezone)}
          </PassField>
          {event.venueName ? (
            <PassField label="Venue">{event.venueName}</PassField>
          ) : null}
        </PassFields>
        <PassCode qrSvg={data.qrSvg} number={data.ticketNumber}>
          {event.isR18 && (
            <p className="t-label mt-3 text-[10px] text-white/60">
              R18 · Bring photo ID
            </p>
          )}
          {/* Said plainly, because it is the reason the ticket is safe to send
              by email at all. */}
          {data.nameLocked && data.attendeeName && (
            <p className="mt-3 text-[13px] text-white/60">
              This ticket is in your name. Bring photo ID; it can&apos;t be
              transferred.
            </p>
          )}
          <WalletButtons
            apple={data.appleWalletUrl}
            google={data.googleWalletUrl}
          />
        </PassCode>
      </PassCard>

      {data.handouts.length > 0 && (
        <HandoutSection
          token={token}
          handouts={data.handouts}
          onChanged={() => void ticket.refetch()}
        />
      )}
    </TicketShell>
  );
}

function HandoutSection({
  token,
  handouts,
  onChanged,
}: {
  token: string;
  handouts: Handout[];
  onChanged: () => void;
}) {
  const unsent = handouts.filter((handout) => !handout.sentAt);

  return (
    <section className="mt-12">
      <h2 className="t-display text-2xl normal-case">
        {handouts.length === 1
          ? "You have a ticket to hand out"
          : `You have ${handouts.length} tickets to hand out`}
      </h2>
      <p className="mt-2 text-[14px] text-white/60">
        {unsent.length > 0
          ? "Send each one to whoever's coming with you. They get their own ticket, in their name. You don't have to pass anything on yourself."
          : "All sent. Everyone's got their own ticket."}
      </p>

      <ul className="mt-6 space-y-4">
        {handouts.map((handout) => (
          <li key={handout.id}>
            <HandoutCard
              token={token}
              handout={handout}
              onChanged={onChanged}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HandoutCard({
  token,
  handout,
  onChanged,
}: {
  token: string;
  handout: Handout;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const send = api.tickets.sendHandout.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.emailedTo
          ? `Sent to ${result.emailedTo}.`
          : "Sorted. Copy the link and send it over.",
      );
      if (!result.emailedTo) setLink(result.ticketUrl);
      setName("");
      setEmail("");
      onChanged();
    },
    onError: (error) => toast.error(error.message),
  });

  const reveal = api.tickets.handoutLink.useMutation({
    onSuccess: (result) => setLink(result.ticketUrl),
    onError: (error) => toast.error(error.message),
  });

  const resend = api.tickets.resendHandout.useMutation({
    onSuccess: (result) => toast.success(`Sent again to ${result.sentTo}.`),
    onError: (error) => toast.error(error.message),
  });

  const takeBack = api.tickets.reassignHandout.useMutation({
    onSuccess: () => {
      toast.success("Taken back. The old link no longer works.");
      setLink(null);
      onChanged();
    },
    onError: (error) => toast.error(error.message),
  });

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const arrived = handout.admittedAt !== null;

  return (
    <div className={ticketPanelClass}>
      <p className="flex flex-wrap items-center text-[13px] text-white/60">
        {handout.typeName}
        <LevelChip accessLevel={handout.accessLevel} always />
      </p>

      {handout.sentAt ? (
        <div className="mt-4">
          <p className="t-display text-lg normal-case">{handout.guestName}</p>
          <p className="mt-1.5 text-[13px] text-white/55">
            {arrived
              ? `Arrived ${new Date(handout.admittedAt!).toLocaleTimeString(
                  "en-NZ",
                  { hour: "numeric", minute: "2-digit" },
                )}`
              : handout.guestEmail
                ? `Sent to ${handout.guestEmail}`
                : "Sent"}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {handout.guestEmail && !arrived && (
              <Button
                variant="outline"
                size="sm"
                disabled={resend.isPending}
                onClick={() =>
                  resend.mutate({
                    ticketToken: token,
                    handoutTicketId: handout.id,
                  })
                }
              >
                <Send className="size-3.5" />
                {resend.isPending ? "Sending…" : "Resend"}
              </Button>
            )}

            {/* Gone once they're inside. Somebody has walked in on this ticket,
                and putting a different name on it now would rewrite who. */}
            {!arrived && (
              <Button
                variant="outline"
                size="sm"
                disabled={takeBack.isPending}
                onClick={() =>
                  takeBack.mutate({
                    ticketToken: token,
                    handoutTicketId: handout.id,
                  })
                }
              >
                <Undo2 className="size-3.5" />
                Give to someone else
              </Button>
            )}
          </div>
        </div>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate({
              ticketToken: token,
              handoutTicketId: handout.id,
              guestName: name.trim(),
              guestEmail: email.trim() || undefined,
            });
          }}
        >
          <div className="space-y-2">
            <label htmlFor={`name-${handout.id}`} className={fieldLabelClass}>
              Who&apos;s it for
            </label>
            <input
              className={inputClass}
              id={`name-${handout.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their full name"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`email-${handout.id}`} className={fieldLabelClass}>
              Email (optional)
            </label>
            <input
              className={inputClass}
              id={`email-${handout.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@example.com"
              autoComplete="off"
            />
            <p className="pl-5 text-[12px] text-white/50">
              With an email we send it straight to them. Without one you&apos;ll
              get a link to pass on.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={send.isPending || !name.trim()}>
              <Send className="size-4" />
              {send.isPending ? "Sending…" : "Send it"}
            </Button>
            <Button
              variant="outline"
              disabled={reveal.isPending}
              onClick={() =>
                reveal.mutate({
                  ticketToken: token,
                  handoutTicketId: handout.id,
                })
              }
            >
              <Copy className="size-4" /> Just give me a link
            </Button>
          </div>
        </form>
      )}

      {link && (
        <div className="mt-4 flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] p-1 pl-4">
          <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-white/70">
            {link}
          </code>
          <Button size="sm" variant="outline" onClick={() => copy(link)}>
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  );
}
