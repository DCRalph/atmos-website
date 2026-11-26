import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  PaymentMethodKind,
  TicketOrderStatus,
  TicketStatus,
  type Prisma,
} from "~Prisma/client";
import { db } from "~/server/db";
import { defineEndpoint } from "../endpoint";
import {
  cursorArgs,
  dateTime,
  idParams,
  ok,
  page,
  pageOf,
  pageQuery,
} from "../schemas";

/**
 * Orders and their tickets. Without `orders:sensitive` an order is amounts
 * and ticket numbers only; with it, the names and contact details behind it.
 * Resends and comps email people, and refunds move money, so each has its own
 * scope.
 */

const orderResource = z.object({
  id: z.string(),
  orderNumber: z.string(),
  eventId: z.string(),
  status: z.enum(TicketOrderStatus),
  paymentMethod: z.enum(PaymentMethodKind),
  paidWith: z.string().nullable().describe("Apple Pay, card and so on."),
  currency: z.string(),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  bookingFeeCents: z.number().int(),
  venueFeeCents: z.number().int(),
  totalCents: z.number().int(),
  gstCents: z.number().int(),
  refundedCents: z.number().int(),
  items: z.array(
    z.object({
      tierId: z.string(),
      tierName: z.string(),
      quantity: z.number().int(),
      unitPriceCents: z.number().int(),
    }),
  ),
  tickets: z.array(
    z.object({
      id: z.string(),
      ticketNumber: z.string(),
      status: z.enum(TicketStatus),
      tierId: z.string().nullable(),
      accessLevel: z.string(),
      isComp: z.boolean(),
      pricePaidCents: z.number().int(),
      attendeeName: z
        .string()
        .nullable()
        .optional()
        .describe("Needs orders:sensitive."),
    }),
  ),
  utm: z.object({
    source: z.string().nullable(),
    medium: z.string().nullable(),
    campaign: z.string().nullable(),
  }),
  buyer: z
    .object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      marketingOptIn: z.boolean(),
    })
    .optional()
    .describe("Needs orders:sensitive."),
  createdAt: dateTime,
  paidAt: dateTime.nullable(),
  refundedAt: dateTime.nullable(),
});

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  eventId: true,
  status: true,
  paymentMethod: true,
  paidWith: true,
  currency: true,
  subtotalCents: true,
  discountCents: true,
  bookingFeeCents: true,
  venueFeeCents: true,
  totalCents: true,
  gstCents: true,
  refundedCents: true,
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  buyerName: true,
  buyerEmail: true,
  buyerPhone: true,
  marketingOptIn: true,
  createdAt: true,
  paidAt: true,
  refundedAt: true,
  items: {
    select: {
      tierId: true,
      quantity: true,
      unitPriceCents: true,
      tier: { select: { name: true } },
    },
  },
  tickets: {
    orderBy: { ticketNumber: "asc" },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      tierId: true,
      accessLevel: true,
      isComp: true,
      pricePaidCents: true,
      attendeeName: true,
    },
  },
} satisfies Prisma.TicketOrderSelect;

type OrderRow = Prisma.TicketOrderGetPayload<{ select: typeof ORDER_SELECT }>;

function toOrder(
  order: OrderRow,
  sensitive: boolean,
): z.input<typeof orderResource> {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    eventId: order.eventId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paidWith: order.paidWith,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    bookingFeeCents: order.bookingFeeCents,
    venueFeeCents: order.venueFeeCents,
    totalCents: order.totalCents,
    gstCents: order.gstCents,
    refundedCents: order.refundedCents,
    items: order.items.map((item) => ({
      tierId: item.tierId,
      tierName: item.tier.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    tickets: order.tickets.map(({ attendeeName, ...ticket }) => ({
      ...ticket,
      ...(sensitive ? { attendeeName } : {}),
    })),
    utm: {
      source: order.utmSource,
      medium: order.utmMedium,
      campaign: order.utmCampaign,
    },
    ...(sensitive
      ? {
          buyer: {
            name: order.buyerName,
            email: order.buyerEmail,
            phone: order.buyerPhone,
            marketingOptIn: order.marketingOptIn,
          },
        }
      : {}),
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    refundedAt: order.refundedAt,
  };
}

async function readOrder(orderId: string, sensitive: boolean) {
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: ORDER_SELECT,
  });
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such order." });
  }
  return toOrder(order, sensitive);
}

