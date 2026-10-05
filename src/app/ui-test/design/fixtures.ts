// Sample content for the design mocks. Titles, venues, dates and posters are
// real Atmos gigs; prices and ticket tiers are illustrative.

// Posters moved from the old S3 bucket to R2; the S3 copies are gone.
const S3 = "https://r2.atmosmedia.co.nz/gigs";
const SHOPIFY = "https://cdn.shopify.com/s/files/1/0735/5957/2619/files";

export type MockGig = {
  slug: string;
  title: string;
  /** Short name for display headlines where the full title is a lineup. */
  headline: string;
  venue: string;
  date: Date | null;
  poster: string;
  status: "on-sale" | "sold-out" | "tba" | "free" | "past";
};

export const upcomingGigs = [
  {
    slug: "broderbeats-intuition-vol-3-tour",
    title: "broderbeats INTUITION Vol.3 Tour",
    headline: "Intuition Vol.3",
    venue: "San Fran",
    date: new Date("2026-10-09T21:00:00+13:00"),
    poster: `${S3}/cmtu4wrik000004ilz8sqf3xc/poster/0a6fde35-ea27-4fd8-a315-1d57a8dd2332.webp`,
    status: "on-sale",
  },
  {
    slug: "tba",
    title: "TBA",
    headline: "TBA",
    venue: "Pōneke",
    date: null,
    poster: `${S3}/cmtu1hajb000004i8yftxgch7/poster/0030cd85-308f-4d4f-a879-b42dd1035c11.webp`,
    status: "tba",
  },
] as const satisfies readonly MockGig[];

export const pastGigs = [
  {
    slug: "broderbeats-intuition-vol-3-tour-holy-grail",
    title: "broderbeats INTUITION Vol.3 Tour",
    headline: "Intuition Vol.3",
    venue: "Holy Grail",
    date: new Date("2026-09-25T22:00:00+12:00"),
    poster: `${S3}/cmtzmzsqo000004k1p5bs9co3/poster/92e69344-e558-472e-a690-6f042b04f67d.webp`,
    status: "past",
  },
  {
    slug: "daffodil-dancefloor",
    title: "Daffodil Dancefloor",
    headline: "Daffodil Dancefloor",
    venue: "San Fran",
    date: new Date("2026-08-28T18:00:00+12:00"),
    poster: `${S3}/cmt7wg2f9000004jrkpjgumnn/poster/e375b8ce-dfe5-4322-ae91-cc27b92dcaa3.gif`,
    status: "past",
  },
  {
    slug: "club-vitiman",
    title: "Club Vitiman",
    headline: "Club Vitiman",
    venue: "113 Taranaki St",
    date: new Date("2026-08-14T22:00:00+12:00"),
    poster: `${S3}/cmso0dv0y000604l4jjifq2jz/poster/15e108df-749c-40fa-8be9-3d275280645e.webp`,
    status: "past",
  },
  {
    slug: "fovos",
    title: "FOVOS",
    headline: "Fovos",
    venue: "Meow",
    date: new Date("2026-08-01T22:00:00+12:00"),
    poster: `${S3}/cmrvwb9tn000004l7890pct2h/poster/6f06c9d0-22f8-47de-b4f6-f90d7ab7f880.webp`,
    status: "past",
  },
  {
    slug: "kumi-x-chris-keene-x-mikeyy",
    title: "Kumi x Chris Keene x Mikeyy",
    headline: "Kumi x Chris Keene",
    venue: "San Fran",
    date: new Date("2026-06-20T23:00:00+12:00"),
    poster: `${S3}/cmsoiitn4000704jozh6aprf1/poster/f45aa26a-500e-4a96-a6de-cbc698cb07a6.webp`,
    status: "past",
  },
  {
    slug: "ship-wrek",
    title: "Ship Wrek",
    headline: "Ship Wrek",
    venue: "The Grand",
    date: new Date("2026-05-30T20:00:00+12:00"),
    poster: `${S3}/cmpc99mni000004kw616dx45z/poster/ba8e7641-54b2-4db8-8cf5-901a4aeb5410.webp`,
    status: "past",
  },
  {
    slug: "caged-v2",
    title: "Caged V2 with Kraayjoy, Bidois, Broderbeats, Licious, Tonkus",
    headline: "Caged V2",
    venue: "Pōneke // Wellington",
    date: new Date("2024-06-08T22:00:00+12:00"),
    poster: `${S3}/cmhots2ds000ebdbg86ydximn/poster/dc39533f-f353-4e5d-a68f-e880de6c1e1e.webp`,
    status: "past",
  },
] as const satisfies readonly MockGig[];

