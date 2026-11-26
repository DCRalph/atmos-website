import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { buildMediaUrl } from "~/lib/media-url";
import { db } from "~/server/db";
import { defineEndpoint } from "../endpoint";
import { idParams } from "../schemas";

/** Venues, for `venueId` on gigs and events, and the artists for line-ups. */

const venueResource = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  logoUrl: z.string().nullable(),
});

function toVenue(venue: {
  id: string;
  name: string;
  address: string | null;
  logoFileId: string | null;
}): z.input<typeof venueResource> {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    logoUrl: venue.logoFileId ? buildMediaUrl(venue.logoFileId) : null,
  };
}

const listVenues = defineEndpoint({
  method: "GET",
  path: "/venues",
  tag: "Venues",
  summary: "List venues",
  description: "Every saved venue, by name.",
  scope: "venues:read",
  response: z.object({ data: z.array(venueResource) }),
  run: async () => ({
    data: (await db.venue.findMany({ orderBy: { name: "asc" } })).map(toVenue),
  }),
});

const venueBody = z.strictObject({
  name: z.string().trim().min(1),
  address: z.string().trim().nullish(),
});

const createVenue = defineEndpoint({
  method: "POST",
  path: "/venues",
  tag: "Venues",
  summary: "Create a venue",
  scope: "venues:write",
  body: venueBody,
  example: { name: "Whammy Bar", address: "183 Karangahape Road, Auckland" },
  response: venueResource,
  status: 201,
  run: async ({ body }, ctx) => {
    const admin = await ctx.admin();
    return toVenue(await admin.venues.create(body));
  },
});

const updateVenue = defineEndpoint({
  method: "PATCH",
  path: "/venues/{id}",
  tag: "Venues",
  summary: "Update a venue",
  description:
    "Also updates the name and address on its ticketed events, and their wallet passes.",
  scope: "venues:write",
  params: idParams,
  body: venueBody.partial(),
  example: { address: "183 Karangahape Road, Auckland 1010" },
  response: venueResource,
  run: async ({ params, body }, ctx) => {
    const stored = await db.venue.findUnique({ where: { id: params.id } });
    if (!stored) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No such venue." });
    }
    const admin = await ctx.admin();
    // The admin's update takes the whole venue.
    const updated = await admin.venues.update({
      id: stored.id,
      name: body.name ?? stored.name,
      address: body.address === undefined ? stored.address : body.address,
      logoFileId: stored.logoFileId,
    });
    return toVenue(updated);
  },
});

const searchArtists = defineEndpoint({
  method: "GET",
  path: "/artists",
  tag: "Artists",
  summary: "Search artists",
  description:
    "Artist profiles by name or handle, for `artistProfileIds` on a gig's run sheet. Without `q`, the most recently edited.",
  scope: "artists:read",
  query: z.object({
    q: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
  response: z.object({
    data: z.array(
      z.object({
        id: z.string(),
        handle: z.string(),
        name: z.string(),
        isPublished: z.boolean(),
        avatarUrl: z.string().nullable(),
      }),
    ),
  }),
  run: async ({ query }) => {
    const profiles = await db.artistProfile.findMany({
      where: query.q
        ? {
            OR: [
              { displayName: { contains: query.q, mode: "insensitive" } },
              { handle: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: query.q ? { displayName: "asc" } : { updatedAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        handle: true,
        displayName: true,
        isPublished: true,
        avatarFileId: true,
      },
    });
    return {
      data: profiles.map((profile) => ({
        id: profile.id,
        handle: profile.handle,
        name: profile.displayName,
        isPublished: profile.isPublished,
        avatarUrl: profile.avatarFileId
          ? buildMediaUrl(profile.avatarFileId)
          : null,
      })),
    };
  },
});

export const venueEndpoints = [
  listVenues,
  createVenue,
  updateVenue,
  searchArtists,
];
