import { db } from "~/server/db";
import { pushPassUpdate, type PushResult } from "~/server/wallet/apple-push";

/**
 * Wake every phone holding an Apple Wallet pass so it re-downloads it. Run
 * after deploying a bump to `PASS_TEMPLATE_UPDATED_AT`; without the bump the
 * phones ask, are told nothing changed, and keep the old pass.
 *
 *   bun run wallet:push-all
 *
 * Needs the Apple pass certificates in `.env`. Runs as production so pushes go
 * to the live APNs host, which is where real wallets listen.
 */

async function main(): Promise<void> {
  const registrations = await db.walletPassRegistration.findMany({
    distinct: ["serialNumber"],
    select: { serialNumber: true },
  });
  console.log(`${registrations.length} registered passes to push.`);

  const totals: PushResult = { sent: 0, failed: 0, pruned: 0 };
  for (const { serialNumber } of registrations) {
    const result = await pushPassUpdate(serialNumber);
    totals.sent += result.sent;
    totals.failed += result.failed;
    totals.pruned += result.pruned;
  }
  console.log(totals);
}

main()
  .catch((cause: unknown) => {
    console.error(cause);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
