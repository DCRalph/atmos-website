import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import type { db as Db } from "~/server/db";
import { scheduleEventPassUpdates } from "~/server/wallet/apple-push";

const VENUE_FIELDS = z.object({
  name: z.string().trim().min(1, "Give the venue a name"),
  address: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value === "" ? null : (value ?? null))),
  logoFileId: z.string().min(1).nullish(),
});

/**
 * A venue as a ticket event's columns: the link, plus the name and address
 * copied for passes, emails and the door, which read the columns directly.
 */
export async function venueColumns(
  db: Pick<typeof Db, "venue">,
  venueId: string,
) {
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { name: true, address: true },
  });
  if (!venue) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That venue no longer exists",
    });
  }
  return { venueId, venueName: venue.name, venueAddress: venue.address };
}

export const venuesRouter = createTRPCRouter({
  /** Every venue, by name. There are few enough to filter in the browser. */
  list: adminProcedure.query(({ ctx }) =>
    ctx.db.venue.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        logoFileId: true,
        _count: { select: { gigs: true, ticketEvents: true } },
      },
    }),
  ),

  create: adminProcedure
    .input(VENUE_FIELDS)
    .mutation(({ ctx, input }) => ctx.db.venue.create({ data: input })),

  /**
   * Also rewrites the name and address copied onto its ticket events, and
   * refreshes the wallet passes of any event whose copy changed.
   */
  update: adminProcedure
    .input(VENUE_FIELDS.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const events = await ctx.db.ticketEvent.findMany({
        where: { venueId: id },
        select: { id: true, venueName: true, venueAddress: true },
      });
      const stale = events.filter(
        (event) =>
          event.venueName !== data.name || event.venueAddress !== data.address,
      );
      const [venue] = await ctx.db.$transaction([
        ctx.db.venue.update({ where: { id }, data }),
        ctx.db.ticketEvent.updateMany({
          where: { venueId: id },
          data: { venueName: data.name, venueAddress: data.address },
        }),
      ]);
      for (const event of stale) scheduleEventPassUpdates(event.id);
      return venue;
    }),

  /**
   * Gigs and events lose the link, not their text: an event keeps the name
   * and address it was copied, and a gig keeps its subtitle.
   */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.venue.delete({ where: { id: input.id } }),
    ),
});
