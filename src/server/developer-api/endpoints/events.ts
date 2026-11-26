import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  EventStaffRole,
  TicketEventStatus,
  TicketEventVisibility,
  TierSalesChannel,
  type Prisma,
} from "~Prisma/client";
import { buildMediaUrl } from "~/lib/media-url";
import { db } from "~/server/db";
import { eventUrl } from "~/server/ticketing/urls";
import { defineEndpoint } from "../endpoint";
import {
  cursorArgs,
  dateTime,
  dateTimeInput,
  id,
  idParams,
  ok,
  page,
  pageOf,
  pageQuery,
} from "../schemas";

/**
 * Ticketed events and their tiers: what is on sale, when and how. Money and
 * people are elsewhere, behind their own scopes (`./stats`, `./orders`).
 */

const tierResource = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().describe("For one purchase: a whole group."),
  allocation: z.number().int().describe("In tickets."),
  groupSize: z.number().int(),
  salesChannel: z.enum(TierSalesChannel),
  salesStartAt: dateTime.nullable(),
  salesEndAt: dateTime.nullable(),
  isActive: z.boolean(),
  isHidden: z.boolean(),
  releaseAfterPrevious: z.boolean(),
  hideUntilReleased: z.boolean(),
  maxPerOrder: z.number().int(),
  maxPerEmail: z.number().int().nullable(),
  requiresApproval: z.boolean(),
  accessLevel: z.string(),
});

export const eventResource = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  gigId: z.string().nullable(),
  status: z.enum(TicketEventStatus),
  visibility: z.enum(TicketEventVisibility),
  shortDescription: z.string().nullable(),
  venue: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    address: z.string().nullable(),
  }),
  timezone: z.string(),
  doorsAt: dateTime.nullable(),
  startsAt: dateTime,
  endsAt: dateTime.nullable(),
  salesOpenAt: dateTime.nullable(),
  salesCloseAt: dateTime.nullable(),
  capacity: z.number().int().nullable(),
  compAllowance: z.number().int().nullable(),
  maxTicketsPerOrder: z.number().int(),
  requireAttendeeNames: z.boolean(),
  reentryAllowed: z.boolean(),
  isR18: z.boolean(),
  bookingFeeFixedCents: z.number().int().nullable(),
  bookingFeePercentBp: z
    .number()
    .int()
    .nullable()
    .describe("Basis points: 250 is 2.5%."),
  url: z.string(),
  posterUrl: z.string().nullable(),
  tiers: z.array(tierResource).describe("In the order buyers see them."),
  accessKey: z
    .string()
    .nullable()
    .optional()
    .describe("A private event's key. Needs events:sensitive."),
  privateUrl: z
    .string()
    .nullable()
    .optional()
    .describe("The link that opens a private event. Needs events:sensitive."),
  staff: z
    .array(z.object({ userId: z.string(), role: z.enum(EventStaffRole) }))
    .optional()
    .describe("Door staff. Needs events:sensitive."),
  publishedAt: dateTime.nullable(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

const EVENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  gigId: true,
  status: true,
  visibility: true,
  accessKey: true,
  shortDescription: true,
  venueId: true,
  venueName: true,
  venueAddress: true,
  timezone: true,
  doorsAt: true,
  startsAt: true,
  endsAt: true,
  salesOpenAt: true,
  salesCloseAt: true,
  capacity: true,
  compAllowance: true,
  maxTicketsPerOrder: true,
  requireAttendeeNames: true,
  reentryAllowed: true,
  isR18: true,
  bookingFeeFixedCents: true,
  bookingFeePercentBp: true,
  posterFileUploadId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  tiers: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      allocation: true,
      groupSize: true,
      salesChannel: true,
      salesStartAt: true,
      salesEndAt: true,
      isActive: true,
      isHidden: true,
      releaseAfterPrevious: true,
      hideUntilReleased: true,
      maxPerOrder: true,
      maxPerEmail: true,
      requiresApproval: true,
      accessLevel: true,
    },
  },
  staff: { select: { userId: true, role: true } },
} satisfies Prisma.TicketEventSelect;

type EventRow = Prisma.TicketEventGetPayload<{ select: typeof EVENT_SELECT }>;

