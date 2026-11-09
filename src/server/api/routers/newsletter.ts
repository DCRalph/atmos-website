import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  loadPreferences,
  setPreference,
  unsubscribeEverything,
} from "~/server/mailouts/preferences";
import { NEWSLETTER, subscribe } from "~/server/mailouts/subscribers";

/**
 * The public side of mailing lists: the signup form, and the preferences page
 * an unsubscribe link opens. The admin side is `mailouts`, `mailingLists` and
 * `subscribers`.
 */

const token = z.string().min(10).max(200);

export const newsletterRouter = createTRPCRouter({
  /** The signup form. Joins the newsletter, or the public list it names. */
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.email(),
        list: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.list ?? NEWSLETTER;
      if (slug !== NEWSLETTER) {
        const list = await ctx.db.mailingList.findUnique({
          where: { slug },
          select: { public: true, archivedAt: true },
        });
        if (!list?.public || list.archivedAt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No such list." });
        }
      }
      const result = await subscribe(ctx.db, {
        email: input.email,
        list: slug,
        source: "newsletter-form",
      });
      return { created: result !== "already" };
    }),

  /** What an unsubscribe link's page shows. Null for a link that is not ours. */
  preferences: publicProcedure
    .input(z.object({ token }))
    .query(({ input }) => loadPreferences(input.token)),

  setPreference: publicProcedure
    .input(z.object({ token, listId: z.string(), subscribed: z.boolean() }))
    .mutation(async ({ input }) => {
      if (!(await setPreference(input.token, input.listId, input.subscribed))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ok: true };
    }),

  unsubscribeAll: publicProcedure
    .input(z.object({ token }))
    .mutation(async ({ input }) => {
      if (!(await unsubscribeEverything(input.token))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { ok: true };
    }),
});
