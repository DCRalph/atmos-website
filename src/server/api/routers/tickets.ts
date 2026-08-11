import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { TicketOrderStatus, TicketStatus } from "~Prisma/client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { buildTicketToken } from "~/server/ticketing/qr";
import { renderQrSvg } from "~/server/ticketing/qr-image";
import {
  findOrderByAccessToken,
  syncMarketingConsent,
} from "~/server/ticketing/orders";
import { sendTicketEmail } from "~/server/ticketing/email/send";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";
import { getTicketingSettings } from "~/server/ticketing/settings";
import {
  applePassUrl,
  googleWalletSaveUrl,
} from "~/server/ticketing/urls";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";
import { isGoogleWalletConfigured } from "~/server/wallet/google-config";

/**
 * The buyer's view of their own order, authenticated purely by the signed
 * token in the URL. No session required — the person who bought the tickets is
 * a guest by design.
 */

export const ticketsRouter = createTRPCRouter({
  byAccessToken: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .query(async ({ input }) => {
      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) return null;

      const settings = await getTicketingSettings();
      const issued = order.status === TicketOrderStatus.PAID;

      const tickets = await Promise.all(
        order.tickets
          .filter((ticket) => ticket.status === TicketStatus.VALID)
          .map(async (ticket) => ({
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            tierName: ticket.tier.name,
            attendeeName: ticket.attendeeName,
            qrSvg: await renderQrSvg(buildTicketToken(ticket)),
            appleWalletUrl: isAppleWalletConfigured()
              ? applePassUrl(ticket.id, input.accessToken)
              : null,
            googleWalletUrl: isGoogleWalletConfigured()
              ? googleWalletSaveUrl(ticket.id, input.accessToken)
              : null,
          })),
      );

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        issued,
        buyerEmail: order.buyerEmail,
        buyerName: order.buyerName,
        marketingOptIn: order.marketingOptIn,
        detailsCompletedAt: order.detailsCompletedAt,
        expiresAt: order.expiresAt,
        totals: {
          subtotalCents: order.subtotalCents,
          discountCents: order.discountCents,
          bookingFeeCents: order.bookingFeeCents,
          totalCents: order.totalCents,
          gstCents: order.gstCents,
          refundedCents: order.refundedCents,
        },
        gstNumber: order.event.gstNumber ?? settings.gstNumber,
        legalName: settings.legalName,
        supportEmail: settings.supportEmail,
        event: {
          id: order.event.id,
          slug: order.event.slug,
          name: order.event.name,
          startsAt: order.event.startsAt,
          doorsAt: order.event.doorsAt,
          endsAt: order.event.endsAt,
          timezone: order.event.timezone,
          venueName: order.event.venueName,
          venueAddress: order.event.venueAddress,
          isR18: order.event.isR18,
          status: order.event.status,
          requireAttendeeNames: order.event.requireAttendeeNames,
          posterFileUploadId:
            order.event.posterFileUploadId ??
            order.event.gig?.posterFileUploadId ??
            null,
        },
        tickets,
      };
    }),

  /**
   * The details step, on its own page once the tickets exist.
   *
   * This is the first and only time the buyer is asked who they are — nothing
   * personal is collected before a ticket has been issued. For a free order it
   * is also where the email arrives, so this is what actually triggers
   * delivery; for a card order Stripe already handed us one and this either
   * confirms it or corrects it.
   */
  saveDetails: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        buyerName: z.string().trim().min(1).max(120),
        buyerEmail: z.email(),
        marketingOptIn: z.boolean().default(false),
        names: z
          .array(
            z.object({
              ticketId: z.string(),
              attendeeName: z.string().trim().max(120),
            }),
          )
          .max(50)
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      await enforceRateLimit({
        key: `details:${ip}`,
        limit: 20,
        windowSeconds: 900,
        message: "Too many changes. Give it a few minutes.",
      });

      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.status !== TicketOrderStatus.PAID) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There are no tickets on this order yet.",
        });
      }

      const ownTicketIds = new Set(order.tickets.map((ticket) => ticket.id));
      for (const entry of input.names) {
        if (!ownTicketIds.has(entry.ticketId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "That ticket isn't part of this order.",
          });
        }
      }

      const email = input.buyerEmail.toLowerCase().trim();
      const emailChanged = (order.buyerEmail ?? "") !== email;

      await ctx.db.$transaction([
        ...input.names.map((entry) =>
          ctx.db.ticket.update({
            where: { id: entry.ticketId },
            data: { attendeeName: entry.attendeeName || null },
          }),
        ),
        ctx.db.ticketOrder.update({
          where: { id: order.id },
          data: {
            buyerName: input.buyerName,
            buyerEmail: email,
            marketingOptIn: input.marketingOptIn,
            detailsCompletedAt: new Date(),
          },
        }),
      ]);

      await syncMarketingConsent(order.id);

      // A free order has never been emailed — there was nowhere to send it.
      // A card order has, unless the buyer has just corrected the address.
      const delivered = await ctx.db.ticketEmailLog.count({
        where: { orderId: order.id, status: "sent" },
      });
      const shouldSend = emailChanged || delivered === 0;

      const result = shouldSend
        ? await sendTicketEmail({ orderId: order.id })
        : { ok: true as const };

      return { ok: true as const, emailedTo: result.ok ? email : null };
    }),

  /**
   * The "who's coming?" step, still reachable from the tickets page itself for
   * anyone editing names later.
   */
  setAttendeeNames: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        names: z
          .array(
            z.object({
              ticketId: z.string(),
              attendeeName: z.string().trim().max(120),
            }),
          )
          .max(50),
        buyerName: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const ownTicketIds = new Set(order.tickets.map((ticket) => ticket.id));
      for (const entry of input.names) {
        if (!ownTicketIds.has(entry.ticketId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "That ticket isn't part of this order.",
          });
        }
      }

      await ctx.db.$transaction([
        ...input.names.map((entry) =>
          ctx.db.ticket.update({
            where: { id: entry.ticketId },
            data: { attendeeName: entry.attendeeName || null },
          }),
        ),
        ctx.db.ticketOrder.update({
          where: { id: order.id },
          data: {
            detailsCompletedAt: new Date(),
            ...(input.buyerName ? { buyerName: input.buyerName } : {}),
          },
        }),
      ]);

      return { ok: true as const };
    }),

  /** Re-send the ticket email to the address that bought them. */
  resend: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ip =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      await enforceRateLimit({
        key: `resend:${ip}`,
        limit: 5,
        windowSeconds: 900,
        message: "We've sent that a few times already — check your spam folder.",
      });

      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.status !== TicketOrderStatus.PAID) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There are no tickets on this order yet.",
        });
      }

      const result = await sendTicketEmail({
        orderId: order.id,
        type: "RESEND",
      });
      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We couldn't send that email. Try again shortly.",
        });
      }

      return { ok: true as const, sentTo: order.buyerEmail };
    }),
});
