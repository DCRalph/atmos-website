import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  TicketEmailType,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { ticketTypeName } from "~/lib/ticketing/access-levels";
import { buildTicketToken } from "~/server/ticketing/qr";
import { renderQrSvg } from "~/server/ticketing/qr-image";
import {
  findOrderByAccessToken,
  findTicketByAccessToken,
  orderAccessToken,
  syncMarketingConsent,
  ticketAccessToken,
} from "~/server/ticketing/orders";
import { assignHandout, reassignHandout } from "~/server/ticketing/comps";
import {
  sendCompTicketEmail,
  sendTicketEmail,
} from "~/server/ticketing/email/send";
import { ticketUrl } from "~/server/ticketing/urls";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";
import { getTicketingSettings } from "~/server/ticketing/settings";
import { applePassUrl, googleWalletSaveUrl } from "~/server/ticketing/urls";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";
import { isGoogleWalletConfigured } from "~/server/wallet/google-config";

/**
 * The buyer's view of their own order, authenticated purely by the signed
 * token in the URL. No session required — the person who bought the tickets is
 * a guest by design.
 */

type NameEntry = { ticketId: string; attendeeName: string };

/**
 * Keep a rename to tickets on this order that are still open to being renamed.
 *
 * Two separate guards. Belonging to the order is the old one. The lock is the
 * new one, and it matters more: a comp recipient's ticket carries their name
 * from the moment it is issued, and a ticket somebody has already walked in on
 * is the record of who that was. Silently dropping locked entries rather than
 * failing the whole save is deliberate — the buyer editing four names should
 * not be stopped by the one that is settled.
 */
function assertNameable(
  tickets: readonly { id: string; nameLockedAt: Date | null }[],
  entries: readonly NameEntry[],
): NameEntry[] {
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  return entries.filter((entry) => {
    const ticket = byId.get(entry.ticketId);
    if (!ticket) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "That ticket isn't part of this order.",
      });
    }
    return ticket.nameLockedAt === null;
  });
}

/**
 * Resolve one of *your* hand-outs from your own ticket link.
 *
 * Every hand-out mutation goes through here, so the check that it belongs to
 * the host holding the token exists once rather than four times.
 */
