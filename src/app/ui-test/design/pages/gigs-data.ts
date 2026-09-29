import { gallery, lineup, pastGigs, upcomingGigs } from "../fixtures";

/**
 * Gig and ticketing shapes for the page drafts, mirroring the real models:
 * `Gig` (mode NORMAL / TO_BE_ANNOUNCED / AFFILIATED, status PUBLISHED / DRAFT)
 * and the linked `TicketEvent` with its tiers. Titles, venues, dates and
 * posters are real; prices, tiers, tags, fees and the extra upcoming gigs are
 * illustrative, built from real posters so every state has a realistic row.
 */

export type TierState = "available" | "low" | "sold-out" | "not-yet" | "closed";

export type Tier = {
  id: string;
  name: string;
  priceCents: number;
  description?: string;
  state: TierState;
  /** Shown as "Only N left" when state is "low". */
  remaining?: number;
  salesStartAt?: Date;
  maxPerOrder: number;
};

export type TicketEvent = {
  slug: string;
  status: "ON_SALE" | "SOLD_OUT" | "NOT_ON_SALE" | "CANCELLED";
  salesOpenAt?: Date;
  /** Free events where each request is approved by staff. */
  requiresApproval?: boolean;
  isR18: boolean;
  maxTicketsPerOrder: number;
  bookingFee: { fixedCents: number; percentBp: number };
  venueName: string;
  venueAddress?: string;
  doorsAt?: Date;
  tiers: Tier[];
};

export type Tickets =
  | { kind: "onsite"; event: TicketEvent }
  | { kind: "external"; url: string }
  | { kind: "none" };

export type Gig = {
  id: string;
  slug: string;
  title: string;
  /** Venue line, as the real `subtitle` is used. */
  subtitle: string;
  mode: "NORMAL" | "TO_BE_ANNOUNCED" | "AFFILIATED";
  status: "PUBLISHED" | "DRAFT";
  start: Date;
  end?: Date;
  poster: string;
  tags: string[];
  lineup: { name: string; image?: string }[];
  description?: string[];
  tickets: Tickets;
  media: { src: string; alt: string }[];
};

const FEE = { fixedCents: 250, percentBp: 0 };

const standardTiers = (
  overrides: Partial<Record<string, Partial<Tier>>> = {},
): Tier[] =>
  [
    {
      id: "early",
      name: "Early bird",
      priceCents: 2500,
      state: "sold-out" as const,
      maxPerOrder: 4,
    },
    {
      id: "general",
      name: "General",
      priceCents: 3500,
      state: "available" as const,
      maxPerOrder: 6,
      description: "Entry all night.",
    },
    {
      id: "final",
      name: "Final release",
      priceCents: 4500,
      state: "not-yet" as const,
      salesStartAt: new Date("2026-10-05T12:00:00+13:00"),
      maxPerOrder: 6,
    },
  ].map((t) => ({ ...t, ...overrides[t.id] }));

const intuition = upcomingGigs[0];
const tba = upcomingGigs[1];
const [holyGrail, daffodil, vitiman, fovos, kumi, shipWrek, caged] = pastGigs;

export const onSaleEvent: TicketEvent = {
  slug: "intuition-vol-3-san-fran",
  status: "ON_SALE",
  isR18: true,
  maxTicketsPerOrder: 8,
  bookingFee: FEE,
  venueName: "San Fran",
  venueAddress: "171 Cuba Street, Te Aro, Wellington",
  doorsAt: new Date("2026-10-09T21:00:00+13:00"),
  tiers: standardTiers(),
};

/** The flagship upcoming gig, in its default on-sale shape. */
export const flagship: Gig = {
  id: "g-intuition-3",
  slug: intuition.slug,
  title: intuition.title,
  subtitle: "San Fran, Pōneke",
  mode: "NORMAL",
  status: "PUBLISHED",
  start: intuition.date,
  end: new Date("2026-10-10T03:00:00+13:00"),
  poster: intuition.poster,
  tags: ["UKG", "Bass", "R18"],
  lineup: lineup.map(({ name, image }) => ({ name, image })),
  description: [
    "broderbeats brings the Intuition tour home to San Fran for the third volume, with a full Atmos production: sound, light and space built out for one night only.",
    "Support from Sunday, Special K and Taiji. Doors at 9pm, headline set from around 12:30am.",
  ],
  tickets: { kind: "onsite", event: onSaleEvent },
  media: [],
};

