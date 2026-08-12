"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Copy,
  Loader2,
  MapPin,
  Send,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AddToAppleWalletButton,
  AddToGoogleWalletButton,
} from "~/components/tickets/wallet-buttons";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";
import { accessLevel as accessLevelMeta } from "~/lib/ticketing/access-levels";

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
      <main className="mx-auto w-full max-w-2xl px-5 py-16 md:px-8">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-80 w-full" />
      </main>
    );
  }

  if (!ticket.data) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center md:px-8">
        <h1 className="text-3xl font-bold text-white">Ticket not found</h1>
        <p className="mt-3 text-white/50">
          This link is wrong, or it&apos;s been replaced by a newer one. Check
          the most recent email you were sent.
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

  const data = ticket.data;
  const level = accessLevelMeta(data.accessLevel);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 md:px-8 md:py-16">
      <header>
        {data.invitedByName && (
          <p className="mb-3 text-sm text-white/50">
            {data.invitedByName} put you on the list
          </p>
        )}
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
            This event has been cancelled. This ticket is no longer valid.
          </p>
        )}
      </header>

      <section className="mt-10">
        <article className="border-2 border-white/10 bg-black/80 p-5 text-center backdrop-blur-sm">
          <p className="text-xs tracking-[0.14em] text-white/40 uppercase">
            {data.typeName}
          </p>

          <div
            className="mx-auto mt-4 w-full max-w-70 bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
            // The SVG comes from our own QR renderer, not user input.
            dangerouslySetInnerHTML={{ __html: data.qrSvg }}
          />

          <p
            className="mt-4 inline-block px-3 py-1 text-xs font-bold tracking-[0.08em]"
            style={{ backgroundColor: level.badgeBg, color: level.badgeFg }}
          >
            {level.short}
          </p>

          {data.attendeeName && (
            <p className="mt-3 text-lg font-semibold text-white">
              {data.attendeeName}
            </p>
          )}
          <p className="mt-1 font-mono text-sm text-white/40">
            {data.ticketNumber}
          </p>

          {/* Said plainly, because it is the reason the ticket is safe to send
              by email at all. */}
          {data.nameLocked && data.attendeeName && (
            <p className="mt-4 text-sm text-white/50">
              This ticket is in your name — bring photo ID. It can&apos;t be
              transferred.
            </p>
          )}

          {(data.appleWalletUrl ?? data.googleWalletUrl) && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {data.appleWalletUrl && (
                  <AddToAppleWalletButton href={data.appleWalletUrl} />
                )}
              {data.googleWalletUrl && (
                  <AddToGoogleWalletButton href={data.googleWalletUrl} />
                )}
            </div>
          )}
        </article>
      </section>

      {data.handouts.length > 0 && (
        <HandoutSection
          token={token}
          handouts={data.handouts}
          onChanged={() => void ticket.refetch()}
        />
      )}
    </main>
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
      <h2 className="text-xl font-bold text-white">
        {handouts.length === 1
          ? "You have a ticket to hand out"
          : `You have ${handouts.length} tickets to hand out`}
      </h2>
      <p className="mt-2 text-sm text-white/50">
        {unsent.length > 0
          ? "Send each one to whoever's coming with you. They get their own ticket, in their name — you don't have to pass anything on yourself."
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

  const level = accessLevelMeta(handout.accessLevel);

  const send = api.tickets.sendHandout.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.emailedTo
          ? `Sent to ${result.emailedTo}.`
          : "Sorted — copy the link and send it over.",
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
      toast.success("Taken back — the old link no longer works.");
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
    <div className="border-2 border-white/10 bg-black/60 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="px-2.5 py-1 text-xs font-bold tracking-[0.08em]"
          style={{ backgroundColor: level.badgeBg, color: level.badgeFg }}
        >
          {level.short}
        </span>
        <span className="text-sm text-white/50">{handout.typeName}</span>
      </div>

      {handout.sentAt ? (
        <div className="mt-4">
          <p className="text-lg font-semibold text-white">
            {handout.guestName}
          </p>
          <p className="mt-1 text-sm text-white/40">
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
                type="button"
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
                {resend.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Resend
              </Button>
            )}

            {/* Gone once they're inside. Somebody has walked in on this ticket,
                and putting a different name on it now would rewrite who. */}
            {!arrived && (
              <Button
                type="button"
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
                {takeBack.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Undo2 className="size-3.5" />
                )}
                Give to someone else
              </Button>
            )}
          </div>
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
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
          <div className="space-y-1.5">
            <Label htmlFor={`name-${handout.id}`}>Who&apos;s it for</Label>
            <Input
              id={`name-${handout.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their full name"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`email-${handout.id}`}>Email (optional)</Label>
            <Input
              id={`email-${handout.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@example.com"
              autoComplete="off"
            />
            <p className="text-xs text-white/40">
              With an email we send it straight to them. Without one you&apos;ll
              get a link to pass on.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={send.isPending || !name.trim()}>
              {send.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="size-4" /> Send it
                </>
              )}
            </Button>
            <Button
              type="button"
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
        <div className="mt-4 flex items-center gap-2 border border-white/15 bg-white/5 p-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-white/70">
            {link}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => copy(link)}
          >
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
