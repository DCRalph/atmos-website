"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

import { WalletButtons } from "~/components/tickets/wallet-buttons";
import { LevelChip } from "~/components/tickets/level-chip";
import {
  DangerNotice,
  PassCard,
  PassCode,
  PassField,
  PassFields,
  PassHeader,
  TicketMessage,
  TicketShell,
} from "~/components/tickets/ticket-shell";
import { buttonVariants, Skeleton } from "~/components/site/ui";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

/** The lifetime pass's own colour, as on the wallet pass. */
const GOLD = "#C9A227";

/**
 * A lifetime pass holder's own page.
 *
 * The counterpart to `/t/[token]` for a pass rather than a ticket: one QR, in
 * one person's name, good at every event. No date and no venue, because there
 * is no single night this is for — the link out is to what's on.
 */
export default function LifetimePassPage() {
  const params = useParams<{ token: string }>();
  const pass = api.lifetimeTickets.byToken.useQuery({ token: params.token });

  if (pass.isPending) {
    return (
      <TicketShell>
        <Skeleton className="h-[520px] rounded-[var(--site-r-panel)] rounded-tl-none" />
      </TicketShell>
    );
  }

  if (!pass.data) {
    return (
      <TicketShell>
        <TicketMessage title="Pass not found" showEventsLink>
          This link is wrong, or it&apos;s been replaced by a newer one. Check
          the most recent email you were sent.
        </TicketMessage>
      </TicketShell>
    );
  }

  const data = pass.data;

  return (
    <TicketShell>
      {!data.active && (
        <DangerNotice>
          This pass has been revoked and no longer gets you in.
        </DangerNotice>
      )}

      <PassCard className="border-t-2" style={{ borderTopColor: GOLD }}>
        <PassHeader
          as="h1"
          kicker={<span style={{ color: GOLD }}>Lifetime pass</span>}
          title={data.holderName}
        />
        <p className="px-5 pb-4 text-[14px] text-white/65">
          Gets you into every Atmos event. Show the code at the door, or add it
          to your wallet so it&apos;s always there.
        </p>
        <PassFields>
          <PassField label="Access">
            <LevelChip accessLevel={data.accessLevel} always />
          </PassField>
        </PassFields>
        <PassCode qrSvg={data.qrSvg} number={data.number}>
          <p className="mt-3 text-[13px] text-white/60">
            This pass is in your name. Bring photo ID; it can&apos;t be
            transferred.
          </p>
          <WalletButtons apple={data.appleWalletUrl} />
        </PassCode>
      </PassCard>

      <Link
        href="/events"
        className={cn(buttonVariants({ variant: "outline" }), "mt-8 w-full")}
      >
        What&apos;s on
      </Link>
    </TicketShell>
  );
}
