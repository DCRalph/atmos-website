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

  create: adminProcedure
    .input(
      z.object({
        type: z.string().min(1),
        linkType: ContentLinkTypeSchema.optional(),
        title: z.string().min(1),
        dj: z.string().optional(),
        description: z.string().min(1),
        date: z.date(),
        link: z.string().min(1),
        platform: z.string().optional(),
        embedUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentItem.create({
        data: {
          ...input,
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
