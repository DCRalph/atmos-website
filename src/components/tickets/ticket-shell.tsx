import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { AtmosLogo, Media } from "~/components/site/ui";
import { accessLevel, isElevated } from "~/lib/ticketing/access-levels";
import { cn } from "~/lib/utils";

/**
 * Shared chrome for the ticket pages (`/tickets/[token]`, its details step,
 * `/t/[token]`, `/lifetime/[token]`, receipts): a narrow column with the
 * logo, the event poster blurred out behind everything, and wallet-style
 * passes. Not a client module, so the server pages can use it too.
 */

/**
 * The outline pill from `buttonVariants`, as a plain string. This module also
 * renders in server pages (receipts, rental decisions), which can't call into
 * the client-only `ui` module.
 */
export const outlinePillClass =
  "t-label inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/40 px-6 text-[12px] text-white transition-colors hover:border-white hover:bg-white/5";

/** Label over a pill input on these pages. */
export const fieldLabelClass = "t-label block pl-5 text-[10px] text-white/70";

/** Glass panel for forms and receipts sitting over the blurred poster. */
export const ticketPanelClass =
  "glass-dark rounded-[var(--site-r-panel)] rounded-tl-none bg-black/60 p-5";

/** Page frame. The blur is static: no motion behind a QR code. */
export function TicketShell({
  poster,
  children,
}: {
  poster?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate min-h-dvh">
      {poster ? (
        <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
          <Media
            src={poster}
            alt=""
            sizes="100vw"
            className="absolute inset-0 scale-125 blur-3xl"
          />
          <div className="absolute inset-0 bg-black/55" />
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-md px-5 pt-6 pb-16">
        <Link href="/" aria-label="Atmos home" className="mb-8 inline-block">
          <AtmosLogo className="w-24" />
        </Link>
        {children}
      </main>
    </div>
  );
}

/** A whole-page state in place of a ticket: not found, still issuing. */
export function TicketMessage({
  title,
  children,
  showEventsLink,
}: {
  title: string;
  children: ReactNode;
  showEventsLink?: boolean;
}) {
  return (
    <>
      <h1 className="t-heading mt-10 text-[clamp(2rem,9vw,3rem)]">{title}</h1>
      <p className="mt-4 text-[15px] text-white/65">{children}</p>
      {showEventsLink ? (
        <Link href="/events" className={cn(outlinePillClass, "mt-8")}>
          What&apos;s on
        </Link>
      ) : null}
    </>
  );
}

/** The pass itself: a glass card, square at the top left like every panel. */
export function PassCard({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <article
      style={style}
      className={cn(
        "glass-dark glass-float overflow-hidden rounded-[var(--site-r-panel)] rounded-tl-none bg-black/60",
        className,
      )}
    >
      {children}
    </article>
  );
}

/** Top of a pass: a strip of the poster under a kicker and the event name. */
export function PassHeader({
  poster,
  kicker,
  title,
  as: Heading = "h2",
}: {
  poster?: string | null;
  kicker: ReactNode;
  title: string;
  as?: "h1" | "h2";
}) {
  return (
    <header className={cn("relative flex items-end", poster ? "h-44" : "pt-6")}>
      {poster ? (
        <>
          <Media
            src={poster}
            alt=""
            sizes="448px"
            className="absolute inset-0"
          />
          <div className="scrim-bottom absolute inset-0" />
        </>
      ) : null}
      <div className="relative px-5 pb-4">
        <p className="t-label text-[10px] text-white/75">{kicker}</p>
        <Heading className="t-display mt-2 text-[1.75rem] [overflow-wrap:anywhere] normal-case">
          {title}
        </Heading>
      </div>
    </header>
  );
}

/** Two-up facts under the pass header. */
export function PassFields({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-white/10 px-5 py-4">
      {children}
    </dl>
  );
}

export function PassField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="t-label text-[9px] text-white/55">{label}</dt>
      <dd className="mt-1.5 text-[14px] break-words text-white">{children}</dd>
    </div>
  );
}

/** QR on white, the ticket number, and whatever sits under them. */
export function PassCode({
  qrSvg,
  number,
  children,
}: {
  qrSvg: string | null;
  number: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-5 pt-5 pb-5 text-center">
      {qrSvg ? (
        <div
          className="mx-auto w-full max-w-60 bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
          // The SVG comes from our own QR renderer, not user input.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      ) : (
        <div className="t-label mx-auto flex aspect-square w-full max-w-60 items-center justify-center border border-white/15 text-[11px] text-white/50">
          Revoked
        </div>
      )}
      <p className="mt-3 font-mono text-[13px] text-white/55">{number}</p>
      {children}
    </div>
  );
}

/**
 * The access level, next to the tier name. Only above general admission
 * unless `always`: on a GA ticket the tier already says everything. Without
 * it an AAA on a tier called "General Admission" reads as general admission.
 */
export function LevelChip({
  accessLevel: code,
  always,
}: {
  accessLevel: string;
  always?: boolean;
}) {
  if (!always && !isElevated(code)) return null;
  const level = accessLevel(code);
  return (
    <span
      className="t-label ml-2 inline-block rounded-[var(--site-r-chip)] px-1.5 py-1 align-middle text-[9px]"
      style={{ backgroundColor: level.badgeBg, color: level.badgeFg }}
    >
      {level.short}
    </span>
  );
}

/** Red notice for a cancelled event or a revoked pass. */
export function DangerNotice({ children }: { children: ReactNode }) {
  return (
    <p className="mb-6 rounded-[var(--site-r-chip)] border border-[var(--site-danger)]/50 bg-[var(--site-danger)]/10 px-4 py-3 text-[14px] text-[var(--site-danger-text)]">
      {children}
    </p>
  );
}
