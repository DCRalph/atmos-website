import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";

export const crewRouter = createTRPCRouter({
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
              { name: { contains: search, mode: "insensitive" as const } },
              { role: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : undefined;

      return ctx.db.crewMember.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.crewMember.findUnique({
        where: { id: input.id },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        instagram: z.string().optional(),
        soundcloud: z.string().optional(),
        image: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { _max } = await ctx.db.crewMember.aggregate({
        _max: { sortOrder: true },
      });

      return ctx.db.crewMember.create({
        data: {
          ...input,
          sortOrder: (_max.sortOrder ?? -1) + 1,
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
        instagram: z.string().optional().nullable(),
        soundcloud: z.string().optional().nullable(),
        image: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.crewMember.update({
        where: { id },
        data,
      });
    }),

  move: adminProcedure
    .input(
      z.object({
        id: z.string(),
        direction: z.enum(["up", "down"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const crewMembers = await ctx.db.crewMember.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      const currentIndex = crewMembers.findIndex((member) => member.id === input.id);
      if (currentIndex === -1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crew member not found.",
        });
      }

      const targetIndex =
        input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= crewMembers.length) {
        return { ok: true };
      }

      const reorderedMembers = [...crewMembers];
      const [movedMember] = reorderedMembers.splice(currentIndex, 1);
      if (!movedMember) {
        return { ok: true };
      }

      reorderedMembers.splice(targetIndex, 0, movedMember);

      await ctx.db.$transaction(
        reorderedMembers.map((member, index) =>
          ctx.db.crewMember.update({
            where: { id: member.id },
            data: { sortOrder: index },
          }),
        ),
      );

      return { ok: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.crewMember.delete({
        where: { id: input.id },
      });
    }),
});