function toEvent(
  event: EventRow,
  sensitive: boolean,
): z.input<typeof eventResource> {
  const { accessKey, staff, venueId, venueName, venueAddress, ...rest } = event;
  const url = eventUrl(event.slug);
  return {
    ...rest,
    venue: { id: venueId, name: venueName, address: venueAddress },
    url,
    posterUrl: event.posterFileUploadId
      ? buildMediaUrl(event.posterFileUploadId)
      : null,
    ...(sensitive
      ? {
          accessKey,
          privateUrl:
            event.visibility === TicketEventVisibility.PRIVATE && accessKey
              ? `${url}?k=${encodeURIComponent(accessKey)}`
              : null,
          staff,
        }
      : {}),
  };
}

export async function readEvent(eventId: string, sensitive: boolean) {
  const event = await db.ticketEvent.findUnique({
    where: { id: eventId },
    select: EVENT_SELECT,
  });
  if (!event) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such event." });
  }
  return toEvent(event, sensitive);
}

const listEvents = defineEndpoint({
  method: "GET",
  path: "/events",
  tag: "Events",
  summary: "List ticketed events",
  description: "Latest start first. Drafts and private events included.",
  scope: "events:read",
  widenedBy: ["events:sensitive"],
  query: pageQuery.extend({
    status: z.enum(TicketEventStatus).optional(),
    gigId: id.optional(),
    from: dateTimeInput.optional().describe("Starting at or after."),
    to: dateTimeInput.optional().describe("Starting before."),
  }),
  response: page(eventResource),
  run: async ({ query }, ctx) => {
    const rows = await db.ticketEvent.findMany({
      where: {
        status: query.status,
        gigId: query.gigId,
        startsAt: { gte: query.from, lt: query.to },
      },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      select: EVENT_SELECT,
      ...cursorArgs(query),
    });
    const sensitive = ctx.has("events:sensitive");
    return pageOf(
      rows.map((row) => toEvent(row, sensitive)),
      query.limit,
    );
  },
});

const getEvent = defineEndpoint({
  method: "GET",
  path: "/events/{id}",
  tag: "Events",
  summary: "Get a ticketed event",
  scope: "events:read",
  widenedBy: ["events:sensitive"],
  params: idParams,
  response: eventResource,
  run: ({ params }, ctx) => readEvent(params.id, ctx.has("events:sensitive")),
});

const tierInput = z.object({
  id: id.optional().describe("A saved tier's id. Absent for a new tier."),
  name: z.string().trim().min(1),
  description: z.string().trim().nullish(),
  priceCents: z.number().int().min(0),
  allocation: z.number().int().min(0),
  groupSize: z.number().int().min(1).max(20).optional(),
  releaseAfterPrevious: z.boolean().optional(),
  hideUntilReleased: z.boolean().optional(),
  salesChannel: z.enum(TierSalesChannel).optional(),
  salesStartAt: dateTimeInput.nullish(),
  salesEndAt: dateTimeInput.nullish(),
  isActive: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  maxPerOrder: z.number().int().min(1).max(50).optional(),
  maxPerEmail: z.number().int().min(1).nullish(),
  requiresApproval: z.boolean().optional(),
  accessLevel: z.string().trim().min(2).max(24).optional(),
});

const eventFields = {
  name: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  gigId: id.nullish().describe("The gig it sells tickets for."),
  shortDescription: z.string().trim().max(300).nullish(),
  venueId: id.nullish().describe("A saved venue, from GET /venues."),
  venueName: z.string().trim().nullish(),
  venueAddress: z.string().trim().nullish(),
  timezone: z.string().trim().optional(),
  doorsAt: dateTimeInput.nullish(),
  startsAt: dateTimeInput,
  endsAt: dateTimeInput.nullish(),
  salesOpenAt: dateTimeInput.nullish(),
  salesCloseAt: dateTimeInput.nullish(),
  capacity: z.number().int().min(1).nullish(),
  compAllowance: z.number().int().min(0).nullish(),
  maxTicketsPerOrder: z.number().int().min(1).max(50).optional(),
  requireAttendeeNames: z.boolean().optional(),
  reentryAllowed: z.boolean().optional(),
  visibility: z.enum(TicketEventVisibility).optional(),
  isR18: z.boolean().optional(),
  bookingFeeFixedCents: z.number().int().min(0).nullish(),
  bookingFeePercentBp: z.number().int().min(0).max(5000).nullish(),
};

/** The admin's tier plan, with the defaults the admin's form would send. */
function tierPlan(tier: z.output<typeof tierInput>) {
  return {
    ...tier,
    highlightDescription: false,
    groupSize: tier.groupSize ?? 1,
    releaseAfterPrevious: tier.releaseAfterPrevious ?? false,
    hideUntilReleased: tier.hideUntilReleased ?? false,
    salesChannel: tier.salesChannel ?? TierSalesChannel.ALL,
    isActive: tier.isActive ?? true,
    isHidden: tier.isHidden ?? false,
    maxPerOrder: tier.maxPerOrder ?? 10,
    requiresApproval: tier.requiresApproval ?? false,
    accessLevel: tier.accessLevel ?? "GENERAL",
  };
}

