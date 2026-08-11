import "server-only";

import { TicketEmailType, TicketStatus } from "~Prisma/client";
import { db } from "~/server/db";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";
import { isGoogleWalletConfigured } from "~/server/wallet/google-config";
import { buildTicketToken } from "~/server/ticketing/qr";
import { renderQrPng } from "~/server/ticketing/qr-image";
import { orderAccessToken } from "~/server/ticketing/orders";
import { getTicketingSettings } from "~/server/ticketing/settings";
import { accessLevel, isElevated } from "~/lib/ticketing/access-levels";
import {
  applePassUrl,
  googleWalletSaveUrl,
  ticketDetailsUrl,
  ticketsUrl,
} from "~/server/ticketing/urls";
import { sendTransactional } from "./provider";
import {
  renderRefundEmail,
  renderTicketEmail,
  type EmailTicket,
} from "./templates";

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

  const attachments: {
    filename: string;
    content: Buffer;
    cid: string;
    contentType: string;
  }[] = [];
  const emailTickets: EmailTicket[] = [];
  const passUrlByTicketNumber = new Map<
    string,
    { apple?: string; google?: string }
  >();

  for (const [index, ticket] of order.tickets.entries()) {
    const cid = `ticket-${index + 1}`;
    const png = await renderQrPng(buildTicketToken(ticket));

    attachments.push({
      filename: `${ticket.ticketNumber}.png`,
      content: png,
      cid,
      contentType: "image/png",
    });

    emailTickets.push({
      ticketNumber: ticket.ticketNumber,
      tierName: ticket.tier.name,
      accessLabel: isElevated(ticket.accessLevel)
        ? accessLevel(ticket.accessLevel).label
        : null,
      attendeeName: ticket.attendeeName,
      qrCid: cid,
    });

    passUrlByTicketNumber.set(ticket.ticketNumber, {
      apple: isAppleWalletConfigured()
        ? applePassUrl(ticket.id, accessToken)
        : undefined,
      google: isGoogleWalletConfigured()
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
    appleWalletUrlFor: isAppleWalletConfigured()
      ? (ticketNumber) => passUrlByTicketNumber.get(ticketNumber)?.apple ?? ""
      : undefined,
    googleWalletUrlFor: isGoogleWalletConfigured()
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
