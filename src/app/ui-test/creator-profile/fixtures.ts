// Sample creator for the profile mocks. The photo, gig titles, venues, past
// dates and posters are real Atmos material; bio, tracks, roles, prices and
// links are illustrative.
import { pastGigs, upcomingGigs } from "../design/fixtures";

export type Ticket = {
  label: string;
  tone: "buy" | "muted" | "none";
};

/** One slot on a lineup: the gig plus what this creator was billed as. */
export type ProfileSet = {
  id: string;
  title: string;
  venue: string;
  /** Null while the gig is TBA. */
  start: Date | null;
  end?: Date | null;
  poster: string | null;
  role: string | null;
  ticket: Ticket;
};

export type Track = {
  id: string;
  title: string;
  length: string;
  artwork: string;
  /** Bar heights, 0..1. */
  wave: number[];
};

export type SocialPlatform =
  "instagram" | "soundcloud" | "spotify" | "youtube" | "tiktok";

export type MockProfile = {
  handle: string;
  name: string;
  tagline: string | null;
  bio: string[];
  /** The creator's own photos get the theme's photo treatment. */
  portrait: string | null;
  banner: string | null;
  claimed: boolean;
  socials: { platform: SocialPlatform; url: string }[];
  links: { label: string; detail: string; url: string }[];
  upcoming: ProfileSet[];
  past: ProfileSet[];
  tracks: Track[];
  video: { title: string; thumb: string; length: string } | null;
  gallery: string[];
};

export const profileStates = [
  {
    id: "full",
    label: "Busy",
    hint: "Five sets booked, music, video and photos.",
  },
  {
    id: "live",
    label: "On now",
    hint: "Their set started 50 minutes ago.",
  },
  {
    id: "quiet",
    label: "Nothing booked",
    hint: "No upcoming sets: the hero hands over to their music.",
  },
  {
    id: "unclaimed",
    label: "Unclaimed",
    hint: "Made by an admin from lineups. Uses the Atmos theme until claimed.",
  },
] as const;

export type ProfileStateId = (typeof profileStates)[number]["id"];

/** Deterministic waveform so server and client agree. */
function wave(seed: number, bars = 64) {
  let x = seed;
  return Array.from({ length: bars }, (_, i) => {
    x = (x * 9301 + 49297) % 233280;
    const envelope = 0.55 + 0.45 * Math.sin((i / bars) * Math.PI);
    return Math.max(0.12, (x / 233280) * envelope);
  });
}

const [intuition, tba] = upcomingGigs;
const [holyGrail, daffodil, vitiman, fovos, kumi, shipWrek, caged] = pastGigs;

const buy = (label: string): Ticket => ({ label, tone: "buy" });
const muted = (label: string): Ticket => ({ label, tone: "muted" });
const done: Ticket = { label: "", tone: "none" };