const createEvent = defineEndpoint({
  method: "POST",
  path: "/events",
  tag: "Events",
  summary: "Create a ticketed event",
  description:
    "Made as a draft. Add tiers here or later, then publish with the status endpoint.",
  scope: "events:write",
  body: z.strictObject({
    ...eventFields,
    tiers: z.array(tierInput).default([]),
  }),
  example: {
    name: "Atmos Summer",
    startsAt: "2026-12-12T07:00:00.000Z",
    capacity: 300,
    tiers: [
      { name: "Early bird", priceCents: 2500, allocation: 100 },
      {
        name: "General",
        priceCents: 3500,
        allocation: 200,
        releaseAfterPrevious: true,
      },
    ],
  },
  response: eventResource,
  status: 201,
  run: async ({ body }, ctx) => {
    const admin = await ctx.admin();
    const created = await admin.ticketEvents.create({
      ...body,
      timezone: body.timezone ?? "Pacific/Auckland",
      maxTicketsPerOrder: body.maxTicketsPerOrder ?? 10,
      requireAttendeeNames: body.requireAttendeeNames ?? true,
      reentryAllowed: body.reentryAllowed ?? false,
      visibility: body.visibility ?? TicketEventVisibility.PUBLIC,
      isR18: body.isR18 ?? true,
      tiers: body.tiers.map(tierPlan),
    });
    return readEvent(created.id, ctx.has("events:sensitive"));
  },
});

const updateEvent = defineEndpoint({
  method: "PATCH",
  path: "/events/{id}",
  tag: "Events",
  summary: "Update a ticketed event",
  description:
    "Send only the fields that change. `tiers`, when given, is every tier the event should have, in order: tiers left out are deleted, which fails for a tier that has sold. A saved tier needs only its id and what changes.",
  scope: "events:write",
  params: idParams,
  body: z
    .strictObject(eventFields)
    .partial()
    .extend({
      tiers: z
        .array(tierInput.partial().extend({ id: id.optional() }))
        .optional(),
    }),
  example: { capacity: 320, salesCloseAt: "2026-12-12T06:00:00.000Z" },
  response: eventResource.extend({
    capacityWarning: z
      .string()
      .nullable()
      .describe(
        "Set when the tiers now put more on sale than the room holds. The change is saved anyway, as in the admin.",
      ),
  }),
  run: async ({ params, body }, ctx) => {
    const admin = await ctx.admin();
    const { capacityWarning } = await admin.ticketEvents.update({
      id: params.id,
      ...body,
    });
    return {
      ...(await readEvent(params.id, ctx.has("events:sensitive"))),
      capacityWarning,
    };
  },
});

const setStatus = defineEndpoint({
  method: "POST",
  path: "/events/{id}/status",
  tag: "Events",
  summary: "Change an event's status",
  description:
    "PUBLISHED puts it on sale (it needs a tier), SALES_PAUSED and SOLD_OUT stop sales, CANCELLED cancels it and updates every wallet pass, ARCHIVED files it away.",
  scope: {
    mayNeed: ["events:write", "events:cancel"],
    pick: (body) =>
      body.status === TicketEventStatus.CANCELLED
        ? ["events:write", "events:cancel"]
        : ["events:write"],
  },
  params: idParams,
  body: z.strictObject({ status: z.enum(TicketEventStatus) }),
  example: { status: "PUBLISHED" },
  response: eventResource,
  run: async ({ params, body }, ctx) => {
    const admin = await ctx.admin();
    await admin.ticketEvents.setStatus({ id: params.id, status: body.status });
    return readEvent(params.id, ctx.has("events:sensitive"));
  },
});

const deleteEvent = defineEndpoint({
  method: "DELETE",
  path: "/events/{id}",
  tag: "Events",
  summary: "Delete a ticketed event",
  description:
    "Only while no tickets have been issued. Otherwise cancel or archive it.",
  scope: "events:cancel",
  params: idParams,
  response: ok,
  run: async ({ params }, ctx) => {
    const admin = await ctx.admin();
    await admin.ticketEvents.delete({ id: params.id });
    return { ok: true as const };
  },
});

export const eventEndpoints = [
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  setStatus,
  deleteEvent,
];