/** Upcoming list used by the month-grouped listing; mixes states on purpose. */
export const listingGigs: MockGig[] = [
  upcomingGigs[0],
  {
    ...pastGigs[3],
    slug: "fovos-2",
    date: new Date("2026-10-24T22:00:00+13:00"),
    status: "sold-out",
  },
  {
    ...pastGigs[1],
    slug: "daffodil-2",
    date: new Date("2026-11-07T16:00:00+13:00"),
    status: "free",
  },
  {
    ...pastGigs[5],
    slug: "ship-wrek-2",
    date: new Date("2026-11-28T21:00:00+13:00"),
    status: "on-sale",
  },
  upcomingGigs[1],
];

export const lineup = [
  { name: "broderbeats", role: "Headline", image: "/crew_pfp/broderbeats.jpg" },
  { name: "Sunday", role: "Support", image: "/crew_pfp/sunday.jpg" },
  { name: "Special K", role: "Support", image: "/crew_pfp/specialk.jpg" },
  { name: "Taiji", role: "Opening", image: "/crew_pfp/taiji.jpg" },
];

export const ticketTiers = [
  { name: "Early bird", price: 25, state: "sold-out" },
  { name: "General", price: 35, state: "on-sale" },
  { name: "Final release", price: 45, state: "upcoming" },
] as const;

export const merch = [
  {
    name: "Guys staple tee",
    colour: "Black",
    price: 54.99,
    image: `${SHOPIFY}/atmos_man_black.jpg?v=1773917228`,
  },
  {
    name: "Girls staple tee",
    colour: "Black",
    price: 54.99,
    image: `${SHOPIFY}/atmos_woman_black_e81cf259-2d92-4a29-ab56-83b1a49aa2ed.jpg?v=1773917259`,
  },
  {
    name: "Guys staple tee",
    colour: "White",
    price: 54.99,
    image: `${SHOPIFY}/atmos_man_white_81f1c908-5162-46e0-b4d7-b50b61a40c02.jpg?v=1773917284`,
  },
  {
    name: "Girls staple tee",
    colour: "White",
    price: 54.99,
    image: `${SHOPIFY}/atmos_woman_white.jpg?v=1773917228`,
  },
];

export const sizes = ["XS", "S", "M", "L", "XL", "2XL"] as const;

export const navLinks = [
  "Gigs",
  "Content",
  "Merch",
  "Socials",
  "Crew",
  "Contact",
] as const;

export const photos = {
  crowd: "/home/atmos-46.jpg",
  booth: "/home/atmos-17.jpg",
  lights: "/home/atmos-9.jpg",
  caged: "/home/CAGED 2-95.jpg",
};

const nzDate = new Intl.DateTimeFormat("en-NZ", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "Pacific/Auckland",
});
const nzTime = new Intl.DateTimeFormat("en-NZ", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Pacific/Auckland",
});
const nzMonth = new Intl.DateTimeFormat("en-NZ", {
  month: "short",
  timeZone: "Pacific/Auckland",
});
const nzLongMonth = new Intl.DateTimeFormat("en-NZ", {
  month: "long",
  timeZone: "Pacific/Auckland",
});
const nzYear = new Intl.DateTimeFormat("en-NZ", {
  year: "numeric",
  timeZone: "Pacific/Auckland",
});

/** "Fri 09 Oct" in NZ time, or "Date TBA". */
export const formatDay = (date: Date | null) =>
  date ? nzDate.format(date).replace(",", "") : "Date TBA";
