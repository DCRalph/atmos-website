import { PaymentMethodKind } from "~Prisma/client";
import { db } from "~/server/db";
import { syncPaymentAttempts } from "~/server/ticketing/payment-attempts";

/**
 * Record the payment attempts, declines included, of every online order
 * taken before they were recorded.
 *
 *   bun run db:backfill-payment-attempts            # report only, writes nothing
 *   bun run db:backfill-payment-attempts --apply    # actually record them
 *
 * Reads each order's charges back from Stripe, so it needs the live key for
 * live orders. Safe to re-run: attempts are keyed by their charge.
 */

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const orders = await db.ticketOrder.findMany({
    where: {
      paymentMethod: PaymentMethodKind.STRIPE,
      stripePaymentIntentId: { not: null },
    },
    select: { id: true, stripePaymentIntentId: true },
  });
  console.log(`${orders.length} orders to look up.`);
  if (!apply) {
    console.log("Report only. Re-run with --apply to write.");
    return;
  }

  const failed: string[] = [];
  for (const order of orders) {
    if (!order.stripePaymentIntentId) continue;
    try {
      await syncPaymentAttempts(order.id, order.stripePaymentIntentId);
    } catch (cause) {
      failed.push(`${order.id}: ${String(cause)}`);
    }
  }

  const tally = await db.ticketPaymentAttempt.groupBy({
    by: ["status"],
    _count: true,
  });
  console.table(
    Object.fromEntries(tally.map((row) => [row.status, row._count])),
  );
  if (failed.length > 0) console.warn(`Failed:\n${failed.join("\n")}`);
  console.log("Done.");
}

main()
  .catch((cause) => {
    console.error(cause);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