async function ownHandout(ticketToken: string, handoutTicketId: string) {
  const host = await findTicketByAccessToken(ticketToken);
  if (!host) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
  }

  const handout = host.handouts.find(
    (candidate) => candidate.id === handoutTicketId,
  );
  if (!handout) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "That isn't one of your tickets to hand out.",
    });
  }

  return handout;
}

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
            tierName: ticketTypeName(ticket),
            attendeeName: ticket.attendeeName,
            // A locked name is somebody else's business now: the form renders
            // it read-only rather than letting the link holder rewrite it.
            nameLocked: ticket.nameLockedAt !== null,
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

      const names = assertNameable(order.tickets, input.names);

      const email = input.buyerEmail.toLowerCase().trim();
      const emailChanged = (order.buyerEmail ?? "") !== email;

      await ctx.db.$transaction([
        ...names.map((entry) =>
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
        /**
         * Only honoured while the order has no address of its own. A free
         * ticket can be issued without one, and the tickets page offers this
         * field so somebody looking at their QR code can still have it sent to
         * them. Changing an address that already exists is `saveDetails`.
         */
        buyerEmail: z.email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const names = assertNameable(order.tickets, input.names);

      const email =
        !order.buyerEmail && input.buyerEmail
          ? input.buyerEmail.toLowerCase().trim()
          : null;

      if (email) {
        const ip =
          ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        await enforceRateLimit({
          key: `details:${ip}`,
          limit: 20,
          windowSeconds: 900,
          message: "Too many changes. Give it a few minutes.",
        });
      }

      await ctx.db.$transaction([
        ...names.map((entry) =>
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
            ...(email ? { buyerEmail: email } : {}),
          },
        }),
      ]);

      // First address this order has had, so it has never been sent anything.
      const result = email
        ? await sendTicketEmail({ orderId: order.id })
        : { ok: false as const };

      return { ok: true as const, emailedTo: result.ok ? email : null };
    }),

  // ------------------------------------------------------- one ticket, mine

  /**
   * One person's own ticket.
   *
   * The comp counterpart to `byAccessToken`. It renders a single QR by
   * construction rather than by filtering — the token unlocks one ticket, so
   * there is no second code on the page to hand on instead of your own.
   *
   * When the ticket is a host, the tickets they have to hand out come with it,
   * but only as names and states. A hand-out's QR is never returned here: it
   * goes to the person it was sent to.
   */
  byTicketToken: publicProcedure
    .input(z.object({ ticketToken: z.string() }))
    .query(async ({ input }) => {
      const ticket = await findTicketByAccessToken(input.ticketToken);
      if (!ticket) return null;

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        typeName: ticketTypeName(ticket),
        accessLevel: ticket.accessLevel,
        attendeeName: ticket.attendeeName,
        nameLocked: ticket.nameLockedAt !== null,
        isComp: ticket.isComp,
        invitedByName: ticket.invitedByName,
        orderNumber: ticket.order.orderNumber,
        qrSvg: await renderQrSvg(buildTicketToken(ticket)),
        appleWalletUrl: isAppleWalletConfigured()
          ? applePassUrl(ticket.id, input.ticketToken)
          : null,
        googleWalletUrl: isGoogleWalletConfigured()
          ? googleWalletSaveUrl(ticket.id, input.ticketToken)
          : null,
        event: {
          id: ticket.event.id,
          slug: ticket.event.slug,
          name: ticket.event.name,
          startsAt: ticket.event.startsAt,
          doorsAt: ticket.event.doorsAt,
          endsAt: ticket.event.endsAt,
          timezone: ticket.event.timezone,
          venueName: ticket.event.venueName,
          venueAddress: ticket.event.venueAddress,
          isR18: ticket.event.isR18,
          status: ticket.event.status,
          posterFileUploadId:
            ticket.event.posterFileUploadId ??
            ticket.event.gig?.posterFileUploadId ??
            null,
        },
        handouts: ticket.handouts.map((handout) => ({
          id: handout.id,
          ticketNumber: handout.ticketNumber,
          typeName: ticketTypeName(handout),
          accessLevel: handout.accessLevel,
          guestName: handout.attendeeName,
          guestEmail: handout.attendeeEmail,
          sentAt: handout.sentAt,
          admittedAt: handout.scans[0]?.createdAt ?? null,
        })),
      };
    }),

  /**
   * Put one of your hand-outs in somebody's name and send it to them.
   *
   * The guest gets their own ticket at their own link, in their own name. The
   * level is whatever it was minted as and is not an input here — there is no
   * way to turn a general admission you were given into anything else.
   */
  sendHandout: publicProcedure
    .input(
      z.object({
        ticketToken: z.string(),
        handoutTicketId: z.string(),
        guestName: z.string().trim().min(1).max(120),
        guestEmail: z.email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      await enforceRateLimit({
        key: `handout:${ip}`,
        limit: 30,
        windowSeconds: 900,
        message: "Too many at once. Give it a few minutes.",
      });

      const handout = await ownHandout(
        input.ticketToken,
        input.handoutTicketId,
      );
      if (handout.nameLockedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "That one's already been sent. Take it back first if it needs to go to somebody else.",
        });
      }

      const assigned = await assignHandout({
        ticketId: handout.id,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
      });

      const sent = input.guestEmail
        ? await sendCompTicketEmail({
            ticketId: handout.id,
            type: TicketEmailType.HANDOUT,
          })
        : { ok: false as const };

      return {
        ok: true as const,
        emailedTo: sent.ok ? (input.guestEmail ?? null) : null,
        // Handed back so the "no email" path can copy a link instead.
        ticketUrl: assigned.ticketUrl,
      };
    }),

  /**
   * The link for a hand-out, for passing on by text rather than email.
   *
   * Still a real ticket at a fixed level, so nothing is gained by keeping it:
   * a general admission stays a general admission whoever opens it.
   */
  handoutLink: publicProcedure
    .input(
      z.object({
        ticketToken: z.string(),
        handoutTicketId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const handout = await ownHandout(
        input.ticketToken,
        input.handoutTicketId,
      );
      return { ticketUrl: ticketUrl(ticketAccessToken(handout)) };
    }),

  /** Re-send a hand-out to the address it went to. */
  resendHandout: publicProcedure
    .input(
      z.object({
        ticketToken: z.string(),
        handoutTicketId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      await enforceRateLimit({
        key: `resend:${ip}`,
        limit: 5,
        windowSeconds: 900,
        message: "We've sent that a few times already — check the spam folder.",
      });

      const handout = await ownHandout(
        input.ticketToken,
        input.handoutTicketId,
      );
      const result = await sendCompTicketEmail({
        ticketId: handout.id,
        type: TicketEmailType.RESEND,
      });
      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "We couldn't send that email.",
        });
      }

      return { ok: true as const, sentTo: handout.attendeeEmail };
    }),

  /**
   * Take a hand-out back so it can go to somebody else.
   *
   * Revokes the link already sent, and is refused once the ticket has been
   * scanned in — somebody is inside on it, and renaming it now would rewrite
   * who that was.
   */
  reassignHandout: publicProcedure
    .input(
      z.object({
        ticketToken: z.string(),
        handoutTicketId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const handout = await ownHandout(
        input.ticketToken,
        input.handoutTicketId,
      );
      await reassignHandout(handout.id);
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
        message:
          "We've sent that a few times already — check your spam folder.",
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

  /**
   * Every order this account can claim — the app's "My tickets".
   *
   * Two ways an order belongs to somebody. `userId` is set when they were
   * already signed in at checkout, which is rare. The common case is a guest
   * checkout under an email address they later signed up with, so a *verified*
   * address matches too.
   *
   * The verification requirement is the whole security model here: an
   * unverified address is just a string somebody typed, and matching on it
   * would hand a stranger's tickets to anybody willing to type their email.
   */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { email: true, emailVerified: true },
    });

    const claimableEmail =
      user?.emailVerified && user.email ? user.email.toLowerCase() : null;

    const orders = await ctx.db.ticketOrder.findMany({
      where: {
        status: TicketOrderStatus.PAID,
        OR: [
          { userId: ctx.session.user.id },
          ...(claimableEmail
            ? [{ buyerEmail: { equals: claimableEmail, mode: "insensitive" as const } }]
            : []),
        ],
      },
      orderBy: { event: { startsAt: "desc" } },
      select: {
        id: true,
        orderNumber: true,
        accessTokenVersion: true,
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            startsAt: true,
            doorsAt: true,
            timezone: true,
            venueName: true,
            isR18: true,
            status: true,
          },
        },
        tickets: {
          where: { status: TicketStatus.VALID },
          select: { id: true },
        },
      },
    });

    return orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      event: order.event,
      ticketCount: order.tickets.length,
      // The app needs this to open the order and to build wallet-pass URLs;
      // it is the same credential already sitting in the buyer's inbox.
      accessToken: orderAccessToken(order),
    }));
  }),

  /**
   * Attach an order to the signed-in account.
   *
   * For the cases `mine` cannot cover: bought on a different email, forwarded
   * by a friend, or an address they have not verified. Proof is the access
   * token they already hold — the same credential that opens the order on the
   * web — so this grants nothing they could not already reach.
   */
  claim: protectedProcedure
    .input(z.object({ accessToken: z.string().min(8).max(400) }))
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit({
        key: `ticket-claim:${ctx.session.user.id}`,
        limit: 20,
        windowSeconds: 60 * 10,
      });

      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That ticket link isn't valid. Check it and try again.",
        });
      }

      // Already somebody else's. Not an error worth explaining in detail —
      // saying whose would leak the other account.
      if (order.userId && order.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "That order is already saved to another account.",
        });
      }

      if (!order.userId) {
        await ctx.db.ticketOrder.update({
          where: { id: order.id },
          data: { userId: ctx.session.user.id },
        });
      }

      return { ok: true as const, orderId: order.id };
    }),
});