/** Every ticket situation a gig page can be in, keyed by board state id. */
export const ticketVariants = {
  "on-sale": onSaleEvent,
  "low-stock": {
    ...onSaleEvent,
    tiers: standardTiers({ general: { state: "low", remaining: 6 } }),
  },
  "not-on-sale": {
    ...onSaleEvent,
    status: "NOT_ON_SALE",
    salesOpenAt: new Date("2026-10-02T12:00:00+13:00"),
    tiers: standardTiers({
      early: { state: "not-yet" },
      general: { state: "not-yet" },
    }),
  },
  "sold-out": {
    ...onSaleEvent,
    status: "SOLD_OUT",
    tiers: standardTiers({
      general: { state: "sold-out" },
      final: { state: "sold-out" },
    }),
  },
  cancelled: { ...onSaleEvent, status: "CANCELLED" },
  "free-approval": {
    ...onSaleEvent,
    requiresApproval: true,
    bookingFee: { fixedCents: 0, percentBp: 0 },
    tiers: [
      {
        id: "free",
        name: "Guest list",
        priceCents: 0,
        state: "available",
        maxPerOrder: 2,
        description: "Free entry. Every request is checked by the crew.",
      },
    ],
  },
} satisfies Record<string, TicketEvent>;

const pastGig = (
  g: (typeof pastGigs)[number],
  id: string,
  extra: Partial<Gig> = {},
): Gig => ({
  id,
  slug: g.slug,
  title: g.title,
  subtitle: g.venue,
  mode: "NORMAL",
  status: "PUBLISHED",
  start: g.date,
  poster: g.poster,
  tags: [],
  lineup: [],
  tickets: { kind: "none" },
  media: [],
  ...extra,
});

export const upcomingList: Gig[] = [
  flagship,
  {
    ...pastGig(fovos, "g-fovos-2"),
    slug: "fovos-meow-october",
    title: "FOVOS",
    start: new Date("2026-10-24T22:00:00+13:00"),
    tags: ["House"],
    tickets: { kind: "onsite", event: ticketVariants["sold-out"] },
  },
  {
    ...pastGig(daffodil, "g-daffodil-2"),
    slug: "daffodil-dancefloor-spring",
    start: new Date("2026-11-07T16:00:00+13:00"),
    tags: ["Day party"],
    tickets: { kind: "onsite", event: ticketVariants["free-approval"] },
  },
  {
    ...pastGig(shipWrek, "g-shipwrek-2"),
    slug: "ship-wrek-summer",
    start: new Date("2026-11-28T21:00:00+13:00"),
    tickets: { kind: "external", url: "https://example.com/tickets" },
  },
  {
    id: "g-tba",
    slug: "tba",
    title: "TBA",
    subtitle: "Pōneke",
    mode: "TO_BE_ANNOUNCED",
    status: "PUBLISHED",
    // The real API redacts a TBA gig's date; the list sorts it last.
    start: new Date(0),
    poster: tba.poster,
    tags: [],
    lineup: [],
    tickets: { kind: "none" },
    media: [],
  },
];

/** Rows only an admin sees on the upcoming tab, each with its off-site notice. */
export const adminOnlyUpcoming: Gig[] = [
  {
    ...pastGig(caged, "g-caged-3"),
    slug: "caged-v3",
    title: "Caged V3",
    status: "DRAFT",
    start: new Date("2026-12-12T21:00:00+13:00"),
    tickets: { kind: "none" },
  },
  {
    ...pastGig(kumi, "g-kumi-2"),
    mode: "AFFILIATED",
    start: new Date("2026-12-19T22:00:00+13:00"),
    tickets: { kind: "external", url: "https://example.com/tickets" },
  },
];

