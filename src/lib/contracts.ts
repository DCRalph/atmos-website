import { formatCueTime, RUN_SHEET_TIMEZONE } from "~/lib/run-sheet/schedule";
import { formatNZD } from "~/lib/ticketing/money";

/**
 * What the contract pages under /admin/contracts fill in from the database.
 *
 * Every value is a string as it should read on the page. Anything the
 * database does not hold (a fee, a bank account, a bond) stays blank for
 * whoever generates the contract to type in before printing.
 */

/** Shown in each contract's masthead. Bump it when the terms change. */
export const CONTRACT_VERSION = "Draft v0.1 · November 2026";

export type PerformerDetails = {
  legalName: string;
  stageName: string;
  email: string;
  event: string;
  venue: string;
  date: string;
  setTime: string;
  setLength: string;
  /** Thirty minutes before the set, the latest the terms let them arrive. */
  arriveBy: string;
  atmosContact: string;
};

export type HireDetails = {
  name: string;
  email: string;
  collection: string;
  return: string;
  hireFee: string;
  dailyRate: string;
  items: { name: string; quantity: string }[];
};

/** One artist in one set, as `~/server/contracts` selects it. */
export type SetArtistForContract = {
  artistProfile: {
    displayName: string;
    /** The account that claimed the profile, if anyone has. */
    user: { name: string; email: string } | null;
  };
  item: {
    startsAt: Date | null;
    endsAt: Date | null;
    gig: {
      title: string;
      gigStartTime: Date;
      venue: { name: string; address: string | null } | null;
    };
  };
};

type LineItem = { quantity: number; gearItem: { name: string } };

/** One rental request, as `~/server/contracts` selects it. */
export type RentalForContract = {
  userName: string;
  contactInfo: string;
  startDate: Date;
  endDate: Date;
  /** Dollars, like every price on a rental. */
  discountedDailyPrice: number;
  estimatedTotalPrice: number;
  gearPackage: { items: LineItem[] } | null;
  rentalItems: LineItem[];
};

/** How long before their set a performer must be at the venue (clause 2.1). */
const ARRIVAL_LEAD_MINUTES = 30;

const dayFormatter = new Intl.DateTimeFormat("en-NZ", {
  timeZone: RUN_SHEET_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * "Saturday 14 November 2026". Assembled from parts because the joined form
 * differs between runtimes (commas, ordering).
 */
export function formatContractDate(date: Date): string {
  const parts = dayFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

export function performerDetails(
  { artistProfile, item }: SetArtistForContract,
  atmosContact: string,
): PerformerDetails {
  const { gig, startsAt, endsAt } = item;
  const minutes =
    startsAt && endsAt
      ? Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
      : 0;

  return {
    legalName: artistProfile.user?.name ?? "",
    stageName: artistProfile.displayName,
    email: artistProfile.user?.email ?? "",
    event: gig.title,
    venue: gig.venue
      ? [gig.venue.name, gig.venue.address].filter(Boolean).join(", ")
      : "",
    // A set after midnight is on the next calendar day, so its own time wins.
    date: formatContractDate(startsAt ?? gig.gigStartTime),
    setTime: startsAt ? formatCueTime(startsAt) : "",
    setLength: minutes > 0 ? `${minutes} minutes` : "",
    arriveBy: startsAt
      ? formatCueTime(
          new Date(startsAt.getTime() - ARRIVAL_LEAD_MINUTES * 60_000),
        )
      : "",
    atmosContact,
  };
}

export function hireDetails(rental: RentalForContract): HireDetails {
  const price = (dollars: number) => formatNZD(Math.round(dollars * 100));
  // A rental is either hand-picked items or a package, never both: the same
  // rule as `getRentalLineItems` in the rentals router.
  const lines =
    rental.rentalItems.length > 0
      ? rental.rentalItems
      : (rental.gearPackage?.items ?? []);

  return {
    name: rental.userName,
    email: rental.contactInfo,
    collection: formatContractDate(rental.startDate),
    return: formatContractDate(rental.endDate),
    hireFee: price(rental.estimatedTotalPrice),
    dailyRate: price(rental.discountedDailyPrice),
    items: lines.map((line) => ({
      name: line.gearItem.name,
      quantity: String(line.quantity),
    })),
  };
}
