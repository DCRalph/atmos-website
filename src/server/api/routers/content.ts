import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getYouTubeId, youtubeThumbnail } from "~/lib/youtube";
import {
  CONTENT_ARTWORK_INCLUDE,
  withContentArtwork,
} from "~/server/api/content-artwork";
import { assertContentArtwork } from "~/server/uploads/image-selection";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";

const ContentLinkTypeSchema = z.enum([
  "SOUNDCLOUD_TRACK",
  "SOUNDCLOUD_PLAYLIST",
  "YOUTUBE_VIDEO",
  "OTHER",
]);

function youtubeFields(item: {
  linkType: string;
  link: string;
  embedUrl?: string | null;
}) {
  if (item.linkType !== "YOUTUBE_VIDEO") return {};
  const videoId = getYouTubeId(item.link) ?? getYouTubeId(item.embedUrl);
  if (!videoId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enter a valid YouTube video link.",
    });
  }
  return {
    link: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: videoId,
    platform: "YouTube",
  };
}

export const contentRouter = createTRPCRouter({
  youtubeMetadata: adminProcedure
    .input(z.object({ link: z.string() }))
    .query(async ({ input }) => {
      const videoId = getYouTubeId(input.link);
      if (!videoId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter a valid YouTube video link.",
        });
      const url = new URL("https://www.youtube.com/oembed");
      url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
      url.searchParams.set("format", "json");
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
          throw new Error("YouTube did not return video details");
        const metadata = z
          .object({ title: z.string(), author_name: z.string() })
          .parse(await response.json());
        return {
          videoId,
          title: metadata.title,
          author: metadata.author_name,
          thumbnailUrl: youtubeThumbnail(videoId),
        };
      } catch {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message:
            "Couldn't load the YouTube details. You can still enter them yourself.",
        });
      }
    }),
  getAll: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.toLowerCase().trim();

      const where = search
        ? {
            OR: [
              { type: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
              {
                description: { contains: search, mode: "insensitive" as const },
              },
              { dj: { contains: search, mode: "insensitive" as const } },
              { platform: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : undefined;

      const items = await ctx.db.contentItem.findMany({
        where,
        orderBy: { date: "desc" },
        include: CONTENT_ARTWORK_INCLUDE,
      });
      return items.map(withContentArtwork);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.contentItem.findUnique({
        where: { id: input.id },
        include: CONTENT_ARTWORK_INCLUDE,
      });
      return item ? withContentArtwork(item) : null;
    }),

  /**
   * Bounded search for the admin pickers. `getAll` deliberately stays unbounded
   * because the public page and the admin table both want everything; a picker
   * does not, and `total` lets it say how much is behind the fold instead of
   * quietly truncating. `excludeIds` drops items already placed, from both the
   * page and the count.
   */
  search: adminProcedure
    .input(
      z.object({
        query: z.string().default(""),
        excludeIds: z.array(z.string()).default([]),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.query.trim();
      const where = {
        ...(input.excludeIds.length > 0
          ? { id: { notIn: input.excludeIds } }
          : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { type: { contains: q, mode: "insensitive" as const } },
                { dj: { contains: q, mode: "insensitive" as const } },
                { platform: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.db.contentItem.findMany({
          where,
          orderBy: { date: "desc" },
          take: input.limit,
          select: {
            id: true,
            type: true,
            title: true,
            dj: true,
            platform: true,
            date: true,
          },
        }),
        ctx.db.contentItem.count({ where }),
      ]);

      return { items, total, isRecent: q.length === 0 };
    }),

  /**
   * The `type` and `platform` values already in use. Both columns are free text,
   * so without this the editor invites a fourth spelling of "mix" — and platform
   * casing decides whether the public card finds an icon at all.
   */
  facets: adminProcedure.query(async ({ ctx }) => {
    const [types, platforms] = await Promise.all([
      ctx.db.contentItem.groupBy({
        by: ["type"],
        _count: { _all: true },
        orderBy: { _count: { type: "desc" } },
      }),
      ctx.db.contentItem.groupBy({
        by: ["platform"],
        _count: { _all: true },
        orderBy: { _count: { platform: "desc" } },
      }),
    ]);

    return {
      types: types
        .filter((row) => row.type.trim().length > 0)
        .map((row) => ({ value: row.type, count: row._count._all })),
      platforms: platforms
        .filter(
          (row): row is typeof row & { platform: string } =>
            typeof row.platform === "string" && row.platform.trim().length > 0,
        )
        .map((row) => ({ value: row.platform, count: row._count._all })),
    };
  }),

  create: adminProcedure
    .input(
      z.object({
        type: z.string().min(1),
        linkType: ContentLinkTypeSchema.optional(),
        title: z.string().min(1),
        // Nullish rather than optional so the editor can send one payload shape
        // for both create and update instead of translating empties twice.
        dj: z.string().nullish(),
        description: z.string().default(""),
        date: z.date(),
        link: z.string().min(1),
        platform: z.string().nullish(),
        embedUrl: z.string().nullish(),
        imageFileUploadId: z.string().min(1).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.imageFileUploadId)
        await assertContentArtwork(ctx.db, input.imageFileUploadId);
      return ctx.db.contentItem.create({
        data: {
          ...input,
          dj: input.dj ?? null,
          platform: input.platform ?? null,
          embedUrl: input.embedUrl ?? null,
          linkType: input.linkType ?? "OTHER",
          ...youtubeFields({ ...input, linkType: input.linkType ?? "OTHER" }),
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.string().min(1).optional(),
        linkType: ContentLinkTypeSchema.optional(),
        title: z.string().min(1).optional(),
        dj: z.string().optional().nullable(),
        description: z.string().optional(),
        date: z.date().optional(),
        link: z.string().min(1).optional(),
        platform: z.string().optional().nullable(),
        embedUrl: z.string().optional().nullable(),
        imageFileUploadId: z.string().min(1).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.imageFileUploadId)
        await assertContentArtwork(ctx.db, data.imageFileUploadId);
      const existing =
        data.linkType !== undefined ||
        data.link !== undefined ||
        data.embedUrl !== undefined
          ? await ctx.db.contentItem.findUniqueOrThrow({ where: { id } })
          : null;
      return ctx.db.contentItem.update({
        where: { id },
        data: {
          ...data,
          ...(existing ? youtubeFields({ ...existing, ...data }) : {}),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentItem.delete({
        where: { id: input.id },
      });
    }),
});
