import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { GigScheduleKind, GigStatus, type Prisma } from "~Prisma/client";
import { env } from "~/env";
import { gigPath } from "~/lib/gig-url";
import { buildMediaUrl } from "~/lib/media-url";
import { db } from "~/server/db";
import type { AdminCaller } from "../caller";
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
 * Gigs: the nights on the site, drafts and TBA ones included, with their real
 * details. Reads go straight to the database; writes go through the admin's
 * own `gigs` procedures.
 */

const runSheetRow = z.object({
  id: z.string(),
  kind: z.enum(GigScheduleKind),
  label: z.string().nullable(),
  role: z.string().nullable(),
  startsAt: dateTime.nullable(),
  endsAt: dateTime.nullable(),
  notes: z.string().nullable(),
  leadMinutes: z.array(z.number().int()),
  artistProfileIds: z.array(z.string()),
  recipientUserIds: z
    .array(z.string())
    .describe("Who hears this cue. Empty means the gig's list."),
});

export const gigResource = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  title: z.string(),
  subtitle: z.string(),
  shortDescription: z.string().nullable(),
  status: z.enum(GigStatus),
  isTba: z.boolean().describe("Public, with its details held back."),
  tbaText: z.string().nullable(),
  announceAt: dateTime.nullable().describe("When a TBA gig announces itself."),
  isAffiliated: z.boolean().describe("Somebody else's night we are on."),
  startsAt: dateTime,
  endsAt: dateTime.nullable(),
  venue: z
    .object({
      id: z.string(),
      name: z.string(),
      address: z.string().nullable(),
    })
    .nullable(),
  ticketLink: z.string().nullable(),
  posterUrl: z.string().nullable(),
  url: z.string().describe("The public page."),
  tags: z.array(z.object({ id: z.string(), name: z.string() })),
  lineUp: z
    .array(
      z.object({
        id: z.string(),
        startsAt: dateTime.nullable(),
        role: z.string().nullable(),
        artists: z.array(
          z.object({ id: z.string(), handle: z.string(), name: z.string() }),
        ),
      }),
    )
    .describe("The sets, in running order."),
  ticketEventIds: z.array(z.string()),
  runSheet: z
    .array(runSheetRow)
    .optional()
    .describe("Every row, cues included. Needs gigs:sensitive."),
  notifyUserIds: z
    .array(z.string())
    .optional()
    .describe("Who hears the cues. Needs gigs:sensitive."),
  publishedAt: dateTime.nullable(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

const GIG_SELECT = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  shortDescription: true,
  status: true,
  isTba: true,
  tbaText: true,
  announceAt: true,
  isAffiliated: true,
  gigStartTime: true,
  gigEndTime: true,
  ticketLink: true,
  posterFileUploadId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  venue: { select: { id: true, name: true, address: true } },
  gigTags: { select: { gigTag: { select: { id: true, name: true } } } },
  ticketEvents: { select: { id: true } },
  notifyRecipients: { select: { userId: true } },
  scheduleItems: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      kind: true,
      label: true,
      role: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      leadMinutes: true,
      recipients: { select: { userId: true } },
      artists: {
        orderBy: { sortOrder: "asc" },
        select: {
          artistProfile: {
            select: { id: true, handle: true, displayName: true },
          },
        },
      },
    },
  },
} satisfies Prisma.GigSelect;

type GigRow = Prisma.GigGetPayload<{ select: typeof GIG_SELECT }>;

function toGig(gig: GigRow, sensitive: boolean): z.input<typeof gigResource> {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    id: gig.id,
    slug: gig.slug,
    title: gig.title,
    subtitle: gig.subtitle,
    shortDescription: gig.shortDescription,
    status: gig.status,
    isTba: gig.isTba,
    tbaText: gig.tbaText,
    announceAt: gig.announceAt,
    isAffiliated: gig.isAffiliated,
    startsAt: gig.gigStartTime,
    endsAt: gig.gigEndTime,
    venue: gig.venue,
    ticketLink: gig.ticketLink,
    posterUrl: gig.posterFileUploadId
      ? buildMediaUrl(gig.posterFileUploadId)
      : null,
    url: `${appUrl}${gigPath(gig)}`,
    tags: gig.gigTags.map((row) => row.gigTag),
    lineUp: gig.scheduleItems
      .filter((row) => row.kind === GigScheduleKind.SET)
      .map((row) => ({
        id: row.id,
        startsAt: row.startsAt,
        role: row.role,
        artists: row.artists.map(({ artistProfile }) => ({
          id: artistProfile.id,
          handle: artistProfile.handle,
          name: artistProfile.displayName,
        })),
      })),
    ticketEventIds: gig.ticketEvents.map((event) => event.id),
    ...(sensitive
      ? {
          runSheet: gig.scheduleItems.map((row) => ({
            id: row.id,
            kind: row.kind,
            label: row.label,
            role: row.role,
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            notes: row.notes,
            leadMinutes: row.leadMinutes,
            artistProfileIds: row.artists.map((a) => a.artistProfile.id),
            recipientUserIds: row.recipients.map((r) => r.userId),
          })),
          notifyUserIds: gig.notifyRecipients.map((r) => r.userId),
        }
      : {}),
    publishedAt: gig.publishedAt,
    createdAt: gig.createdAt,
    updatedAt: gig.updatedAt,
  };
}

