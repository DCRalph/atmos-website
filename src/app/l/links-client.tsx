"use client";

import "~/styles/site.css";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { ArrowRight, ArrowUpRight, Globe } from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { gigPath } from "~/lib/gig-url";
import { siteFontVariables } from "~/lib/site-fonts";
import { SOCIALS, type SocialKey } from "~/lib/site-constants";
import { api } from "~/trpc/react";
import { AtmosLogo, Skeleton, buttonVariants } from "~/components/site/ui";
import {
  CtaPill,
  GigPoster,
  fmtDay,
  fmtTime,
  ticketCta,
  type UpcomingGig,
} from "~/components/site/gigs/gig-parts";

/** Icon row, in display order. */
const socials: [SocialKey, ComponentType<SVGProps<SVGSVGElement>>][] = [
  ["instagram", FaInstagram],
  ["tiktok", FaTiktok],
  ["soundcloud", FaSoundcloud],
  ["spotify", FaSpotify],
  ["youtube", FaYoutube],
  ["facebook", FaFacebook],
];

const panel =
  "rounded-[var(--site-r-panel)] border border-white/12 bg-site-raised";

/** The link in bio: socials, the next gig, and the way into the site. */
export default function LinksPage() {
  const upcoming = api.gigs.getUpcoming.useQuery();
  const next = upcoming.data?.[0];

  return (
    <div className={cn("site min-h-dvh", siteFontVariables)}>
      <main className="site-fade-in mx-auto flex min-h-dvh max-w-xl flex-col gap-7 px-5 pt-10 pb-6 md:pt-16">
        <header className="flex flex-col items-center text-center">
          <div className="w-52 md:w-64">
            <AtmosLogo className="w-full" />
            <div className="bg-site-accent mt-3 h-[3px]" />
          </div>
          <p className="t-label mt-5 text-[11px] text-white/60">
            Connect with us everywhere
          </p>
        </header>

        <nav
          aria-label="Socials"
          className="flex flex-wrap justify-center gap-2"
        >
          {socials.map(([key, Icon]) => (
            <a
              key={key}
              href={SOCIALS[key].href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${SOCIALS[key].label} ${SOCIALS[key].handle}`}
              className="flex size-12 items-center justify-center rounded-[14px] border border-white/12 bg-white/5 text-white/80 transition-colors hover:border-white/40 hover:text-white"
            >
              <Icon className="size-5" aria-hidden />
            </a>
          ))}
        </nav>

        {upcoming.isPending ? (
          <Skeleton className="h-52 rounded-[var(--site-r-panel)]" />
        ) : next ? (
          <NextGig gig={next} />
        ) : null}

        <Link
          href="/"
          className={cn(
            panel,
            "group grid grid-cols-[48px_minmax(0,1fr)_40px] items-center gap-4 p-4 transition-colors hover:border-white/30",
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full border border-white/20">
            <Globe className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="t-display block text-xl">Website</span>
            <span className="t-label mt-1.5 block text-[10px] text-white/60">
              atmosmedia.co.nz
            </span>
          </span>
          <span className="group-hover:bg-site-accent group-hover:text-site-accent-ink flex size-10 items-center justify-center rounded-full bg-white text-black transition-colors">
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>

        <p className="t-label mt-auto pt-6 text-center text-[9px] text-white/40">
          © {new Date().getFullYear()} Atmos
        </p>
      </main>
    </div>
  );
}

/** "Next event": poster beside the details, then Details and the ticket call to action. */
function NextGig({ gig }: { gig: UpcomingGig }) {
  const event = api.ticketEvents.forGig.useQuery({ gigId: gig.id });
  const cta = ticketCta(gig, event.data ?? undefined);

  return (
    <section aria-labelledby="links-next">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/12" />
        <h2
          id="links-next"
          className="t-label text-site-accent-text text-[10px]"
        >
          Next event
        </h2>
        <span className="h-px flex-1 bg-white/12" />
      </div>

      <div className={cn(panel, "mt-4 p-4")}>
        <div className="flex gap-4">
          <GigPoster
            gig={gig}
            sizes="96px"
            tbaSize="text-lg"
            className="aspect-[4/5] w-24 shrink-0"
          />
          <div className="min-w-0">
            {gig.isTba ? (
              <p className="t-label text-[10px] text-white/60">
                Details coming soon
              </p>
            ) : (
              <>
                <p className="t-label text-site-accent-text text-[11px]">
                  {fmtDay(gig.gigStartTime)}
                </p>
                <p className="t-label mt-1.5 text-[10px] text-white/60">
                  {fmtTime(gig.gigStartTime)}
                  {gig.gigEndTime ? ` - ${fmtTime(gig.gigEndTime)}` : null}
                </p>
              </>
            )}
            <h3 className="t-display mt-3 line-clamp-3 text-[21px] break-words normal-case">
              {gig.isTba ? "TBA" : gig.title}
            </h3>
            {!gig.isTba && gig.subtitle ? (
              <p className="mt-1.5 line-clamp-2 text-[13px] text-white/60">
                {gig.subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {gig.isTba ? null : (
          <div className="mt-4 flex gap-2">
            <Link
              href={gigPath(gig)}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "px-5 last:flex-1",
              )}
            >
              Details
            </Link>
            {event.isPending ? (
              <Skeleton className="h-11 flex-1 rounded-full" />
            ) : cta.href ? (
              <a
                href={cta.href}
                target={cta.tone === "external" ? "_blank" : undefined}
                rel={
                  cta.tone === "external" ? "noopener noreferrer" : undefined
                }
                className={cn(
                  buttonVariants({ variant: "accent" }),
                  "min-w-0 flex-1 px-4",
                )}
              >
                {cta.tone === "external" ? "Tickets" : cta.label}
                {cta.tone === "external" ? (
                  <ArrowUpRight className="size-4" aria-hidden />
                ) : null}
              </a>
            ) : cta.tone === "muted" ? (
              <CtaPill cta={cta} size="md" className="flex-1 justify-center" />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
