import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { salesAlertEligible } from "~/server/ticketing/sales-alerts";
import { userHasPermission } from "~/server/utils/permissions";

/**
 * Per-event sales alerts, for the event page's Alerts tab.
 *
 * An admin switches their own alerts; a superadmin can switch anybody's who is
 * eligible for the event (every admin, plus the event's managers). Switches
 * save straight away rather than through the event draft, since they change
 * who gets woken up, not what the event is.
 */
export const salesAlertsRouter = createTRPCRouter({
  /** Who can get this event's alerts, and what each of them has on. */
  forEvent: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const superadmin = userHasPermission(ctx.user, "SUPERADMIN");
      const users = await ctx.db.user.findMany({
        where: superadmin
          ? await salesAlertEligible(input.eventId)
          : { id: ctx.user.id },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          permissions: { select: { permission: true } },
          ticketSalesAlerts: {
            where: { eventId: input.eventId },
            select: { orders: true, soldOut: true },
          },
          _count: { select: { deviceTokens: true } },
        },
      });

      return users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        devices: user._count.deviceTokens,
        isYou: user.id === ctx.user.id,
        isManager: !userHasPermission(user, "ADMIN"),
        orders: user.ticketSalesAlerts[0]?.orders ?? false,
        soldOut: user.ticketSalesAlerts[0]?.soldOut ?? false,
      }));
    }),

  /**
   * Switch one alert for one person on one event. Turning one on needs a
   * handset to send it to; turning one off never does, so a lost phone can
   * still be silenced.
   */
  set: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        userId: z.string(),
        kind: z.enum(["orders", "soldOut"]),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        input.userId !== ctx.user.id &&
        !userHasPermission(ctx.user, "SUPERADMIN")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only superadmins can change somebody else's alerts.",
        });
      }

      const target = await ctx.db.user.findFirst({
        where: {
          id: input.userId,
          ...(await salesAlertEligible(input.eventId)),
        },
        select: { _count: { select: { deviceTokens: true } } },
      });
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sales alerts are for admins and this event's managers.",
        });
      }
      if (input.enabled && target._count.deviceTokens === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Install the app and allow notifications first.",
        });
      }

      await ctx.db.ticketEventSalesAlert.upsert({
        where: {
          eventId_userId: { eventId: input.eventId, userId: input.userId },
        },
        create: {
          eventId: input.eventId,
          userId: input.userId,
          [input.kind]: input.enabled,
        },
        update: { [input.kind]: input.enabled },
      });
      return { ok: true as const };
    }),
});
