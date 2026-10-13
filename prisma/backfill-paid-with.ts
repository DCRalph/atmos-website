import { db } from "~/server/db";
import { getStripe, paidWithFromCharge } from "~/server/stripe";

/**
 * Fill in how past Stripe payments were made (Apple Pay, Google Pay, card),
 * for orders and donations paid before `paidWith` was recorded.
 *
 *   bun run db:backfill-paid-with            # report only, writes nothing
 *   bun run db:backfill-paid-with --apply    # actually fill them in
 *
 * Reads each charge back from Stripe, so it needs the live key to fill live
 * payments. Safe to re-run: only rows still missing `paidWith` are looked at.
 */

async function chargeFor(row: {
  stripeChargeId: string | null;
  stripePaymentIntentId: string;
}) {
  const stripe = getStripe();
  if (row.stripeChargeId) return stripe.charges.retrieve(row.stripeChargeId);
  const intent = await stripe.paymentIntents.retrieve(
    row.stripePaymentIntentId,
    { expand: ["latest_charge"] },
  );
  return typeof intent.latest_charge === "object" ? intent.latest_charge : null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const [orders, donations] = await Promise.all([
    db.ticketOrder.findMany({
      where: {
        paidWith: null,
        paidAt: { not: null },
        stripePaymentIntentId: { not: null },
      },
      select: { id: true, stripeChargeId: true, stripePaymentIntentId: true },
    }),
    db.donation.findMany({
      where: { paidWith: null },
      select: { id: true, stripeChargeId: true, stripePaymentIntentId: true },
    }),
  ]);
  console.log(
    `${orders.length} orders and ${donations.length} donations to look up.`,
  );

  const tally = new Map<string, number>();
  const failed: string[] = [];

  const rows = [
    ...orders.map((row) => ({ ...row, kind: "order" as const })),
    ...donations.map((row) => ({ ...row, kind: "donation" as const })),
  ];
  for (const row of rows) {
    if (!row.stripePaymentIntentId) continue;
    try {
      const charge = await chargeFor({
        stripeChargeId: row.stripeChargeId,
        stripePaymentIntentId: row.stripePaymentIntentId,
      });
      const paidWith = paidWithFromCharge(charge);
      tally.set(
        paidWith ?? "unknown",
        (tally.get(paidWith ?? "unknown") ?? 0) + 1,
      );
      if (!apply || !paidWith) continue;

      const data = { paidWith, stripeChargeId: charge?.id ?? null };
      if (row.kind === "order") {
        await db.ticketOrder.update({ where: { id: row.id }, data });
      } else {
        await db.donation.update({ where: { id: row.id }, data });
      }
    } catch (cause) {
      failed.push(`${row.kind} ${row.id}: ${String(cause)}`);
    }
  }

  console.table(Object.fromEntries(tally));
  if (failed.length > 0) console.warn(`Failed:\n${failed.join("\n")}`);
  console.log(apply ? "Done." : "Report only. Re-run with --apply to write.");
}

main()
  .catch((cause) => {
    console.error(cause);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