async function readGig(gigId: string, sensitive: boolean) {
  const gig = await db.gig.findUnique({
    where: { id: gigId },
    select: GIG_SELECT,
  });
  if (!gig) throw new TRPCError({ code: "NOT_FOUND", message: "No such gig." });
  return toGig(gig, sensitive);
}

const listGigs = defineEndpoint({
  method: "GET",
  path: "/gigs",
  tag: "Gigs",
  summary: "List gigs",
  description:
    "Latest start first. Drafts and TBA gigs are included, with their real titles.",
  scope: "gigs:read",
  widenedBy: ["gigs:sensitive"],
  query: pageQuery.extend({
    status: z.enum(GigStatus).optional(),
    from: dateTimeInput.optional().describe("Starting at or after."),
    to: dateTimeInput.optional().describe("Starting before."),
    q: z.string().trim().min(1).optional().describe("Title or subtitle."),
  }),
  response: page(gigResource),
  run: async ({ query }, ctx) => {
    const rows = await db.gig.findMany({
      where: {
        status: query.status,
        gigStartTime: { gte: query.from, lt: query.to },
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { subtitle: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ gigStartTime: "desc" }, { id: "asc" }],
      select: GIG_SELECT,
      ...cursorArgs(query),
    });
    const sensitive = ctx.has("gigs:sensitive");
    return pageOf(
      rows.map((row) => toGig(row, sensitive)),
      query.limit,
    );
  },
});

const getGig = defineEndpoint({
  method: "GET",
  path: "/gigs/{id}",
  tag: "Gigs",
  summary: "Get a gig",
  scope: "gigs:read",
  widenedBy: ["gigs:sensitive"],
  params: idParams,
  response: gigResource,
  run: ({ params }, ctx) => readGig(params.id, ctx.has("gigs:sensitive")),
});

/** A run sheet row as written. A set needs artists; nothing else may have them. */
const runSheetInput = z.object({
  id: z.string().optional().describe("A saved row's id. Absent for a new row."),
  kind: z.enum(GigScheduleKind),
  artistProfileIds: z.array(id).max(6).optional(),
  label: z.string().max(120).nullish(),
  role: z.string().max(80).nullish(),
  startsAt: dateTimeInput.nullish(),
  endsAt: dateTimeInput.nullish(),
  notes: z.string().max(4000).nullish(),
  leadMinutes: z.array(z.number().int().min(1).max(720)).max(4).optional(),
  recipientUserIds: z.array(id).optional(),
});

const gigFields = {
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .optional()
    .describe("The pretty URL. Empty makes one from the title."),
  shortDescription: z.string().max(1000).nullish(),
  isTba: z.boolean(),
  tbaText: z.string().trim().max(120).nullish(),
  announceAt: dateTimeInput.nullish(),
  isAffiliated: z.boolean(),
  venueId: id.nullish().describe("From GET /venues."),
  ticketLink: z.url().nullish(),
  startsAt: dateTimeInput,
  endsAt: dateTimeInput.nullish(),
};

const createGigBody = z.strictObject({
  ...gigFields,
  isTba: gigFields.isTba.default(false),
  isAffiliated: gigFields.isAffiliated.default(false),
  status: z
    .enum(GigStatus)
    .default(GigStatus.DRAFT)
    .describe("Defaults to DRAFT: off the site until published."),
  tagIds: z.array(id).default([]),
  runSheet: z
    .array(runSheetInput)
    .default([])
    .describe("In running order. Needs gigs:sensitive as well."),
});

const createGig = defineEndpoint({
  method: "POST",
  path: "/gigs",
  tag: "Gigs",
  summary: "Create a gig",
  scope: {
    mayNeed: ["gigs:write", "gigs:sensitive"],
    // A bill of sets is the public line-up. Cues, notes and who hears them
    // are the run sheet, which only gigs:sensitive can read.
    pick: (body) =>
      body.runSheet.some(
        (row) =>
          row.kind !== GigScheduleKind.SET ||
          Boolean(row.notes) ||
          (row.recipientUserIds?.length ?? 0) > 0,
      )
        ? ["gigs:write", "gigs:sensitive"]
        : ["gigs:write"],
  },
  body: createGigBody,
  example: {
    title: "Atmos Summer",
    subtitle: "Whammy Bar",
    startsAt: "2026-12-12T07:00:00.000Z",
    runSheet: [{ kind: "SET", artistProfileIds: ["<artist id>"] }],
  },
  response: gigResource,
  status: 201,
  run: async ({ body }, ctx) => {
    const admin = await ctx.admin();
    const { startsAt, endsAt, runSheet, ticketLink, ...rest } = body;
    const created = await admin.gigs.create({
      ...rest,
      ticketLink: ticketLink ?? undefined,
      shortDescription: rest.shortDescription ?? undefined,
      gigStartTime: startsAt,
      gigEndTime: endsAt ?? undefined,
      scheduleItems: runSheet.map(scheduleRow),
    });
    return readGig(created.id, ctx.has("gigs:sensitive"));
  },
});