export const formatTime = (date: Date | null) =>
  date ? nzTime.format(date).replace(" ", "").toLowerCase() : "";
export const formatMonth = (date: Date) => nzMonth.format(date);
export const formatLongMonth = (date: Date) => nzLongMonth.format(date);
export const formatYear = (date: Date) => nzYear.format(date);

const MEDIA = "https://atmosmedia.co.nz/api/media";

export const crew = [
  {
    name: "B-Tello",
    role: "Producer / DJ",
    image: `${MEDIA}/02a9a98e-2da0-4ee9-843b-d1be3f2ff84d`,
  },
  {
    name: "broderbeats",
    role: "DJ / Producer",
    image: `${MEDIA}/762c9511-c951-497b-a291-aa955cbfc7e7`,
  },
  {
    name: "Special K",
    role: "DJ / Producer",
    image: `${MEDIA}/18dd4f22-9d36-47ca-a719-0f7c94eb2417`,
  },
  {
    name: "Sunday",
    role: "Producer / DJ / Videographer",
    image: `${MEDIA}/d4e94511-7a83-4d37-8f87-9d74c829ebd1`,
  },
  {
    name: "Taiji",
    role: "DJ",
    image: `${MEDIA}/0e4dd694-344d-4f91-a6fa-d1c53242dd79`,
  },
  {
    name: "Cos",
    role: "DJ",
    image: `${MEDIA}/072e232f-4844-4df3-b4ae-c8465c40cd93`,
  },
];

export type MockContent = {
  id: string;
  title: string;
  platform: "SoundCloud" | "Spotify" | "YouTube";
  date: Date;
  blurb: string;
  image: string;
  /** Seconds. Mix lengths are illustrative. */
  duration?: number;
};

export const contentItems: MockContent[] = [
  {
    id: "radio-1",
    title: "Atmos Radio Vol.1 Ep.1 · Sunday",
    platform: "SoundCloud",
    date: new Date("2026-03-10T12:00:00+13:00"),
    blurb:
      "Sunday takes over Atmos Radio for a journey through UK sound and sound system culture, 130 to 140 BPM.",
    image: "/home/atmos-10.jpg",
    duration: 3540,
  },
  {
    id: "selects-sc",
    title: "Atmos Selects",
    platform: "SoundCloud",
    date: new Date("2026-01-13T12:00:00+13:00"),
    blurb: "The bootlegs and dubs you've heard at our gigs. Updated weekly.",
    image: "/home/atmos-6.jpg",
  },
  {
    id: "selects-sp",
    title: "Atmos Selects",
    platform: "Spotify",
    date: new Date("2026-01-13T12:00:00+13:00"),
    blurb: "What we're playing right now. Updated weekly.",
    image: "/home/atmos-8.jpg",
  },
];

export const gallery = [
  { src: "/home/atmos-46.jpg", alt: "Atmos gig photo" },
  { src: "/home/atmos-17.jpg", alt: "Atmos gig photo" },
  { src: "/home/atmos-9.jpg", alt: "Atmos gig photo" },
  { src: "/home/CAGED 2-95.jpg", alt: "Caged V2" },
  { src: "/home/atmos-2.jpg", alt: "Atmos gig photo" },
  { src: "/home/atmos-15.jpg", alt: "Atmos gig photo" },
];

// Illustrative venue info for the gig page.
export const gigFaq = [
  {
    q: "Is it R18?",
    a: "Yes. Bring photo ID: driver licence, passport or Kiwi Access card.",
  },
  {
    q: "Can I get a refund?",
    a: "Tickets are refundable up to 7 days before the gig. After that you can transfer your ticket to a mate from the email we send you.",
  },
  {
    q: "Is the venue accessible?",
    a: "San Fran has step-free access through the main entrance and an accessible bathroom. Message us and we'll hold a spot near the bar.",
  },
  {
    q: "What time should I arrive?",
    a: "Doors at 9pm. The headline set starts around 12:30am.",
  },
];
