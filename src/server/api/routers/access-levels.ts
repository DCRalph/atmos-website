import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  eventOrganiserProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { HEX_COLOUR_PATTERN } from "~/lib/ticketing/pass-theme";
import { DEFAULT_ACCESS_LEVEL } from "~/lib/ticketing/access-levels";
import { scheduleLevelPassUpdates } from "~/server/wallet/apple-push";

/**
 * Access levels, as data.
 *
 * These used to be a Prisma enum. They are a table now so a promoter can call
 * a level whatever their venue calls it — "Backstage", "Photo pit" — without a
 * deploy. `code` is what lands on a ticket and never changes once issued;
 * everything else is presentation and is free to.
 */

/** Codes are stored on tickets forever, so they are deliberately narrow. */
const CODE = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(24)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Letters, numbers and underscores; start with a letter");

const HEX = z
  .string()
  .trim()
  .regex(HEX_COLOUR_PATTERN, "Use a hex colour like #7DD3FC");

const levelInput = z.object({
  label: z.string().trim().min(1, "Give the level a name").max(40),
  short: z.string().trim().min(1).max(10),
  badgeBg: HEX,
  badgeFg: HEX,
  passAccent: HEX.nullable().optional(),
  rank: z.number().int().min(0).max(999),
});

/**
 * General admission is what every tier and ticket defaults to, in the schema
 * and in the editors, so it can be renamed and recoloured but never retired.
 */
function assertNotDefault(code: string): void {
  if (code === DEFAULT_ACCESS_LEVEL) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${code} is the default level for new tiers and tickets, so it has to stay.`,
    });
  }
}

export const accessLevelsRouter = createTRPCRouter({
  /**
   * Every level, lowest access first.
   *
   * Public because the door, the ticket page and the app all render a badge
   * from it, and none of that is privileged — it is the same information
   * already printed on the ticket in someone's hand.
   */
  list: publicProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.accessLevel.findMany({
        where: input?.includeArchived ? {} : { archived: false },
        orderBy: [{ rank: "asc" }, { code: "asc" }],
      });
    }),

  create: eventOrganiserProcedure
    .input(levelInput.extend({ code: CODE }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.accessLevel.findUnique({
        where: { code: input.code },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${input.code} already exists.`,
        });
      }
      const created = await ctx.db.accessLevel.create({
        data: { ...input, passAccent: input.passAccent ?? null },
      });
      return created;
    }),

  /**
   * Everything but the code, which tickets point at. Wallet passes on the
   * level are pushed so the new label and colours reach them.
   */
  update: eventOrganiserProcedure
    .input(levelInput.partial().extend({ code: CODE }))
    .mutation(async ({ ctx, input }) => {
      const { code, ...rest } = input;
      const updated = await ctx.db.accessLevel.update({
        where: { code },
        data: rest,
      });
      scheduleLevelPassUpdates([code]);
      return updated;
    }),

  /**
   * Retire a level without breaking the tickets issued against it.
   *
   * Deleting is only offered when nothing references it; otherwise this is the
   * operation, and the level keeps resolving for historical passes and door
   * screens while disappearing from every picker.
   */
  setArchived: eventOrganiserProcedure
    .input(z.object({ code: CODE, archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertNotDefault(input.code);
      return ctx.db.accessLevel.update({
        where: { code: input.code },
        data: { archived: input.archived },
      });
    }),

  remove: eventOrganiserProcedure
    .input(z.object({ code: CODE }))
    .mutation(async ({ ctx, input }) => {
      assertNotDefault(input.code);
      const [tickets, tiers, lifetimes] = await Promise.all([
        ctx.db.ticket.count({ where: { accessLevel: input.code } }),
        ctx.db.ticketTier.count({ where: { accessLevel: input.code } }),
        ctx.db.lifetimeTicket.count({ where: { accessLevel: input.code } }),
      ]);
      if (tickets > 0 || tiers > 0 || lifetimes > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${tickets} tickets, ${tiers} tiers and ${lifetimes} lifetime passes use ${input.code}. Archive it instead — deleting would leave them pointing at nothing.`,
        });
      }
      await ctx.db.accessLevel.delete({ where: { code: input.code } });
      return { code: input.code };
    }),

  /**
   * Drag-to-reorder writes the whole list back in one go. Rank decides how far
   * a pass's accent floods, so every level's passes are pushed.
   */
  reorder: eventOrganiserProcedure
    .input(z.object({ codes: z.array(CODE).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.codes.map((code, index) =>
          ctx.db.accessLevel.update({ where: { code }, data: { rank: index } }),
        ),
      );
      scheduleLevelPassUpdates(input.codes);
      return { count: input.codes.length };
    }),
});