const updateGigBody = z
  .strictObject(gigFields)
  .partial()
  .extend({
    tagIds: z
      .array(id)
      .optional()
      .describe("The complete list of tags. Tags left out are removed."),
    runSheet: z
      .array(runSheetInput.partial().extend({ remove: z.boolean().optional() }))
      .optional()
      .describe(
        "The whole run sheet in running order. Name every saved row by id with only the fields that change, or remove: true to delete it. Needs gigs:sensitive as well.",
      ),
  });

const updateGig = defineEndpoint({
  method: "PATCH",
  path: "/gigs/{id}",
  tag: "Gigs",
  summary: "Update a gig",
  description:
    "Send only the fields that change. To publish or unpublish, use the publish endpoints.",
  scope: {
    mayNeed: ["gigs:write", "gigs:sensitive"],
    pick: (body) =>
      body.runSheet ? ["gigs:write", "gigs:sensitive"] : ["gigs:write"],
  },
  params: idParams,
  body: updateGigBody,
  example: { title: "Atmos Summer", endsAt: "2026-12-12T13:00:00.000Z" },
  response: gigResource,
  run: async ({ params, body }, ctx) => {
    const admin = await ctx.admin();
    const { startsAt, endsAt, runSheet, tagIds, ...rest } = body;
    if (tagIds) await setTags(admin, params.id, tagIds);

    const fields = {
      ...rest,
      gigStartTime: startsAt,
      gigEndTime: endsAt,
      scheduleItems: runSheet,
    };
    const changed = Object.values(fields).some((value) => value !== undefined);
    if (changed) await admin.gigs.update({ id: params.id, ...fields });
    return readGig(params.id, ctx.has("gigs:sensitive"));
  },
});

/** Tags are their own procedures in the admin, so a full list is a diff. */
async function setTags(admin: AdminCaller, gigId: string, tagIds: string[]) {
  const current = await db.gigTagRelationship.findMany({
    where: { gigId },
    select: { gigTagId: true },
  });
  const have = new Set(current.map((row) => row.gigTagId));
  const want = new Set(tagIds);
  for (const tagId of want) {
    if (!have.has(tagId)) await admin.gigs.assignTag({ gigId, tagId });
  }
  for (const tagId of have) {
    if (!want.has(tagId)) await admin.gigs.removeTag({ gigId, tagId });
  }
}

/** The API's run sheet row as the gigs procedures take it. */
function scheduleRow(row: z.output<typeof runSheetInput>) {
  return {
    ...row,
    artistProfileIds: row.artistProfileIds ?? [],
    leadMinutes: row.leadMinutes ?? [],
    recipientUserIds: row.recipientUserIds ?? [],
  };
}

const publishGig = defineEndpoint({
  method: "POST",
  path: "/gigs/{id}/publish",
  tag: "Gigs",
  summary: "Publish a gig",
  description: "Puts a draft on the site. Publishing a live gig does nothing.",
  scope: "gigs:write",
  params: idParams,
  response: gigResource,
  run: async ({ params }, ctx) => {
    const admin = await ctx.admin();
    await admin.gigImport.publish({ gigId: params.id });
    return readGig(params.id, ctx.has("gigs:sensitive"));
  },
});

const unpublishGig = defineEndpoint({
  method: "POST",
  path: "/gigs/{id}/unpublish",
  tag: "Gigs",
  summary: "Unpublish a gig",
  description: "Takes a gig off the site, back to draft.",
  scope: "gigs:write",
  params: idParams,
  response: gigResource,
  run: async ({ params }, ctx) => {
    const admin = await ctx.admin();
    await admin.gigImport.unpublish({ gigId: params.id });
    return readGig(params.id, ctx.has("gigs:sensitive"));
  },
});

const deleteGig = defineEndpoint({
  method: "DELETE",
  path: "/gigs/{id}",
  tag: "Gigs",
  summary: "Delete a gig",
  description:
    "For good, with its media and run sheet. Ticketed events linked to it stay, unlinked.",
  scope: "gigs:delete",
  params: idParams,
  response: ok,
  run: async ({ params }, ctx) => {
    const admin = await ctx.admin();
    await admin.gigs.delete({ id: params.id });
    return { ok: true as const };
  },
});

const listTags = defineEndpoint({
  method: "GET",
  path: "/gig-tags",
  tag: "Gigs",
  summary: "List gig tags",
  description: "Every tag, for `tagIds`.",
  scope: "gigs:read",
  response: z.object({
    data: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        color: z.string(),
      }),
    ),
  }),
  run: async () => ({
    data: await db.gigTag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, color: true },
    }),
  }),
});

export const gigEndpoints = [
  listGigs,
  getGig,
  createGig,
  updateGig,
  publishGig,
  unpublishGig,
  deleteGig,
  listTags,
];