const listOrders = defineEndpoint({
  method: "GET",
  path: "/events/{id}/orders",
  tag: "Orders",
  summary: "List an event's orders",
  description:
    "Newest first. Abandoned checkouts are left out unless asked for by status.",
  scope: "orders:read",
  widenedBy: ["orders:sensitive"],
  params: idParams,
  query: pageQuery.extend({ status: z.enum(TicketOrderStatus).optional() }),
  response: page(orderResource),
  run: async ({ params, query }, ctx) => {
    const rows = await db.ticketOrder.findMany({
      where: {
        eventId: params.id,
        status: query.status ?? {
          notIn: [TicketOrderStatus.PENDING, TicketOrderStatus.EXPIRED],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: ORDER_SELECT,
      ...cursorArgs(query),
    });
    const sensitive = ctx.has("orders:sensitive");
    return pageOf(
      rows.map((row) => toOrder(row, sensitive)),
      query.limit,
    );
  },
});

const getOrder = defineEndpoint({
  method: "GET",
  path: "/orders/{id}",
  tag: "Orders",
  summary: "Get an order",
  scope: "orders:read",
  widenedBy: ["orders:sensitive"],
  params: idParams,
  response: orderResource,
  run: ({ params }, ctx) => readOrder(params.id, ctx.has("orders:sensitive")),
});

const resendTickets = defineEndpoint({
  method: "POST",
  path: "/orders/{id}/resend",
  tag: "Orders",
  summary: "Resend tickets",
  description:
    "Emails the order's tickets again, to the buyer or to another address. Another address needs orders:sensitive as well.",
  scope: {
    mayNeed: ["orders:manage", "orders:sensitive"],
    pick: (body) =>
      body.email ? ["orders:manage", "orders:sensitive"] : ["orders:manage"],
  },
  params: idParams,
  body: z.strictObject({ email: z.email().optional() }),
  example: {},
  response: ok,
  run: async ({ params, body }, ctx) => {
    const admin = await ctx.admin();
    await admin.ticketAdmin.resendTickets({
      orderId: params.id,
      overrideEmail: body.email,
    });
    return { ok: true as const };
  },
});

const refundOrder = defineEndpoint({
  method: "POST",
  path: "/orders/{id}/refund",
  tag: "Orders",
  summary: "Refund an order",
  description:
    "Refunds whatever is left of the order through Stripe and voids its tickets. A retry does not refund twice.",
  scope: "orders:refund",
  params: idParams,
  body: z.strictObject({
    reason: z.string().trim().max(200).optional(),
    notifyBuyer: z
      .boolean()
      .default(true)
      .describe("Email the buyer that they have been refunded."),
  }),
  example: { reason: "Can't make it", notifyBuyer: true },
  response: z.object({ ok: z.literal(true), refundedCents: z.number().int() }),
  run: async ({ params, body }, ctx) => {
    const admin = await ctx.admin();
    return admin.ticketAdmin.refundOrder({
      orderId: params.id,
      reason: body.reason ?? "Refunded through the API",
      notifyBuyer: body.notifyBuyer,
    });
  },
});

const issueComp = defineEndpoint({
  method: "POST",
  path: "/events/{id}/comps",
  tag: "Orders",
  summary: "Issue a comp",
  description:
    "One named ticket for the guest, plus any they hand out. Past the event's comp allowance it fails with a warning until sent again with acknowledge: true.",
  scope: "orders:manage",
  widenedBy: ["orders:sensitive"],
  params: idParams,
  body: z.strictObject({
    recipientName: z.string().trim().min(1).max(120),
    recipientEmail: z.email().optional(),
    accessLevel: z.string().trim().min(2).max(24).default("GENERAL"),
    handouts: z
      .array(
        z.object({
          accessLevel: z.string().trim().min(2).max(24),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .max(6)
      .default([]),
    notes: z.string().trim().max(500).optional(),
    sendEmail: z.boolean().default(true),
    acknowledge: z.boolean().default(false),
  }),
  example: {
    recipientName: "Sam Guest",
    recipientEmail: "sam@example.com",
  },
  response: z.object({
    orderId: z.string(),
    orderNumber: z.string(),
    ticketCount: z.number().int(),
    handoutCount: z.number().int(),
    ticketUrl: z
      .string()
      .optional()
      .describe("Opens the guest's ticket. Needs orders:sensitive."),
  }),
  status: 201,
  run: async ({ params, body }, ctx) => {
    const admin = await ctx.admin();
    const comp = await admin.ticketAdmin.issueComp({
      eventId: params.id,
      ...body,
    });
    return {
      orderId: comp.orderId,
      orderNumber: comp.orderNumber,
      ticketCount: comp.ticketCount,
      handoutCount: comp.handoutCount,
      ...(ctx.has("orders:sensitive") ? { ticketUrl: comp.ticketUrl } : {}),
    };
  },
});

export const orderEndpoints = [
  listOrders,
  getOrder,
  resendTickets,
  refundOrder,
  issueComp,
];
