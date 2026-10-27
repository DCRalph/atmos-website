import type { PaymentMethodKind, TicketScanResult } from "~Prisma/client";

/**
 * The pieces of the post-event summary that are logic rather than SQL: which
 * channel a ticket went out through, how many were inside at each moment of
 * the night, and how far ahead people bought.
 *
 * Client-safe: the Prisma import is types only.
 */

/** Every way a ticket can leave the building's books, in the order shown. */
export const TICKET_CHANNELS = [
  "ONLINE",
  "FREE",
  "DOOR_TAP",
  "DOOR_EFTPOS",
  "DOOR_CASH",
  "OFF_PLATFORM_EFTPOS",
  "OFF_PLATFORM_CASH",
  "LINK",
  "COMP",
  "LIFETIME",
] as const;
export type TicketChannel = (typeof TICKET_CHANNELS)[number];

export type ChannelGroup = "online" | "door" | "given";

export const CHANNELS: Record<
  TicketChannel,
  { label: string; group: ChannelGroup }
> = {
  ONLINE: { label: "Online", group: "online" },
  FREE: { label: "Free online", group: "online" },
  DOOR_TAP: { label: "Tap to pay", group: "door" },
  DOOR_EFTPOS: { label: "Eftpos", group: "door" },
  DOOR_CASH: { label: "Cash", group: "door" },
  OFF_PLATFORM_EFTPOS: { label: "Eftpos, off-platform", group: "door" },
  OFF_PLATFORM_CASH: { label: "Cash, off-platform", group: "door" },
  LINK: { label: "Ticket links", group: "given" },
  COMP: { label: "Comps and guest list", group: "given" },
  LIFETIME: { label: "Lifetime passes", group: "given" },
};

export const CHANNEL_GROUPS: Record<ChannelGroup, string> = {
  online: "Sold online",
  door: "Sold at the door",
  given: "Given away",
};

/**
 * Which channel a ticket went out through. Comps, ticket links and lifetime
 * passes come first because staff issue those too, so `atDoor` (an order
 * with a `soldByUserId`) alone would file them as door sales.
 */
export function ticketChannel({
  paymentMethod,
  atDoor,
  isComp,
}: {
  paymentMethod: PaymentMethodKind;
  atDoor: boolean;
  isComp: boolean;
}): TicketChannel {
  if (isComp || paymentMethod === "COMP") return "COMP";
  if (paymentMethod === "ADMIN") return "LINK";
  if (paymentMethod === "LIFETIME") return "LIFETIME";
  if (atDoor) {
    if (paymentMethod === "TAP_TO_PAY") return "DOOR_TAP";
    if (paymentMethod === "TERMINAL") return "DOOR_EFTPOS";
    return "DOOR_CASH";
  }
  return paymentMethod === "FREE" ? "FREE" : "ONLINE";
}

const ADMITS = new Set<TicketScanResult>([
  "ADMITTED",
  "OVERRIDE_ADMITTED",
  "REENTRY",
]);
const EXITS = new Set<TicketScanResult>(["DEPARTED", "ADMISSION_REVERTED"]);

export type HeadcountScan = {
  ticketId: string;
  result: TicketScanResult;
  at: Date;
};

/**
 * How many were inside after each scan that changed it, and the busiest
 * moment. Scans must be oldest first. Without departures scanned this only
 * ever climbs, so the peak is simply everyone who came.
 */
export function headcountTimeline(scans: readonly HeadcountScan[]) {
  const inside = new Set<string>();
  const points: { x: Date; y: number }[] = [];
  let peak: { count: number; at: Date } | null = null;

  for (const scan of scans) {
    if (ADMITS.has(scan.result) && !inside.has(scan.ticketId)) {
      inside.add(scan.ticketId);
    } else if (EXITS.has(scan.result) && inside.has(scan.ticketId)) {
      inside.delete(scan.ticketId);
    } else {
      continue;
    }
    points.push({ x: scan.at, y: inside.size });
    if (!peak || inside.size > peak.count) {
      peak = { count: inside.size, at: scan.at };
    }
  }

  return { points, peak };
}

/** How far ahead of doors a ticket was bought, nearest first. */
export const LEAD_TIMES = [
  { key: "night", label: "After doors opened" },
  { key: "day", label: "Last 24 hours" },
  { key: "week", label: "1 to 7 days out" },
  { key: "month", label: "1 to 4 weeks out" },
  { key: "early", label: "Over 4 weeks out" },
] as const;
export type LeadTime = (typeof LEAD_TIMES)[number]["key"];

/** The lead time for a sale made `hoursBefore` doors (negative is after). */
export function leadTime(hoursBefore: number): LeadTime {
  if (hoursBefore < 0) return "night";
  if (hoursBefore < 24) return "day";
  if (hoursBefore < 24 * 7) return "week";
  if (hoursBefore < 24 * 28) return "month";
  return "early";
}
