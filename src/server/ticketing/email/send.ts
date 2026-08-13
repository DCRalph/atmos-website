import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TicketEmailType, TicketStatus } from "~Prisma/client";
import { db } from "~/server/db";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";
import { isGoogleWalletConfigured } from "~/server/wallet/google-config";
import { buildTicketQrPayload } from "~/server/ticketing/qr";
import { renderQrPng } from "~/server/ticketing/qr-image";
import { orderAccessToken, ticketAccessToken } from "~/server/ticketing/orders";
import { getTicketingSettings } from "~/server/ticketing/settings";
import {
  accessLevel,
  isElevated,
  ticketTypeName,
} from "~/lib/ticketing/access-levels";
import {
  applePassUrl,
  googleWalletSaveUrl,
  ticketDetailsUrl,
  ticketUrl,
  ticketsUrl,
} from "~/server/ticketing/urls";
import { sendTransactional } from "./provider";
import {
  renderCompEmail,
  renderRefundEmail,
  renderTicketEmail,
  type EmailTicket,
} from "./templates";

const APPLE_WALLET_BADGE_CID = "apple-wallet-badge";
const APPLE_WALLET_BADGE_FILENAME = "US-UK_Add_to_Apple_Wallet_RGB_101421.png";

async function appleWalletBadgeAttachment() {
  return {
    filename: APPLE_WALLET_BADGE_FILENAME,
    content: await readFile(
      join(process.cwd(), "public", APPLE_WALLET_BADGE_FILENAME),
    ),
    cid: APPLE_WALLET_BADGE_CID,
    contentType: "image/png",
  };
}

/**
 * Sending, logging and retrying ticket email.
 *
 * Never called inside the issuance transaction: a slow or failing mail API must
 * not be able to roll back a paid order. If the send fails the order is still
 * good, the failure is written to `TicketEmailLog`, and admin can hit resend.
 */

export async function sendTicketEmail({
  orderId,
  type = TicketEmailType.CONFIRMATION,
  overrideEmail,
}: {
  orderId: string;
  type?: TicketEmailType;
  overrideEmail?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    include: {
      event: true,
      tickets: {
        where: { status: TicketStatus.VALID },
        include: { tier: { select: { name: true } } },
        orderBy: { ticketNumber: "asc" },
      },
    },
  });

  if (!order) return { ok: false, error: "Order not found" };

  const to = overrideEmail ?? order.buyerEmail;
  if (!to) return { ok: false, error: "Order has no email address" };

  if (order.tickets.length === 0) {
    return { ok: false, error: "Order has no valid tickets" };
  }

  const settings = await getTicketingSettings();
  const accessToken = orderAccessToken(order);
  const appleWalletConfigured = isAppleWalletConfigured();
  const googleWalletConfigured = isGoogleWalletConfigured();

  const attachments: {
    filename: string;
    content: Buffer;
    cid: string;
    contentType: string;
  }[] = [];
  if (appleWalletConfigured) {
    attachments.push(await appleWalletBadgeAttachment());
  }

  const emailTickets: EmailTicket[] = [];
  const passUrlByTicketNumber = new Map<
    string,
    { apple?: string; google?: string }
  >();

  for (const [index, ticket] of order.tickets.entries()) {
    const cid = `ticket-${index + 1}`;
    const elevated = isElevated(ticket.accessLevel);
    const level = accessLevel(ticket.accessLevel);
    const png = await renderQrPng(
      buildTicketQrPayload(ticket, order.event.slug),
    );

    attachments.push({
      filename: `${ticket.ticketNumber}.png`,
      content: png,
      cid,
      contentType: "image/png",
    });

    emailTickets.push({
      ticketNumber: ticket.ticketNumber,
      tierName: ticketTypeName(ticket),
      accessLabel: elevated ? level.label : null,
      accessBadgeBg: elevated ? level.badgeBg : null,
      accessBadgeFg: elevated ? level.badgeFg : null,
      attendeeName: ticket.attendeeName,
      qrCid: cid,
    });

    passUrlByTicketNumber.set(ticket.ticketNumber, {
      apple: appleWalletConfigured
        ? applePassUrl(ticket.id, accessToken)
        : undefined,
      google: googleWalletConfigured
        ? googleWalletSaveUrl(ticket.id, accessToken)
        : undefined,
    });
  }

  const needsAttendeeNames =
    order.event.requireAttendeeNames &&
    order.tickets.some((ticket) => !ticket.attendeeName);

  const { subject, html, text } = renderTicketEmail({
    eventName: order.event.name,
    eventTimezone: order.event.timezone,
    startsAt: order.event.startsAt,
    doorsAt: order.event.doorsAt,
    venueName: order.event.venueName,
    venueAddress: order.event.venueAddress,
    isR18: order.event.isR18,
    orderNumber: order.orderNumber,
    tickets: emailTickets,
    ticketsUrl: ticketsUrl(accessToken),
    detailsUrl: ticketDetailsUrl(accessToken),
    appleWalletUrlFor: appleWalletConfigured
      ? (ticketNumber) => passUrlByTicketNumber.get(ticketNumber)?.apple ?? ""
      : undefined,
    appleWalletBadgeCid: appleWalletConfigured
      ? APPLE_WALLET_BADGE_CID
      : undefined,
    googleWalletUrlFor: googleWalletConfigured
      ? (ticketNumber) => passUrlByTicketNumber.get(ticketNumber)?.google ?? ""
      : undefined,
    totals: {
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      bookingFeeCents: order.bookingFeeCents,
      totalCents: order.totalCents,
      gstCents: order.gstCents,
    },
    gstNumber: order.event.gstNumber ?? settings.gstNumber,
    legalName: settings.legalName,
    supportEmail: settings.supportEmail,
    needsAttendeeNames,
  });

  const result = await sendTransactional({
    to,
    subject,
    html,
    text,
    attachments,
    replyTo: settings.supportEmail ?? undefined,
  });

  await logEmail({
    orderId,
    type,
    toEmail: to,
    result,
  });

  return { ok: result.ok, error: result.error };
}