export const pastList: Gig[] = [
  pastGig(holyGrail, "g-holy-grail", {
    media: gallery.slice(0, 5),
    lineup: flagship.lineup.slice(0, 2),
    tags: ["UKG"],
  }),
  pastGig(vitiman, "g-vitiman", { media: gallery.slice(2, 6) }),
  pastGig(fovos, "g-fovos", { tags: ["House"] }),
  pastGig(shipWrek, "g-shipwrek", { media: gallery.slice(1, 4) }),
  pastGig(caged, "g-caged-2", { media: gallery, tags: ["Bass"] }),
];

export const affiliatedList: Gig[] = [
  pastGig(kumi, "g-kumi", { mode: "AFFILIATED" }),
  pastGig(daffodil, "g-daffodil", { mode: "AFFILIATED" }),
];

// Taken once when the board loads, so renders stay pure.
const NOW = Date.now();

/** Why an admin sees a gig the public doesn't (mirrors `gigOffSiteNotice`). */
export function offSiteNotice(gig: Gig): string | null {
  if (gig.status !== "PUBLISHED")
    return "Draft. Nobody but an admin can see this.";
  if (gig.mode === "AFFILIATED" && gig.start.getTime() - NOW > 24 * 3600_000) {
    return "Affiliated. Goes on the site a day before it starts.";
  }
  return null;
}

export const isTba = (gig: Gig) => gig.mode === "TO_BE_ANNOUNCED";
export const isPast = (gig: Gig) => !isTba(gig) && gig.start.getTime() < NOW;

// ---------------------------------------------------------------------------
// Formatting

const tz = "Pacific/Auckland";
const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-NZ", { ...opts, timeZone: tz });
const dayFmt = fmt({ weekday: "short", day: "2-digit", month: "short" });
const longFmt = fmt({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = fmt({ hour: "numeric", minute: "2-digit" });
const monthFmt = fmt({ month: "long", year: "numeric" });
const dayNumFmt = fmt({ day: "2-digit" });
const weekdayFmt = fmt({ weekday: "short" });
const shortMonthFmt = fmt({ month: "short" });
const yearFmt = fmt({ year: "numeric" });

export const fmtDay = (d: Date) => dayFmt.format(d).replace(",", "");
export const fmtLong = (d: Date) => longFmt.format(d).replace(",", "");
export const fmtTime = (d: Date) =>
  timeFmt.format(d).replace(" ", "").toLowerCase();
export const fmtMonth = (d: Date) => monthFmt.format(d);
export const fmtDayNum = (d: Date) => dayNumFmt.format(d);
export const fmtWeekday = (d: Date) => weekdayFmt.format(d);
export const fmtShortMonth = (d: Date) => shortMonthFmt.format(d);
export const fmtYear = (d: Date) => yearFmt.format(d);

export const money = (cents: number) => {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
};
export const moneyExact = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Cheapest tier still purchasable, for "Tickets from $X". */
export const fromPrice = (event: TicketEvent) => {
  const open = event.tiers.filter(
    (t) => t.state === "available" || t.state === "low",
  );
  return open.length ? Math.min(...open.map((t) => t.priceCents)) : null;
};

/** The hero call to action label, following `GigTicketCta`. */
export function ctaLabel(gig: Gig): {
  label: string;
  tone: "buy" | "muted" | "external" | "none";
} {
  if (isTba(gig)) return { label: "Details", tone: "none" };
  const t = gig.tickets;
  if (t.kind === "external") return { label: "Get tickets", tone: "external" };
  if (t.kind === "none") return { label: "Details", tone: "none" };
  const e = t.event;
  if (e.status === "CANCELLED") return { label: "Cancelled", tone: "muted" };
  if (e.status === "SOLD_OUT") return { label: "Sold out", tone: "muted" };
  if (e.status === "NOT_ON_SALE")
    return {
      label: e.salesOpenAt
        ? `On sale ${fmtDay(e.salesOpenAt).slice(4)}`
        : "Not on sale",
      tone: "muted",
    };
  const from = fromPrice(e);
  if (from === 0)
    return {
      label: e.requiresApproval ? "Request a ticket" : "Free tickets",
      tone: "buy",
    };
  return { label: `Tickets from ${money(from ?? 0)}`, tone: "buy" };
}
