import "server-only";

import { db } from "~/server/db";

/**
 * Announces every TBA gig whose `announceAt` has come: it stops being TBA and
 * goes on the site with everything it was withholding.
 *
 * Run by the minute ticker at `/api/cron/run-sheet`, so a gig goes out within a
 * minute of its time. `announceAt` is cleared with it, so turning TBA back on
 * later does not announce the gig again on the next tick.
 */
export async function announceDueGigs(now = new Date()): Promise<number> {
  const { count } = await db.gig.updateMany({
    where: { isTba: true, announceAt: { lte: now } },
    data: { isTba: false, announceAt: null },
  });
  return count;
}
