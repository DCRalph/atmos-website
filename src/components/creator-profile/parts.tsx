"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight, ArrowUpRight, Globe, Loader2 } from "lucide-react";
import type { IconType } from "react-icons";
import {
  FaFacebook,
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { gigPath } from "~/lib/gig-url";
import { resolveSocialPlatform } from "~/lib/social-pills";
import { useCountdown, inputClass } from "~/components/site/ui";
import { SiteDialog } from "~/components/site/overlays";
import {
  OnNowPanel,
  nightPhase,
  useIsOnNow,
  useMinuteClock,
} from "~/components/site/on-now";
import {
  fmtDay,
  fmtShortMonth,
  fmtTime,
  fmtYear,
  gigTitle,
  isTba,
  ticketCta,
  type PublicTicketEvent,
} from "~/components/site/gigs/gig-parts";
import type { ProfileSet, PublicProfile, PublicSocial } from "./types";

// ---------------------------------------------------------------------------
// Buttons

/**
 * Pill button in theme colours. `accent` is the one buy moment per view,
 * `solid` the primary non-buy action, `glass` only over imagery.
 */
export const pill = cva(
  "t-label inline-flex shrink-0 items-center justify-center gap-2 rounded-full whitespace-nowrap transition-[background-color,color,border-color,filter,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        accent:
          "bg-[var(--cp-accent)] text-[var(--cp-accent-ink)] hover:brightness-110",
        solid: "bg-[var(--cp-ink)] text-[var(--cp-ground)] hover:opacity-85",
        outline:
          "border border-[var(--cp-faint)] text-[var(--cp-ink)] hover:border-[var(--cp-ink)]",
        glass:
          "cp-glass text-[var(--cp-ink)] hover:bg-[color-mix(in_oklab,var(--cp-ink)_14%,transparent)]",
      },
      size: {
        sm: "h-9 px-4 text-[10px]",
        md: "h-11 px-6 text-[12px]",
        lg: "h-14 px-8 text-[13px]",
      },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

type PillProps = VariantProps<typeof pill>;

/** A pill that navigates. External links open in a new tab. */
export function Pill({
  href,
  className,
  variant,
  size,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & PillProps & { href: string }) {
  const external = /^https?:\/\//.test(href);
  return (
    <Link
      href={href}
      className={cn(pill({ variant, size }), className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  );
}

/**
 * Ticket state for each set, following the site's gigs page: an on-site
 * ticket event wins, the gig's own ticket link is the fallback.
 */
export function useTicketCta() {
  const events = api.ticketEvents.upcoming.useQuery(undefined, {
    staleTime: 60_000,
  });
  const byGig = useMemo(() => {
    const map = new Map<string, PublicTicketEvent>();
    for (const e of events.data ?? []) if (e.gig) map.set(e.gig.id, e);
    return map;
  }, [events.data]);
  return useCallback(
    (set: ProfileSet) => ticketCta(set.gig, byGig.get(set.gig.id)),
    [byGig],
  );
}

/** The ticket call to action for a set. States that can't be bought aren't pressable. */
export function TicketPill({
  set,
  size = "sm",
  className,
}: {
  set: ProfileSet;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const cta = useTicketCta()(set);
  if (cta.tone === "muted")
    return (
      <span
        className={cn(
          pill({ variant: "outline", size }),
          "border-[var(--cp-line)] text-[var(--cp-faint)]",
          className,
        )}
      >
        {cta.label}
      </span>
    );
  return (
    <Pill
      href={cta.href ?? gigPath(set.gig)}
      variant={cta.tone === "none" ? "outline" : "accent"}
      size={size}
      className={className}
    >
      {cta.label}
    </Pill>
  );
}

/** Round icon control. Glass over imagery, hairline on the ground. */
export function RoundButton({
  label,
  glass,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { label: string; glass?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--cp-ink)] transition-colors disabled:opacity-35",
        glass
          ? "cp-glass hover:bg-[color-mix(in_oklab,var(--cp-ink)_14%,transparent)]"
          : "border border-[var(--cp-line)] hover:border-[var(--cp-ink)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Socials and links

const platformIcons: Record<string, IconType> = {
  instagram: FaInstagram,
  facebook: FaFacebook,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  spotify: FaSpotify,
  soundcloud: FaSoundcloud,
};

/** Display name and icon for a social, known platform or custom. */
export function socialMeta(social: PublicSocial) {
  const platform = resolveSocialPlatform(social.platform, social.url);
  return {
    name: social.label ?? platform?.name ?? (social.platform || "Link"),
    handle: platform?.extractHandle(social.url) ?? null,
    Icon: (platform && platformIcons[platform.id]) ?? Globe,
  };
}

/** Round icon links to the creator's socials. */
export function SocialLinks({
  profile,
  glass,
  className,
}: {
  profile: Pick<PublicProfile, "name" | "socials">;
  glass?: boolean;
  className?: string;
}) {
  if (!profile.socials.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {profile.socials.map((social, i) => {
        const { name, Icon } = socialMeta(social);
        return (
          <li key={`${social.url}-${i}`}>
            <a
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${profile.name} on ${name}`}
              title={name}
              className={cn(
                "flex size-11 items-center justify-center rounded-full text-[var(--cp-ink)] transition-colors",
                glass
                  ? "cp-glass hover:bg-[color-mix(in_oklab,var(--cp-ink)_14%,transparent)]"
                  : "border border-[var(--cp-line)] hover:border-[var(--cp-ink)]",
              )}
            >
              <Icon className="size-[18px]" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Big rows where the whole row is the link: bookings, press kits, socials. */
export function LinkRows({
  links,
  className,
}: {
  links: { label: string; detail?: string | null; url: string }[];
  className?: string;
}) {
  if (!links.length) return null;
  return (
    <ul className={cn("border-t border-[var(--cp-line)]", className)}>
      {links.map((l, i) => (
        <li key={`${l.url}-${i}`}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 border-b border-[var(--cp-line)] py-5"
          >
            <span className="min-w-0 flex-1">
              <span className="cp-display block text-[clamp(1.25rem,2.4vw,1.75rem)] [overflow-wrap:anywhere]">
                {l.label || l.url.replace(/^https?:\/\/(www\.)?/, "")}
              </span>
              {l.detail ? (
                <span className="mt-1.5 block truncate text-[14px] text-[var(--cp-muted)]">
                  {l.detail}
                </span>
              ) : null}
            </span>
            <ArrowUpRight className="size-5 shrink-0 text-[var(--cp-faint)] transition-colors group-hover:text-[var(--cp-accent-text)]" />
          </a>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Imagery

/** One of the creator's own photos. Carries the theme's photo treatment. */
export function Photo({
  src,
  alt,
  className,
  sizes = "100vw",
  priority,
  position,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  position?: string;
}) {
  return (
    <div className={cn("cp-photo", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={src.endsWith(".gif")}
        className="object-cover"
        style={position ? { objectPosition: position } : undefined}
      />
    </div>
  );
}

/**
 * A gig poster, shown as made (no theme treatment). `contain` fits odd-shaped
 * art inside the box over a blurred copy of itself; no poster falls back to
 * the title set in the creator's face.
 */
export function Poster({
  title,
  src,
  className,
  sizes = "240px",
  fit = "cover",
  priority,
}: {
  title: string;
  src: string | null;
  className?: string;
  sizes?: string;
  fit?: "cover" | "contain";
  priority?: boolean;
}) {
  if (!src)
    return (
      <div
        className={cn(
          "@container relative overflow-hidden bg-[var(--cp-raised)] shadow-[inset_0_0_0_1px_var(--cp-line)]",
          className,
        )}
      >
        <p className="cp-display absolute inset-x-[9cqw] bottom-[9cqw] text-[15cqw] leading-[0.95] [overflow-wrap:anywhere] text-[var(--cp-faint)]">
          {title}
        </p>
      </div>
    );
  const gif = src.endsWith(".gif");
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[var(--cp-raised)]",
        className,
      )}
    >
      {fit === "contain" ? (
        <Image
          src={src}
          alt=""
          aria-hidden
          fill
          sizes={sizes}
          unoptimized={gif}
          className="scale-125 object-cover blur-lg brightness-[0.45]"
        />
      ) : null}
      <Image
        src={src}
        alt={`${title} poster`}
        fill
        sizes={sizes}
        unoptimized={gif}
        priority={priority}
        className={fit === "contain" ? "object-contain" : "object-cover"}
      />
    </div>
  );
}

/** A set's poster, titled for alt text and the no-poster fallback. */
export function SetPoster(
  props: { set: ProfileSet } & Omit<
    ComponentProps<typeof Poster>,
    "title" | "src"
  >,
) {
  const { set, ...rest } = props;
  return <Poster title={setTitle(set)} src={set.poster} {...rest} />;
}

// ---------------------------------------------------------------------------
// Sets: dates, titles, roles

/** The set's display title: a TBA gig's real name is a secret. */
export const setTitle = (set: ProfileSet) => gigTitle(set.gig);
export const setIsTba = (set: ProfileSet) => isTba(set.gig);
export const setHref = (set: ProfileSet) => gigPath(set.gig);

/** `Fri 09 Oct · San Fran · 9:00pm`, or `Date TBA · Pōneke`. */
export function setMeta(set: ProfileSet, opts: { time?: boolean } = {}) {
  if (setIsTba(set)) return ["Date TBA", set.venue].filter(Boolean).join(" · ");
  return [fmtDay(set.start), set.venue, opts.time ? fmtTime(set.start) : null]
    .filter(Boolean)
    .join(" · ");
}

export const isHeadline = (set: ProfileSet) =>
  !!set.role && /headlin/i.test(set.role);

/** What they're billed as. Headline sets take the accent. */
export function Role({
  set,
  className,
}: {
  set: ProfileSet;
  className?: string;
}) {
  if (!set.role) return null;
  return (
    <span
      className={cn(
        "t-label text-[10px]",
        isHeadline(set)
          ? "text-[var(--cp-accent-text)]"
          : "text-[var(--cp-muted)]",
        className,
      )}
    >
      {set.role}
    </span>
  );
}

/** Month on the accent, year underneath: a page off a wall calendar. */
export function CalendarTile({
  date,
  className,
}: {
  date: Date;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex w-14 shrink-0 flex-col overflow-hidden rounded-[var(--cp-r-media)] text-center",
        className,
      )}
    >
      <span className="t-label bg-[var(--cp-accent)] py-1.5 text-[11px] text-[var(--cp-accent-ink)]">
        {fmtShortMonth(date)}
      </span>
      <span className="t-label bg-[var(--cp-raised)] py-1.5 text-[10px] text-[var(--cp-muted)] tabular-nums">
        {fmtYear(date)}
      </span>
    </span>
  );
}

/** The next set with a real date, if there is one. */
export const nextSet = (profile: PublicProfile) =>
  profile.upcoming.find((s) => !setIsTba(s)) ?? null;

// ---------------------------------------------------------------------------
// Time

/** Days / hrs / min / sec. Glass over imagery, raised on the ground. */
export function Countdown({
  target,
  compact,
  onGround,
}: {
  target: Date;
  compact?: boolean;
  onGround?: boolean;
}) {
  const t = useCountdown(target);
  const cells = [
    ["Days", t?.days],
    ["Hrs", t?.hours],
    ["Min", t?.minutes],
    ["Sec", t?.seconds],
  ] as const;
  return (
    <div
      role="timer"
      aria-label="Time until doors"
      className={cn("grid w-fit grid-cols-4", compact ? "gap-1.5" : "gap-2")}
    >
      {cells.map(([label, value], i) => (
        <div
          key={label}
          className={cn(
            "flex flex-col items-center justify-center rounded-[var(--cp-r-media)]",
            onGround
              ? "border border-[var(--cp-line)] bg-[var(--cp-raised)]"
              : "cp-glass",
            compact ? "h-16 w-14" : "h-24 w-20 md:w-24",
          )}
        >
          <span
            className={cn(
              "cp-display tabular-nums",
              compact ? "text-2xl" : "text-4xl",
              i === 0 && "text-[var(--cp-accent-text)]",
            )}
          >
            {value === undefined ? "--" : String(value).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "t-label text-[var(--cp-muted)]",
              compact ? "mt-1 text-[8px]" : "mt-2 text-[10px]",
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

const nightOfSet = (set: ProfileSet) =>
  setIsTba(set) ? null : { start: set.start, end: set.end };

export const useSetOnNow = (set: ProfileSet | null) =>
  useIsOnNow(set ? nightOfSet(set) : null);

/** Countdown to doors, then the site's "On now" panel until close. */
export function SetTimer({
  set,
  compact,
  onGround,
}: {
  set: ProfileSet;
  compact?: boolean;
  onGround?: boolean;
}) {
  const now = useMinuteClock();
  const night = nightOfSet(set);
  if (!night) return null;
  const phase = now === null ? "before" : nightPhase(night, now);
  if (phase === "after") return null;
  if (phase === "on" && now !== null)
    return <OnNowPanel night={night} now={now} compact={compact} />;
  return (
    <Countdown target={night.start} compact={compact} onGround={onGround} />
  );
}

/** Small solid chip for rows and cards; same look as the site's. */
export function OnNowTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "t-label inline-flex h-7 w-fit items-center gap-1.5 rounded-full bg-[var(--cp-accent)] px-3 text-[10px] text-[var(--cp-accent-ink)]",
        className,
      )}
    >
      <span
        className="size-1.5 rounded-full bg-[var(--cp-accent-ink)]"
        aria-hidden
      />
      On now
    </span>
  );
}

// ---------------------------------------------------------------------------
// Layout pieces

/** Section heading in the creator's face, with optional controls on the right. */
export function SectionHeading({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-8 gap-y-5",
        className,
      )}
    >
      <div className="min-w-0">
        {title ? (
          <h2 className="cp-display text-[clamp(2.25rem,6vw,4.75rem)] [overflow-wrap:anywhere]">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
      {aside}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-full border border-[var(--cp-line)] p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn(
            "t-label h-9 rounded-full px-4 text-[10px] transition-colors",
            o.id === value
              ? "bg-[var(--cp-ink)] text-[var(--cp-ground)]"
              : "text-[var(--cp-muted)] hover:text-[var(--cp-ink)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** `All sets` style text link with an arrow. */
export function MoreLink({
  children,
  href,
  className,
}: {
  children: ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "t-label group inline-flex items-center gap-2 text-[11px] text-[var(--cp-muted)] hover:text-[var(--cp-ink)]",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

/**
 * What an unclaimed profile asks of its visitors. Signed-in visitors without
 * a profile can request to claim it; signed-out visitors are sent to log in.
 */
export type ClaimState = "request" | "login" | null;

export function ClaimBand({
  profile,
  claim,
  className,
}: {
  profile: Pick<PublicProfile, "id" | "name" | "handle" | "claimed">;
  claim: ClaimState;
  className?: string;
}) {
  if (profile.claimed || !claim) return null;
  return (
    <section
      className={cn(
        "flex flex-col gap-6 border-y border-[var(--cp-line)] px-5 py-10 md:flex-row md:items-center md:justify-between md:px-10",
        className,
      )}
    >
      <div>
        <h2 className="cp-display text-[clamp(1.75rem,4vw,3rem)]">
          Is this you?
        </h2>
        <p className="mt-3 max-w-[52ch] text-[15px] text-[var(--cp-muted)]">
          We made this page from Atmos lineups. Claim it to add your photo,
          music and links, and pick your own theme.
        </p>
      </div>
      {claim === "login" ? (
        <Pill href="/login" variant="solid" size="lg">
          Log in to claim
        </Pill>
      ) : (
        <ClaimDialog profile={profile} />
      )}
    </section>
  );
}

function ClaimDialog({
  profile,
}: {
  profile: Pick<PublicProfile, "id" | "name" | "handle">;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const request = api.creatorProfiles.requestClaim.useMutation();
  const sent = request.isSuccess;

  return (
    <SiteDialog
      open={open}
      onOpenChange={setOpen}
      title={`Claim @${profile.handle}`}
      titleAsWritten
      description={
        sent
          ? "Request sent. An admin will check it and get back to you."
          : "Tell us how we can check it's you. We'll be in touch if we need more."
      }
      trigger={
        <button
          type="button"
          className={pill({ variant: "solid", size: "lg" })}
        >
          Claim {profile.name}
        </button>
      }
    >
      {sent ? null : (
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate({
              profileId: profile.id,
              message: message.trim() || undefined,
            });
          }}
        >
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="I'm the DJ behind this name. You can check by..."
            className={cn(inputClass, "h-auto rounded-2xl py-3")}
          />
          {request.error ? (
            <p className="text-[14px] text-[var(--site-danger-text)]">
              {request.error.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={request.isPending}
            className={cn(pill({ variant: "accent", size: "md" }), "w-full")}
          >
            {request.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Send request
          </button>
        </form>
      )}
    </SiteDialog>
  );
}