/** A date `days` from today at `hour` in Auckland summer time, like real gigs. */
function at(now: number, days: number, hour: number) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
  }).format(now + days * 86_400_000);
  return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+13:00`);
}

const past: ProfileSet[] = [
  {
    id: "p1",
    title: "Intuition Vol.3 Tour",
    venue: holyGrail.venue,
    start: holyGrail.date,
    poster: holyGrail.poster,
    role: "Headline",
    ticket: done,
  },
  {
    id: "p2",
    title: daffodil.title,
    venue: daffodil.venue,
    start: daffodil.date,
    poster: daffodil.poster,
    role: "Support",
    ticket: done,
  },
  {
    id: "p3",
    title: vitiman.title,
    venue: vitiman.venue,
    start: vitiman.date,
    poster: vitiman.poster,
    role: "Support",
    ticket: done,
  },
  {
    id: "p4",
    title: fovos.title,
    venue: fovos.venue,
    start: fovos.date,
    poster: fovos.poster,
    role: "B2B with Taiji",
    ticket: done,
  },
  {
    id: "p5",
    title: kumi.title,
    venue: kumi.venue,
    start: kumi.date,
    poster: kumi.poster,
    role: "Opening",
    ticket: done,
  },
  {
    id: "p6",
    title: shipWrek.title,
    venue: shipWrek.venue,
    start: shipWrek.date,
    poster: shipWrek.poster,
    role: "Support",
    ticket: done,
  },
  {
    id: "p7",
    title: "Intuition Vol.2 Tour",
    venue: "San Fran",
    start: new Date("2025-11-14T21:00:00+13:00"),
    poster: null,
    role: "Headline",
    ticket: done,
  },
  {
    id: "p8",
    title: "Caged V2",
    venue: "Pōneke // Wellington",
    start: caged.date,
    poster: caged.poster,
    role: "Support",
    ticket: done,
  },
];

const tracks: Track[] = [
  {
    id: "t1",
    title: "Intuition",
    length: "5:48",
    artwork: intuition.poster,
    wave: wave(7),
  },
  {
    id: "t2",
    title: "Holy Grail",
    length: "6:12",
    artwork: holyGrail.poster,
    wave: wave(19),
  },
  {
    id: "t3",
    title: "Taranaki St",
    length: "4:57",
    artwork: vitiman.poster,
    wave: wave(31),
  },
  {
    id: "t4",
    title: "Night Bus Home",
    length: "5:20",
    artwork: fovos.poster,
    wave: wave(43),
  },
];

/** The sample profile in one of the board's states, dated relative to `now`. */
export function buildProfile(state: ProfileStateId, now: number): MockProfile {
  const upcoming: ProfileSet[] = [
    {
      id: "u1",
      title: "Intuition Vol.3 Tour",
      venue: intuition.venue,
      start: at(now, 4, 21),
      poster: intuition.poster,
      role: "Headline",
      ticket: buy("Tickets $25"),
    },
    {
      id: "u2",
      title: fovos.title,
      venue: fovos.venue,
      start: at(now, 19, 22),
      poster: fovos.poster,
      role: "B2B with Taiji",
      ticket: muted("Sold out"),
    },
    {
      id: "u3",
      title: daffodil.title,
      venue: daffodil.venue,
      start: at(now, 33, 16),
      poster: daffodil.poster,
      role: "Support",
      ticket: buy("Free"),
    },
    {
      id: "u4",
      title: "Caged V3",
      venue: "Pōneke",
      start: at(now, 68, 21),
      poster: caged.poster,
      role: "Headline",
      ticket: muted("Not on sale yet"),
    },
    {
      id: "u5",
      title: "TBA",
      venue: tba.venue,
      start: null,
      poster: tba.poster,
      role: null,
      ticket: { label: "Details", tone: "none" },
    },
  ];

  if (state === "live") {
    upcoming[0] = {
      ...upcoming[0]!,
      start: new Date(now - 50 * 60_000),
      end: new Date(now + 4 * 3_600_000),
      ticket: buy("Door sales"),
    };
  }

  const full: MockProfile = {
    handle: "broderbeats",
    name: "broderbeats",
    tagline: "House, garage and breaks from Pōneke",
    bio: [
      "broderbeats is a Pōneke DJ and producer and one of the Atmos crew. Rolling house that leans into garage and breaks, played loud and late.",
      "Intuition Vol.3 is the third chapter of the Intuition series, toured through spring with a homecoming at San Fran.",
    ],
    portrait: "/crew_pfp/broderbeats.jpg",
    banner: "/home/atmos-1.jpg",
    claimed: true,
    socials: [
      { platform: "instagram", url: "https://instagram.com" },
      { platform: "soundcloud", url: "https://soundcloud.com" },
      { platform: "spotify", url: "https://open.spotify.com" },
      { platform: "youtube", url: "https://youtube.com" },
      { platform: "tiktok", url: "https://tiktok.com" },
    ],
    links: [
      { label: "Bookings", detail: "Club, festival, private", url: "#" },
      { label: "Press kit", detail: "Photos, bio, rider", url: "#" },
      { label: "Intuition Vol.3", detail: "Out now on Spotify", url: "#" },
    ],
    upcoming,
    past,
    tracks,
    video: {
      title: "Intuition Vol.3, live at Holy Grail",
      thumb: "/home/atmos-2.jpg",
      length: "58:21",
    },
    gallery: [
      "/home/atmos-10.jpg",
      "/home/atmos-17.jpg",
      "/home/a1 website art.jpg",
      "/home/atmos-8.jpg",
      "/home/atmos-6.jpg",
    ],
  };

  if (state === "quiet") return { ...full, upcoming: [] };

  if (state === "unclaimed")
    return {
      handle: "kraayjoy",
      name: "Kraayjoy",
      tagline: null,
      bio: [],
      portrait: null,
      banner: null,
      claimed: false,
      socials: [],
      links: [],
      upcoming: [upcoming[3]!],
      past: [past[7]!],
      tracks: [],
      video: null,
      gallery: [],
    };

  return full;
}