/**
 * Send one person their own comp ticket, and nothing else.
 *
 * Order-scoped `sendTicketEmail` would put every ticket on the grant into the
 * artist's inbox, guests' QR codes included — which is exactly the swap this
 * whole design exists to prevent. So a comp is sent a ticket at a time, to the
 * address on that ticket.
 */
export async function sendCompTicketEmail({
  ticketId,
  type = TicketEmailType.COMP,
  overrideEmail,
}: {
  ticketId: string;
  type?: TicketEmailType;
  overrideEmail?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      tier: { select: { name: true } },
      event: true,
      order: { select: { id: true, buyerEmail: true } },
      handouts: { where: { status: TicketStatus.VALID }, select: { id: true } },
    },
  });

  if (!ticket) return { ok: false, error: "Ticket not found" };
  if (ticket.status !== TicketStatus.VALID) {
    return { ok: false, error: "Ticket is no longer valid" };
  }

  const to = overrideEmail ?? ticket.attendeeEmail;
  if (!to) return { ok: false, error: "Ticket has no email address" };

  const settings = await getTicketingSettings();
  const token = ticketAccessToken(ticket);
  const png = await renderQrPng(
    buildTicketQrPayload(ticket, ticket.event.slug),
  );
  const cid = "ticket-1";
  const appleWalletConfigured = isAppleWalletConfigured();
  const googleWalletConfigured = isGoogleWalletConfigured();
  const attachments = [
    {
      filename: `${ticket.ticketNumber}.png`,
      content: png,
      cid,
      contentType: "image/png",
    },
  ];
  if (appleWalletConfigured) {
    attachments.push(await appleWalletBadgeAttachment());
  }
  const elevated = isElevated(ticket.accessLevel);
  const level = accessLevel(ticket.accessLevel);

  const { subject, html, text } = renderCompEmail({
    eventName: ticket.event.name,
    eventTimezone: ticket.event.timezone,
    startsAt: ticket.event.startsAt,
    doorsAt: ticket.event.doorsAt,
    venueName: ticket.event.venueName,
    venueAddress: ticket.event.venueAddress,
    isR18: ticket.event.isR18,
    ticket: {
      ticketNumber: ticket.ticketNumber,
      tierName: ticketTypeName(ticket),
      accessLabel: elevated ? level.label : null,
      accessBadgeBg: elevated ? level.badgeBg : null,
      accessBadgeFg: elevated ? level.badgeFg : null,
      attendeeName: ticket.attendeeName,
      qrCid: cid,
    },
    ticketUrl: ticketUrl(token),
    appleWalletUrl: appleWalletConfigured
      ? applePassUrl(ticket.id, token)
      : undefined,
    appleWalletBadgeCid: appleWalletConfigured
      ? APPLE_WALLET_BADGE_CID
      : undefined,
    googleWalletUrl: googleWalletConfigured
      ? googleWalletSaveUrl(ticket.id, token)
      : undefined,
    invitedByName: ticket.invitedByName,
    handoutCount: ticket.handouts.length,
    supportEmail: settings.supportEmail,
  });

  const result = await sendTransactional({
    to,
    subject,
    html,
    text,
    attachments,
    replyTo: settings.supportEmail ?? undefined,
  });

  await logEmail({ orderId: ticket.order.id, type, toEmail: to, result });

  return { ok: result.ok, error: result.error };
}

export async function sendRefundEmail({
  orderId,
  amountCents,
  ticketNumbers,
}: {
  orderId: string;
  amountCents: number;
  ticketNumbers: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      buyerEmail: true,
      event: { select: { name: true } },
    },
  });
  if (!order?.buyerEmail) {
    return { ok: false, error: "Order has no email address" };
  }

  const settings = await getTicketingSettings();
  const { subject, html, text } = renderRefundEmail({
    eventName: order.event.name,
    orderNumber: order.orderNumber,
    amountCents,
    ticketNumbers,
    supportEmail: settings.supportEmail,
  });

  const result = await sendTransactional({
    to: order.buyerEmail,
    subject,
    html,
    text,
    replyTo: settings.supportEmail ?? undefined,
  });

  await logEmail({
    orderId,
    type: TicketEmailType.REFUND,
    toEmail: order.buyerEmail,
    result,
  });

  return { ok: result.ok, error: result.error };
}

async function logEmail({
  orderId,
  type,
  toEmail,
  result,
}: {
  orderId: string;
  type: TicketEmailType;
  toEmail: string;
  result: { ok: boolean; messageId?: string; error?: string };
}): Promise<void> {
  await db.ticketEmailLog
    .create({
      data: {
        orderId,
        type,
        toEmail,
        providerMessageId: result.messageId ?? null,
        status: result.ok ? "sent" : "failed",
        error: result.error ?? null,
      },
    })
    .catch((cause) => {
      // Logging must never take down a send that already succeeded.
      console.error("[ticketing] failed to write email log", cause);
    });
}
