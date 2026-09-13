"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

import { AddToAppleWalletButton } from "~/components/tickets/wallet-buttons";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { accessLevel as accessLevelMeta } from "~/lib/ticketing/access-levels";

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
      <main className="mx-auto w-full max-w-2xl px-5 py-16 md:px-8">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-80 w-full" />
      </main>
    );
  }

  if (!pass.data) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-24 text-center md:px-8">
        <h1 className="text-3xl font-bold text-white">Pass not found</h1>
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

  const data = pass.data;
  const level = accessLevelMeta(data.accessLevel);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 md:px-8 md:py-16">
      <header>
        <p className="mb-3 text-xs tracking-[0.18em] text-[#C9A227] uppercase">
          Lifetime pass
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          {data.holderName}
        </h1>
        <p className="mt-3 text-white/60">
          Gets you into every Atmos event. Show the code at the door, or add it
          to your wallet so it&apos;s always there.
        </p>

        {!data.active && (
          <p className="mt-4 border-2 border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            This pass has been revoked and no longer gets you in.
          </p>
        )}
      </header>

      <section className="mt-10">
        <article className="border-2 border-[#4a3b12] bg-black/80 p-5 text-center backdrop-blur-sm">
          <p className="text-xs tracking-[0.14em] text-[#C9A227] uppercase">
            Lifetime pass
          </p>

          {data.qrSvg ? (
            <div
              className="mx-auto mt-4 w-full max-w-70 bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
              // The SVG comes from our own QR renderer, not user input.
              dangerouslySetInnerHTML={{ __html: data.qrSvg }}
            />
          ) : (
            <div className="mx-auto mt-4 flex aspect-square w-full max-w-70 items-center justify-center border-2 border-white/10 text-sm text-white/40">
              Revoked
            </div>
          )}

          <p
            className="mt-4 inline-block px-3 py-1 text-xs font-bold tracking-[0.08em]"
            style={{ backgroundColor: level.badgeBg, color: level.badgeFg }}
          >
            {level.short}
          </p>

          <p className="mt-3 text-lg font-semibold text-white">
            {data.holderName}
          </p>
          <p className="mt-1 font-mono text-sm text-white/40">{data.number}</p>

          <p className="mt-4 text-sm text-white/50">
            This pass is in your name — bring photo ID. It can&apos;t be
            transferred.
          </p>

          {data.appleWalletUrl && (
            <div className="mt-5 flex justify-center">
              <AddToAppleWalletButton href={data.appleWalletUrl} />
            </div>
          )}
        </article>
      </section>

      <p className="mt-10 text-center">
        <Link
          href="/events"
          className="inline-block border-2 border-white/20 px-5 py-2.5 text-white transition-colors hover:bg-white hover:text-black"
        >
          What&apos;s on
        </Link>
      </p>
    </main>
  );
}
