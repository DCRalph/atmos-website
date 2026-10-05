import type { ProfileSection } from "~/lib/creator-sections";
import type { ProfileSet, PublicProfile } from "./types";

/**
 * A stand-in profile for previews: the theme editor when there's no profile
 * of your own to show (`/creator-preview`), and the `/ui-test/creator-profile`
 * board. Photos and posters are real Atmos images; the name, bio, roles and
 * links are placeholders.
 */
export const sampleStates = [
  { id: "full", label: "Busy", hint: "Sets booked, music, photos and links." },
  { id: "live", label: "On now", hint: "Their set started 50 minutes ago." },
  {
    id: "quiet",
    label: "Nothing booked",
    hint: "No upcoming sets: the hero hands over to their music.",
  },
  {
    id: "unclaimed",
    label: "Unclaimed",
    hint: "Made by an admin from lineups: just a name and their sets.",
  },
] as const;

export type SampleState = (typeof sampleStates)[number]["id"];

const POSTERS = "https://r2.atmosmedia.co.nz/gigs";
const poster = {
  intuition: `${POSTERS}/cmtu4wrik000004ilz8sqf3xc/poster/0a6fde35-ea27-4fd8-a315-1d57a8dd2332.webp`,
  tba: `${POSTERS}/cmtu1hajb000004i8yftxgch7/poster/0030cd85-308f-4d4f-a879-b42dd1035c11.webp`,
  holyGrail: `${POSTERS}/cmtzmzsqo000004k1p5bs9co3/poster/92e69344-e558-472e-a690-6f042b04f67d.webp`,
  daffodil: `${POSTERS}/cmt7wg2f9000004jrkpjgumnn/poster/e375b8ce-dfe5-4322-ae91-cc27b92dcaa3.gif`,
  vitiman: `${POSTERS}/cmso0dv0y000604l4jjifq2jz/poster/15e108df-749c-40fa-8be9-3d275280645e.webp`,
  fovos: `${POSTERS}/cmrvwb9tn000004l7890pct2h/poster/6f06c9d0-22f8-47de-b4f6-f90d7ab7f880.webp`,
  kumi: `${POSTERS}/cmsoiitn4000704jozh6aprf1/poster/f45aa26a-500e-4a96-a6de-cbc698cb07a6.webp`,
  shipWrek: `${POSTERS}/cmpc99mni000004kw616dx45z/poster/ba8e7641-54b2-4db8-8cf5-901a4aeb5410.webp`,
  caged: `${POSTERS}/cmhots2ds000ebdbg86ydximn/poster/dc39533f-f353-4e5d-a68f-e880de6c1e1e.webp`,
};

