import { db } from "~/server/db";
import { syncGigSlug } from "~/server/gig-slug";
import { GigStatus } from "~Prisma/client";

/**
 * Gives every gig without one its stored slug.
 *
 *   bun --conditions=react-server prisma/backfill-gig-slugs.ts          # dry run
 *   bun --conditions=react-server prisma/backfill-gig-slugs.ts --apply
 *
 * Before slugs were stored, a pretty URL resolved to the newest published gig
 * with that title. Published gigs go first, newest first, so each URL in the
 * wild keeps landing where it does now, and an older gig of the same name is
 * the one that becomes `-2`. The dry run does the same work in a transaction
 * and rolls it back.
 */
const apply = process.argv.includes("--apply");

class DryRun extends Error {}

const gigs = await db.gig.findMany({
  where: { slug: null },
  select: { id: true, status: true },
  orderBy: { gigStartTime: "desc" },
});
const ordered = [
  ...gigs.filter((gig) => gig.status === GigStatus.PUBLISHED),
  ...gigs.filter((gig) => gig.status !== GigStatus.PUBLISHED),
];

try {
  await db.$transaction(
    async (tx) => {
      for (const { id } of ordered) await syncGigSlug(tx, id);
      const rows = await tx.gig.findMany({
        where: { id: { in: ordered.map((gig) => gig.id) } },
        select: { title: true, slug: true, status: true, isTba: true },
        orderBy: { gigStartTime: "desc" },
      });
      for (const row of rows) {
        const slug = row.slug ?? (row.isTba ? "(TBA, none)" : "(none)");
        console.log(`${row.status.padEnd(9)} ${slug.padEnd(60)} ${row.title}`);
      }
      if (!apply) throw new DryRun();
    },
    { timeout: 120_000 },
  );
  console.log(`\nGave ${ordered.length} gigs a slug.`);
} catch (error) {
  if (!(error instanceof DryRun)) throw error;
  console.log(
    `\nDry run: ${ordered.length} gigs. Nothing written; pass --apply.`,
  );
}

await db.$disconnect();
