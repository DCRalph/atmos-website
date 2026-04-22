import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { logUserActivity } from "~/server/utils/activity-log";
import { ActivityType } from "~Prisma/client";

const creatorProfileInclude = {
  creatorProfile: {
    select: {
      id: true,
      handle: true,
      displayName: true,
      tagline: true,
      avatarFileId: true,
      isPublished: true,
      socials: {
        orderBy: { sortOrder: "asc" as const },
        select: { platform: true, url: true },
      },
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
} as const;

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
        include: creatorProfileInclude,
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.crewMember.findUnique({
        where: { id: input.id },
        include: creatorProfileInclude,
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        role: z.string().nullish(),
        instagram: z.string().nullish(),
        soundcloud: z.string().nullish(),
        image: z.string().nullish(),
        creatorProfileId: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { _max } = await ctx.db.crewMember.aggregate({
        _max: { sortOrder: true },
      });

      const { creatorProfileId, ...rest } = input;
      if (creatorProfileId) {
        const profile = await ctx.db.creatorProfile.findUnique({
          where: { id: creatorProfileId },
          select: { id: true },
        });
        if (!profile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Creator profile not found.",
          });
        }
      } else if (!rest.image) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "An image path is required when a crew member isn't linked to a creator profile.",
        });
      }

      return ctx.db.crewMember.create({
        data: {
          name: rest.name,
          role: rest.role?.trim() || null,
          instagram: rest.instagram?.trim() || null,
          soundcloud: rest.soundcloud?.trim() || null,
          image: rest.image?.trim() || null,
          creatorProfileId: creatorProfileId ?? null,
          sortOrder: (_max.sortOrder ?? -1) + 1,
        },
        include: creatorProfileInclude,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        role: z.string().nullish(),
        instagram: z.string().nullish(),
        soundcloud: z.string().nullish(),
        image: z.string().nullish(),
        creatorProfileId: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, creatorProfileId, ...data } = input;
      if (creatorProfileId) {
        const profile = await ctx.db.creatorProfile.findUnique({
          where: { id: creatorProfileId },
          select: { id: true },
        });
        if (!profile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Creator profile not found.",
          });
        }
      }
      // If caller is clearing the link *and* not providing an image, make sure
      // we don't end up with a crew row that has neither a profile nor an image.
      if (
        creatorProfileId === null &&
        data.image !== undefined &&
        !data.image
      ) {
        const existing = await ctx.db.crewMember.findUnique({
          where: { id },
          select: { image: true, creatorProfileId: true },
        });
        if (existing && !existing.image) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "An image path is required when a crew member isn't linked to a creator profile.",
          });
        }
      }
      return ctx.db.crewMember.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.role !== undefined
            ? { role: data.role?.trim() || null }
            : {}),
          ...(data.instagram !== undefined
            ? { instagram: data.instagram?.trim() || null }
            : {}),
          ...(data.soundcloud !== undefined
            ? { soundcloud: data.soundcloud?.trim() || null }
            : {}),
          ...(data.image !== undefined
            ? { image: data.image?.trim() || null }
            : {}),
          ...(creatorProfileId !== undefined
            ? { creatorProfileId: creatorProfileId ?? null }
            : {}),
        },
        include: creatorProfileInclude,
      });
    }),

  /**
   * Link a creator profile to a crew member. Pass `creatorProfileId: null`
   * to unlink.
   */
  linkCreatorProfile: adminProcedure
    .input(
      z.object({
        id: z.string(),
        creatorProfileId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.crewMember.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, creatorProfileId: true },
      });
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crew member not found.",
        });
      }
      let profileHandle: string | null = null;
      if (input.creatorProfileId) {
        const profile = await ctx.db.creatorProfile.findUnique({
          where: { id: input.creatorProfileId },
          select: { id: true, handle: true },
        });
        if (!profile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Creator profile not found.",
          });
        }
        profileHandle = profile.handle;
      }
      const updated = await ctx.db.crewMember.update({
        where: { id: input.id },
        data: { creatorProfileId: input.creatorProfileId },
        include: creatorProfileInclude,
      });
      if (input.creatorProfileId) {
        await logUserActivity(
          ActivityType.CREW_MEMBER_PROFILE_LINKED,
          `Linked crew member ${member.name} to creator profile @${
            profileHandle ?? input.creatorProfileId
          }`,
          ctx.session.user.id,
          undefined,
          {
            crewMemberId: member.id,
            creatorProfileId: input.creatorProfileId,
          },
        );
      } else if (member.creatorProfileId) {
        await logUserActivity(
          ActivityType.CREW_MEMBER_PROFILE_UNLINKED,
          `Unlinked creator profile from crew member ${member.name}`,
          ctx.session.user.id,
          undefined,
          {
            crewMemberId: member.id,
            previousCreatorProfileId: member.creatorProfileId,
          },
        );
      }
      return updated;
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
