import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { claimGigSlug } from "~/server/gig-slug";
import { GigStatus } from "~Prisma/client";

/**
 * Gives every gig without one a slug made from its title, TBA gigs included.
 *
 *   bun --conditions=react-server prisma/backfill-gig-slugs.ts          # dry run
 *   bun --conditions=react-server prisma/backfill-gig-slugs.ts --apply
 *
 * Published gigs go first, newest first, so the gig people are most likely to
 * be linking to wins its title's slug. A gig whose slug is already taken is
 * skipped and listed; open it in the editor and pick one by hand. The dry run
 * does the same work in a transaction and rolls it back.
 */
const apply = process.argv.includes("--apply");

class DryRun extends Error {}

const gigs = await db.gig.findMany({
  where: { slug: null },
  select: { id: true, title: true, status: true },
  orderBy: { gigStartTime: "desc" },
});
const ordered = [
  ...gigs.filter((gig) => gig.status === GigStatus.PUBLISHED),
  ...gigs.filter((gig) => gig.status !== GigStatus.PUBLISHED),
];

let given = 0;
try {
  await db.$transaction(
    async (tx) => {
      for (const gig of ordered) {
        try {
          const slug = await claimGigSlug(tx, {
            gigId: gig.id,
            title: gig.title,
          });
          await tx.gig.update({ where: { id: gig.id }, data: { slug } });
          given++;
          console.log(
            `${gig.status.padEnd(9)} ${slug.padEnd(60)} ${gig.title}`,
          );
        } catch (error) {
          if (!(error instanceof TRPCError)) throw error;
          console.log(`SKIPPED   ${error.message.padEnd(60)} ${gig.id}`);
        }
      }
      if (!apply) throw new DryRun();
    },
    { timeout: 120_000 },
  );
  console.log(`\nGave ${given} of ${ordered.length} gigs a slug.`);
} catch (error) {
  if (!(error instanceof DryRun)) throw error;
  console.log(
    `\nDry run: ${given} of ${ordered.length} gigs. Nothing written; pass --apply.`,
  );
}

await db.$disconnect();