/** A date `days` from `now` at `hour` in Auckland summer time, like real gigs. */
function at(now: number, days: number, hour: number) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
  }).format(now + days * 86_400_000);
  return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+13:00`);
}

function set(
  id: string,
  title: string,
  venue: string,
  start: Date,
  posterUrl: string | null,
  role: string | null,
  extra: { tba?: boolean; ticketLink?: string; end?: Date } = {},
): ProfileSet {
  return {
    id,
    gig: {
      id: `sample-${id}`,
      title,
      mode: extra.tba ? "TO_BE_ANNOUNCED" : "NORMAL",
      ticketLink: extra.ticketLink ?? null,
    },
    venue,
    start,
    end: extra.end ?? null,
    poster: posterUrl,
    role,
  };
}

const PAST: ProfileSet[] = [
  set(
    "p1",
    "Intuition Vol.3 Tour",
    "Holy Grail",
    new Date("2026-09-25T22:00:00+12:00"),
    poster.holyGrail,
    "Headline",
  ),
  set(
    "p2",
    "Daffodil Dancefloor",
    "San Fran",
    new Date("2026-08-28T18:00:00+12:00"),
    poster.daffodil,
    "Support",
  ),
  set(
    "p3",
    "Club Vitiman",
    "113 Taranaki St",
    new Date("2026-08-14T22:00:00+12:00"),
    poster.vitiman,
    "Support",
  ),
  set(
    "p4",
    "FOVOS",
    "Meow",
    new Date("2026-08-01T22:00:00+12:00"),
    poster.fovos,
    "B2B with a friend",
  ),
  set(
    "p5",
    "Kumi x Chris Keene x Mikeyy",
    "San Fran",
    new Date("2026-06-20T23:00:00+12:00"),
    poster.kumi,
    "Opening",
  ),
  set(
    "p6",
    "Ship Wrek",
    "The Grand",
    new Date("2026-05-30T20:00:00+12:00"),
    poster.shipWrek,
    "Support",
  ),
  set(
    "p7",
    "Intuition Vol.2 Tour",
    "San Fran",
    new Date("2025-11-14T21:00:00+13:00"),
    null,
    "Headline",
  ),
  set(
    "p8",
    "Caged V2",
    "Pōneke // Wellington",
    new Date("2024-06-08T22:00:00+12:00"),
    poster.caged,
    "Support",
  ),
];

const SECTIONS: ProfileSection[] = [
  { id: "gigs", type: "GIG_LIST", title: "Sets" },
  { id: "listen-h", type: "HEADING", text: "Listen", level: 2, align: "left" },
  {
    id: "listen",
    type: "SOUNDCLOUD_PLAYLIST",
    url: "https://soundcloud.com/atmosmedia",
  },
  { id: "photos-h", type: "HEADING", text: "Photos", level: 2, align: "left" },
  {
    id: "photos",
    type: "GALLERY",
    srcs: [
      "/home/atmos-10.jpg",
      "/home/atmos-17.jpg",
      "/home/a1 website art.jpg",
      "/home/atmos-8.jpg",
      "/home/atmos-6.jpg",
    ],
  },
  {
    id: "past",
    type: "PAST_GIGS",
    title: "Past sets",
    showRole: true,
    includeUpcoming: false,
  },
  { id: "links-h", type: "HEADING", text: "Bookings", level: 2, align: "left" },
  {
    id: "links",
    type: "LINK_LIST",
    links: [
      { label: "Bookings", url: "https://atmosmedia.co.nz/contact" },
      { label: "Press kit", url: "https://atmosmedia.co.nz/about" },
    ],
  },
];

/** The sample profile in one of the board's states, dated relative to `now`. */
export function buildSampleProfile(
  state: SampleState = "full",
  now = Date.now(),
): PublicProfile {
  const upcoming: ProfileSet[] = [
    state === "live"
      ? set(
          "u1",
          "Intuition Vol.3 Tour",
          "San Fran",
          new Date(now - 50 * 60_000),
          poster.intuition,
          "Headline",
          {
            end: new Date(now + 4 * 3_600_000),
            ticketLink: "https://atmosmedia.co.nz/gigs",
          },
        )
      : set(
          "u1",
          "Intuition Vol.3 Tour",
          "San Fran",
          at(now, 4, 21),
          poster.intuition,
          "Headline",
          {
            ticketLink: "https://atmosmedia.co.nz/gigs",
          },
        ),
    set(
      "u2",
      "FOVOS",
      "Meow",
      at(now, 19, 22),
      poster.fovos,
      "B2B with a friend",
    ),
    set(
      "u3",
      "Daffodil Dancefloor",
      "San Fran",
      at(now, 33, 16),
      poster.daffodil,
      "Support",
      {
        ticketLink: "https://atmosmedia.co.nz/gigs",
      },
    ),
    set("u4", "Caged V3", "Pōneke", at(now, 68, 21), poster.caged, "Headline"),
    set("u5", "TBA", "Pōneke", at(now, 90, 21), poster.tba, null, {
      tba: true,
    }),
  ];

  const full: PublicProfile = {
    id: "sample",
    handle: "yourname",
    name: "Your name",
    tagline: "House, garage and breaks from Pōneke",
    bio: "A line or two about who you are and what you play. This is a sample profile, so the words here are placeholders.\n\nEverything below the hero is yours to arrange in the profile builder: sets, music, video, photos, text and links, in any order.",
    portrait: "/home/atmos-2.jpg",
    banner: "/home/atmos-1.jpg",
    claimed: true,
    socials: [
      {
        platform: "instagram",
        url: "https://instagram.com/atmos.nz",
        label: null,
      },
      {
        platform: "soundcloud",
        url: "https://soundcloud.com/atmosmedia",
        label: null,
      },
      {
        platform: "youtube",
        url: "https://www.youtube.com/@Atmosmediatv",
        label: null,
      },
    ],
    sections: SECTIONS,
    upcoming,
    past: PAST,
  };

  if (state === "quiet")
    return {
      ...full,
      upcoming: [],
      sections: SECTIONS.filter((s) => s.type !== "GIG_LIST"),
    };

  if (state === "unclaimed")
    return {
      ...full,
      id: "sample-unclaimed",
      handle: "kraayjoy",
      name: "Kraayjoy",
      tagline: null,
      bio: null,
      portrait: null,
      banner: null,
      claimed: false,
      socials: [],
      sections: SECTIONS.filter(
        (s) => s.type === "GIG_LIST" || s.type === "PAST_GIGS",
      ),
      upcoming: [upcoming[3]!],
      past: [PAST[7]!],
    };

  return full;
}
