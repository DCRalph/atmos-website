import { z } from "zod";
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

export const contentRouter = createTRPCRouter({
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

      return ctx.db.contentItem.findMany({
        where,
        orderBy: { date: "desc" },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.contentItem.findUnique({
        where: { id: input.id },
      });
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
        description: z.string().min(1),
        date: z.date(),
        link: z.string().min(1),
        platform: z.string().nullish(),
        embedUrl: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentItem.create({
        data: {
          ...input,
          dj: input.dj ?? null,
          platform: input.platform ?? null,
          embedUrl: input.embedUrl ?? null,
          linkType: input.linkType ?? "OTHER",
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
        description: z.string().min(1).optional(),
        date: z.date().optional(),
        link: z.string().min(1).optional(),
        platform: z.string().optional().nullable(),
        embedUrl: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.contentItem.update({
        where: { id },
        data,
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
