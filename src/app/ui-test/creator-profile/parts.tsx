"use client";

import Image from "next/image";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ArrowRight,
  ArrowUpRight,
  Menu,
  Pause,
  Play,
  ShoppingBag,
} from "lucide-react";
import type { IconType } from "react-icons";
import {
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { GradientBlur } from "~/components/gradient-blur";
import { primaryNav } from "~/components/site/nav";
import { useCountdown } from "~/components/site/ui";
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
} from "~/components/site/gigs/gig-parts";
import type {
  MockProfile,
  ProfileSet,
  SocialPlatform,
  Ticket,
  Track,
} from "./fixtures";

// ---------------------------------------------------------------------------
// Buttons

/**
 * Pill button in theme colours. `accent` is the one buy moment per view,
 * `solid` the primary non-buy action, `glass` only over imagery.
 */
export const pill = cva(
  "t-label inline-flex shrink-0 items-center justify-center gap-2 rounded-full whitespace-nowrap transition-[background-color,color,border-color,filter,opacity] duration-150 ease-out",
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

export function Pill({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"a"> & VariantProps<typeof pill>) {
  return (
    <a href="#" className={cn(pill({ variant, size }), className)} {...props} />
  );
}

/** The ticket call to action for a set; muted states aren't pressable. */
export function TicketPill({
  ticket,
  size = "sm",
  className,
}: {
  ticket: Ticket;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (!ticket.label) return null;
  if (ticket.tone === "muted")
    return (
      <span
        className={cn(
          pill({ variant: "outline", size }),
          "border-[var(--cp-line)] text-[var(--cp-faint)]",
          className,
        )}
      >
        {ticket.label}
      </span>
    );
  return (
    <Pill
      variant={ticket.tone === "buy" ? "accent" : "outline"}
      size={size}
      className={className}
    >
      {ticket.label}
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

const socialIcons = {
  instagram: { name: "Instagram", Icon: FaInstagram },
  soundcloud: { name: "SoundCloud", Icon: FaSoundcloud },
  spotify: { name: "Spotify", Icon: FaSpotify },
  youtube: { name: "YouTube", Icon: FaYoutube },
  tiktok: { name: "TikTok", Icon: FaTiktok },
} satisfies Record<SocialPlatform, { name: string; Icon: IconType }>;

export function SocialLinks({
  profile,
  glass,
  className,
}: {
  profile: MockProfile;
  glass?: boolean;
  className?: string;
}) {
  if (!profile.socials.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {profile.socials.map(({ platform, url }) => {
        const { name, Icon } = socialIcons[platform];
        return (
          <li key={platform}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${profile.name} on ${name}`}
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

/** Bookings, press kit and the like: big rows, the whole row is the link. */
export function LinkRows({
  profile,
  className,
}: {
  profile: MockProfile;
  className?: string;
}) {
  if (!profile.links.length) return null;
  return (
    <ul className={cn("border-t border-[var(--cp-line)]", className)}>
      {profile.links.map((l) => (
        <li key={l.label}>
          <a
            href={l.url}
            className="group flex items-center gap-4 border-b border-[var(--cp-line)] py-5"
          >
            <span className="min-w-0 flex-1">
              <span className="cp-display block text-[clamp(1.25rem,2.4vw,1.75rem)]">
                {l.label}
              </span>
              <span className="mt-1.5 block text-[14px] text-[var(--cp-muted)]">
                {l.detail}
              </span>
            </span>
            <ArrowUpRight className="size-5 text-[var(--cp-faint)] transition-colors group-hover:text-[var(--cp-accent-text)]" />
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
  set,
  className,
  sizes = "240px",
  fit = "cover",
  priority,
}: {
  set: Pick<ProfileSet, "title" | "poster">;
  className?: string;
  sizes?: string;
  fit?: "cover" | "contain";
  priority?: boolean;
}) {
  if (!set.poster)
    return (
      <div
        className={cn(
          "@container relative overflow-hidden bg-[var(--cp-raised)] shadow-[inset_0_0_0_1px_var(--cp-line)]",
          className,
        )}
      >
        <p className="cp-display absolute inset-x-[9cqw] bottom-[9cqw] text-[15cqw] leading-[0.95] [overflow-wrap:anywhere] text-[var(--cp-faint)]">
          {set.title}
        </p>
      </div>
    );
  const gif = set.poster.endsWith(".gif");
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[var(--cp-raised)]",
        className,
      )}
    >
      {fit === "contain" ? (
        <Image
          src={set.poster}
          alt=""
          aria-hidden
          fill
          sizes={sizes}
          unoptimized={gif}
          className="scale-125 object-cover blur-lg brightness-[0.45]"
        />
      ) : null}
      <Image
        src={set.poster}
        alt={`${set.title} poster`}
        fill
        sizes={sizes}
        unoptimized={gif}
        priority={priority}
        className={fit === "contain" ? "object-contain" : "object-cover"}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dates and time

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

/** `Fri 09 Oct · San Fran · 9:00pm`, or `Date TBA · Pōneke`. */
export function setMeta(set: ProfileSet, opts: { time?: boolean } = {}) {
  if (!set.start) return `Date TBA · ${set.venue}`;
  return [fmtDay(set.start), set.venue, opts.time ? fmtTime(set.start) : null]
    .filter(Boolean)
    .join(" · ");
}

export const isHeadline = (set: ProfileSet) => set.role === "Headline";

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
  set.start ? { start: set.start, end: set.end } : null;

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
// Music

/** Waveform as bars; the played part takes the accent. */
export function Waveform({
  wave,
  progress = 0,
  className,
}: {
  wave: number[];
  progress?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("flex items-center gap-[2px]", className)}>
      {wave.map((h, i) => (
        <span
          key={i}
          className={cn(
            "min-w-[2px] flex-1 rounded-full",
            i / wave.length < progress
              ? "bg-[var(--cp-accent-text)]"
              : "bg-[var(--cp-line)]",
          )}
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Tracks with one player on top. In the real build the controls would drive
 * the SoundCloud widget API; here play only flips state.
 */
export function TrackPlayer({
  profile,
  layout = "split",
  className,
}: {
  profile: MockProfile;
  layout?: "split" | "stacked";
  className?: string;
}) {
  const [currentId, setCurrentId] = useState(profile.tracks[0]?.id);
  const [playing, setPlaying] = useState(false);
  const current = profile.tracks.find((t) => t.id === currentId);
  if (!current) return null;

  const pick = (t: Track) => {
    if (t.id === currentId) setPlaying((p) => !p);
    else {
      setCurrentId(t.id);
      setPlaying(true);
    }
  };

  return (
    <div
      className={cn(
        "grid gap-8",
        layout === "split" &&
          "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12",
        className,
      )}
    >
      <div className="flex flex-col gap-6 self-start sm:flex-row sm:items-end">
        <Poster
          set={{ title: current.title, poster: current.artwork }}
          className="aspect-square w-full max-w-[280px] rounded-[var(--cp-r-media)] sm:w-[220px] lg:w-[260px]"
          sizes="280px"
        />
        <div className="min-w-0 flex-1">
          <p className="cp-display text-[clamp(1.75rem,3.6vw,3rem)] [overflow-wrap:anywhere]">
            {current.title}
          </p>
          <p className="mt-2 text-[14px] text-[var(--cp-muted)]">
            {profile.name} · {current.length}
          </p>
          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={
                playing ? `Pause ${current.title}` : `Play ${current.title}`
              }
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--cp-accent)] text-[var(--cp-accent-ink)] transition-[filter] hover:brightness-110"
            >
              {playing ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="ml-0.5 size-5 fill-current" />
              )}
            </button>
            <Waveform
              wave={current.wave}
              progress={playing ? 0.34 : 0}
              className="h-12 flex-1"
            />
          </div>
        </div>
      </div>

      <ol className="border-t border-[var(--cp-line)]">
        {profile.tracks.map((t) => {
          const active = t.id === currentId;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => pick(t)}
                aria-pressed={active && playing}
                className="group grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--cp-line)] py-3 text-left"
              >
                <span className="relative">
                  <Poster
                    set={{ title: t.title, poster: t.artwork }}
                    className="aspect-square w-12 rounded-[var(--cp-r-media)]"
                    sizes="48px"
                  />
                  <span
                    className={cn(
                      "absolute inset-0 flex items-center justify-center rounded-[var(--cp-r-media)] bg-black/55 text-white transition-opacity",
                      active
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    {active && playing ? (
                      <Pause className="size-4 fill-current" />
                    ) : (
                      <Play className="ml-0.5 size-4 fill-current" />
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "truncate text-[15px]",
                    active
                      ? "text-[var(--cp-accent-text)]"
                      : "text-[var(--cp-ink)]",
                  )}
                >
                  {t.title}
                </span>
                <span className="text-[13px] text-[var(--cp-faint)] tabular-nums">
                  {t.length}
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <a
            href="#"
            className="t-label inline-flex items-center gap-2 py-4 text-[11px] text-[var(--cp-muted)] hover:text-[var(--cp-ink)]"
          >
            <FaSoundcloud className="size-4" /> More on SoundCloud
          </a>
        </li>
      </ol>
    </div>
  );
}

/** A YouTube video as its thumbnail; the real build lazy-loads the embed on press. */
export function VideoTile({
  video,
  className,
}: {
  video: NonNullable<MockProfile["video"]>;
  className?: string;
}) {
  return (
    <figure className={className}>
      <button
        type="button"
        aria-label={`Play ${video.title}`}
        className="group relative block aspect-video w-full overflow-hidden rounded-[var(--cp-r-media)]"
      >
        <Photo
          src={video.thumb}
          alt=""
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="absolute inset-0"
        />
        <span className="absolute inset-0 z-[2] flex items-center justify-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-[var(--cp-accent)] text-[var(--cp-accent-ink)] transition-transform duration-200 ease-out group-hover:scale-105">
            <Play className="ml-1 size-7 fill-current" />
          </span>
        </span>
        <span className="t-label absolute right-3 bottom-3 z-[2] rounded-full bg-black/70 px-2.5 py-1.5 text-[10px] text-white tabular-nums">
          {video.length}
        </span>
      </button>
      <figcaption className="mt-3 text-[15px] text-[var(--cp-muted)]">
        {video.title}
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Layout

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
      <div>
        <h2 className="cp-display text-[clamp(2.25rem,6vw,4.75rem)]">
          {title}
        </h2>
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

/** `View all` style text link with an arrow. */
export function MoreLink({
  children,
  href = "#",
  className,
}: {
  children: ReactNode;
  href?: string;
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

/** Unclaimed profiles: one honest band asking the artist to take it over. */
export function ClaimBand({
  profile,
  className,
}: {
  profile: MockProfile;
  className?: string;
}) {
  if (profile.claimed) return null;
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
      <Pill variant="solid" size="lg">
        Claim {profile.name}
      </Pill>
    </section>
  );
}

/**
 * The site header, recoloured for the theme's tone. Real pages would keep
 * the shared header and only swap logo and ink.
 */
export function ProfileHeader({ tone }: { tone: "dark" | "light" }) {
  return (
    <header className="fixed inset-x-0 top-0 isolate z-40 flex h-16 items-center gap-8 px-5 md:h-20 md:px-10">
      <GradientBlur
        direction="to-bottom"
        className="absolute inset-0 -bottom-14 -z-10 rotate-180"
      />
      <a href="#" aria-label="Atmos home">
        <Image
          src={
            tone === "light" ? "/logo/atmos-black.png" : "/logo/atmos-white.png"
          }
          alt="Atmos"
          width={5001}
          height={1120}
          className="h-auto w-24 object-contain md:w-28"
          priority
        />
      </a>
      <nav aria-label="Main" className="hidden lg:block">
        <ul className="flex gap-7">
          {primaryNav.map((l) => (
            <li key={l.href}>
              <a
                href="#"
                className={cn(
                  "t-label relative text-[11px] transition-colors",
                  l.label === "Crew"
                    ? "text-[var(--cp-ink)] after:absolute after:inset-x-0 after:-bottom-2 after:h-0.5 after:bg-[var(--cp-accent)]"
                    : "text-[var(--cp-muted)] hover:text-[var(--cp-ink)]",
                )}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Cart, 0 items"
          className="inline-flex size-11 items-center justify-center rounded-full text-[var(--cp-muted)] hover:text-[var(--cp-ink)]"
        >
          <ShoppingBag className="size-5" />
        </button>
        <RoundButton label="Open menu" glass className="ml-1 lg:hidden">
          <Menu className="size-5" />
        </RoundButton>
      </div>
    </header>
  );
}
