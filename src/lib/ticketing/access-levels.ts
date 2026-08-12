import type { TicketAccessLevel } from "~Prisma/client";

/**
 * What a ticket gets you past.
 *
 * Shared by the door, the admin UI, and the routers that validate a change, so
 * the badge on a scanner and the option in a dropdown can never mean different
 * things. Ordered least to most access, which is the order a promoter thinks
 * in and the order these should always be listed.
 *
 * `tone` is a Tailwind class pair, not a colour name — the door screen already
 * paints its own background from the scan result, so a level badge has to sit
 * on top of green, amber or red and stay readable on all three. Hence the
 * solid, high-contrast pairs rather than tints.
 */

export const ACCESS_LEVELS = [
  {
    value: "GENERAL",
    label: "General",
    short: "GA",
    tone: "bg-white text-black",
    passAccent: null,
  },
  {
    value: "GUEST",
    label: "Guest list",
    short: "GUEST",
    tone: "bg-sky-300 text-sky-950",
    passAccent: "#7DD3FC",
  },
  {
    value: "VIP",
    label: "VIP",
    short: "VIP",
    tone: "bg-violet-300 text-violet-950",
    passAccent: "#C4B5FD",
  },
  {
    value: "ARTIST",
    label: "Artist",
    short: "ARTIST",
    tone: "bg-amber-300 text-amber-950",
    passAccent: "#FCD34D",
  },
  {
    value: "CREW",
    label: "Crew",
    short: "CREW",
    tone: "bg-teal-300 text-teal-950",
    passAccent: "#5EEAD4",
  },
  {
    value: "AAA",
    label: "Access all areas",
    short: "AAA",
    tone: "bg-fuchsia-300 text-fuchsia-950",
    passAccent: "#F0ABFC",
  },
] as const satisfies readonly {
  value: TicketAccessLevel;
  label: string;
  short: string;
  tone: string;
  /**
   * The colour a wallet pass tints itself with. Null on general admission,
   * which leaves the event's own theme alone — only a ticket worth more than
   * the standard one announces itself.
   */
  passAccent: string | null;
}[];

export type AccessLevelValue = (typeof ACCESS_LEVELS)[number]["value"];

export const ACCESS_LEVEL_VALUES = ACCESS_LEVELS.map(
  (level) => level.value,
) satisfies AccessLevelValue[];

const BY_VALUE = new Map<string, (typeof ACCESS_LEVELS)[number]>(
  ACCESS_LEVELS.map((level) => [level.value, level]),
);

export function accessLevel(value: string | null | undefined) {
  return BY_VALUE.get(value ?? "") ?? ACCESS_LEVELS[0];
}

/** Everything above general admission is worth pointing at on a door screen. */
export function isElevated(value: string | null | undefined): boolean {
  return Boolean(value) && value !== "GENERAL";
}

/**
 * What to call a ticket wherever a tier name used to be printed.
 *
 * A comp is minted rather than drawn, so it belongs to no tier and has no tier
 * name to show. It falls back to what it gets you past — an AAA comp reads
 * "Access all areas" instead of leaving a blank on a door screen.
 */
export function ticketTypeName(ticket: {
  tier?: { name: string } | null;
  accessLevel: string;
}): string {
  return ticket.tier?.name ?? accessLevel(ticket.accessLevel).label;
}

/**
 * Where a level sits, 0 for general admission through 1 for access-all-areas.
 *
 * Used to decide how far a pass's accent floods its band: the higher the
 * access, the more colour, so an AAA pass is obvious across a dark room while a
 * GA pass stays the event's own design.
 */
export function accessLevelRank(value: string | null | undefined): number {
  const index = ACCESS_LEVELS.findIndex((level) => level.value === value);
  if (index <= 0) return 0;
  return index / (ACCESS_LEVELS.length - 1);
}
