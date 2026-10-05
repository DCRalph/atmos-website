// Sample content for the mobile app mocks. Gigs and posters come from the
// public-site design fixtures (real Atmos gigs); tickets, the account and
// door numbers are placeholders.
import {
  contentItems,
  formatDay,
  formatLongMonth,
  formatMonth,
  formatTime,
  formatYear,
  lineup,
  listingGigs,
  pastGigs,
  ticketTiers,
  type MockGig,
} from "../design/fixtures";

export {
  contentItems,
  formatDay,
  formatLongMonth,
  formatMonth,
  formatTime,
  formatYear,
  lineup,
  pastGigs,
  ticketTiers,
  type MockGig,
};

/** The next gig: the one Home leads with and the tickets belong to. */
export const nextGig = listingGigs[0]!;

/** The tier on sale for the next gig. */
export const fromPrice = ticketTiers[1].price;

/** Everything after the next gig, in date order, TBA last. */
export const laterGigs = listingGigs.slice(1);

/** Consecutive gigs sharing a month, the way the site groups its listings. */
export function groupByMonth(gigs: readonly MockGig[]) {
  const groups: { key: string; date: Date | null; gigs: MockGig[] }[] = [];
  for (const gig of gigs) {
    const key = gig.date
      ? `${formatLongMonth(gig.date)} ${formatYear(gig.date)}`
      : "tba";
    const last = groups.at(-1);
    if (last?.key === key) last.gigs.push(gig);
    else groups.push({ key, date: gig.date, gigs: [gig] });
  }
  return groups;
}

/** "Fri 09 Oct · 9:00pm", or "Date TBA". */
export const whenLine = (gig: MockGig) =>
  gig.date ? `${formatDay(gig.date)} · ${formatTime(gig.date)}` : "Date TBA";

export const statusLabel: Record<MockGig["status"], string | null> = {
  "on-sale": null,
  "sold-out": "Sold out",
  tba: "TBA",
  free: "Free entry",
  past: null,
};

export const account = {
  name: "Sam Taylor",
  email: "sam@example.com",
  isStaff: true,
};

export type MockTicket = {
  number: string;
  tier: string;
  holder: string;
};

export type MockOrder = {
  id: string;
  gig: MockGig;
  tickets: MockTicket[];
};

/** Two tickets for the next gig. */
export const currentOrder: MockOrder = {
  id: "ord-1",
  gig: nextGig,
  tickets: [
    { number: "ATM-7K2Q-91XD", tier: "General", holder: "Sam Taylor" },
    { number: "ATM-7K2Q-44PA", tier: "General", holder: "Guest" },
  ],
};

export const laterOrder: MockOrder = {
  id: "ord-2",
  gig: laterGigs[0]!,
  tickets: [
    { number: "ATM-3LMV-08RT", tier: "Early bird", holder: "Sam Taylor" },
  ],
};

export const pastOrders: MockOrder[] = [
  {
    id: "ord-0",
    gig: pastGigs[0],
    tickets: [
      { number: "ATM-1QZX-55KE", tier: "General", holder: "Sam Taylor" },
    ],
  },
  {
    id: "ord-00",
    gig: pastGigs[1],
    tickets: [
      { number: "ATM-0PDN-12WB", tier: "Free entry", holder: "Sam Taylor" },
    ],
  },
];

/** Door counts for the scanner header. */
export const door = { inside: 412, capacity: 600, scannedLast10: 38 };
