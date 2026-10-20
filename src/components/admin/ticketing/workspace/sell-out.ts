import {
  breakEvenTickets,
  planRevenuePerTicketCents,
  sellOutBreakdown,
} from "~/lib/ticketing/break-even";
import {
  parsePriceToCents,
  venueFeePerTicketCents,
  ZERO_BOOKING_FEE,
} from "~/lib/ticketing/money";
import { parseCount, type AdminEvent, type EventDraft } from "./draft";

/**
 * Costs, break even and the sell-out, worked out from the draft as it is
 * typed. Shared by the Costs and Tiers sections so they always agree. The
 * plan is priced as if nothing had sold yet. Campaign spend is saved on its
 * own tab and only added in.
 */
export function sellOutPlan(draft: EventDraft, event: AdminEvent | undefined) {
  const hireCents = parsePriceToCents(draft.venueHire) ?? 0;
  const capacity = parseCount(draft.capacity);
  const venueFee = venueFeePerTicketCents({
    venueHireCents: hireCents,
    passVenueHire: draft.passVenueHire,
    capacity,
  });
  const otherCents = draft.costs.reduce(
    (sum, cost) => sum + (parsePriceToCents(cost.amount) ?? 0),
    0,
  );
  const campaignCents =
    event?.campaigns.reduce((sum, campaign) => sum + campaign.spendCents, 0) ??
    0;
  const costsCents = hireCents + otherCents + campaignCents;

  // The booking fee as the draft would charge it: its own override, or the
  // site default when both fields are blank.
  const siteFee = event?.siteDefaults.bookingFee;
  const fee =
    draft.feeFixed.trim() || draft.feePercent.trim()
      ? {
          fixedCents: parsePriceToCents(draft.feeFixed) ?? 0,
          percentBp: Math.round((Number(draft.feePercent) || 0) * 100),
        }
      : (siteFee ?? ZERO_BOOKING_FEE);

  const tiers = draft.tiers
    .filter((tier) => tier.isActive)
    .map((tier) => ({
      key: tier.key,
      name: tier.name,
      priceCents: parsePriceToCents(tier.price) ?? 0,
      allocation: Number(tier.allocation) || 0,
      groupSize: Number(tier.groupSize) || 1,
      soldCount: 0,
    }));
  const perTicket = planRevenuePerTicketCents({
    tiers,
    fee,
    venueFeePerTicket: venueFee,
  });

  // A sell-out is every tier gone, but never past the room less its comps.
  const planned = tiers.reduce((sum, tier) => sum + tier.allocation, 0);
  const sellable =
    capacity === null
      ? planned
      : Math.min(
          planned,
          Math.max(0, capacity - (parseCount(draft.compAllowance) ?? 0)),
        );
  const breakdown = sellOutBreakdown({
    tiers,
    fee,
    venueFeePerTicket: venueFee,
    maxTickets: sellable,
  });

  return {
    capacity,
    siteFee,
    venueFee,
    hireCents,
    otherCents,
    campaignCents,
    costsCents,
    perTicket,
    breakEven: breakEvenTickets(costsCents, perTicket),
    sellable,
    /** Totals, and each active tier with what it sells and brings in. */
    revenue: breakdown,
  };
}
