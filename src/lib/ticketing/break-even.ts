import { calcBookingFeeCents, type BookingFeeConfig } from "./money";

/**
 * Costs, profit and break even for an event. Shared by the Costs page, which
 * works from the draft before anything sells, and the Overview, which works
 * from what has. GST inclusive throughout, like the rest of the dashboards.
 *
 * Client-safe: pure arithmetic, no server imports.
 */

/**
 * What one ticket brings in on average if the tiers sell as planned: its
 * share of the price, plus the booking and venue fees it carries. Weighted by
 * allocation, so a big GA tier counts for more than a small early bird. Null
 * when the plan has no tickets to average over.
 */
export function planRevenuePerTicketCents({
  tiers,
  fee,
  venueFeePerTicket,
}: {
  tiers: { priceCents: number; allocation: number; groupSize: number }[];
  fee: BookingFeeConfig;
  venueFeePerTicket: number;
}): number | null {
  let tickets = 0;
  let cents = 0;
  for (const tier of tiers) {
    if (tier.allocation <= 0) continue;
    tickets += tier.allocation;
    cents += tier.allocation * ticketCents(tier, fee, venueFeePerTicket);
  }
  return tickets > 0 ? Math.round(cents / tickets) : null;
}

/**
 * What the tickets still on sale would bring in, each at its own tier's price
 * and fees. Tiers are taken in order and stop at `maxTickets`, the room left
 * once comps are kept back, so a plan bigger than the room loses its last
 * tiers first. Pricing what's left by its own tier matters: the cheap early
 * tiers sell first, so the average so far undersells the rest.
 */
export function unsoldRevenueCents({
  tiers,
  fee,
  venueFeePerTicket,
  maxTickets,
}: {
  tiers: {
    priceCents: number;
    allocation: number;
    groupSize: number;
    soldCount: number;
  }[];
  fee: BookingFeeConfig;
  venueFeePerTicket: number;
  maxTickets: number;
}): number {
  let room = Math.max(0, maxTickets);
  let cents = 0;
  for (const tier of tiers) {
    const tickets = Math.min(
      room,
      Math.max(0, tier.allocation - tier.soldCount),
    );
    room -= tickets;
    cents += tickets * ticketCents(tier, fee, venueFeePerTicket);
  }
  return Math.round(cents);
}

/**
 * One ticket's share of a purchase. A purchase of a group tier is `groupSize`
 * tickets at one price, and the fees are worked out on the purchase, exactly
 * as checkout does.
 */
function ticketCents(
  tier: { priceCents: number; groupSize: number },
  fee: BookingFeeConfig,
  venueFeePerTicket: number,
): number {
  if (tier.priceCents <= 0) return 0;
  const purchase =
    tier.priceCents +
    calcBookingFeeCents(tier.priceCents, tier.groupSize, fee) +
    venueFeePerTicket * tier.groupSize;
  return purchase / tier.groupSize;
}

/**
 * Tickets that have to sell for revenue to cover costs. Null when a ticket
 * brings in nothing, so no number of them ever would.
 */
export function breakEvenTickets(
  costsCents: number,
  revenuePerTicketCents: number | null,
): number | null {
  if (costsCents <= 0) return 0;
  if (!revenuePerTicketCents || revenuePerTicketCents <= 0) return null;
  return Math.ceil(costsCents / revenuePerTicketCents);
}
