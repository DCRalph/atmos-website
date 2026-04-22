import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  creatorProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { userHasRole } from "~/server/utils/roles";
import { logUserActivity } from "~/server/utils/activity-log";
import { uploadBufferToS3, softDeleteFile, limits } from "~/lib/s3Helper";
import { toWebPMax } from "~/lib/sparpImage";
import {
  ActivityType,
  ClaimStatus,
  type CreatorBlockType,
  type PrismaClient,
} from "~Prisma/client";

const HANDLE_REGEX = /^[a-z0-9_-]{3,30}$/;

const handleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(
    HANDLE_REGEX,
    "Handle must be 3-30 chars, lowercase a-z, 0-9, _ or - only",
  );

const blockInputSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    "HEADING",
    "RICH_TEXT",
    "IMAGE",
    "GALLERY",
    "SOUNDCLOUD_TRACK",
    "SOUNDCLOUD_PLAYLIST",
    "YOUTUBE_VIDEO",
    "SPOTIFY_EMBED",
    "SOCIAL_LINKS",
    "LINK_LIST",
    "GIG_LIST",
    "CONTENT_LIST",
    "DIVIDER",
    "SPACER",
    "CUSTOM_EMBED",
  ]),
  x: z.number().int().min(0).max(48),
  y: z.number().int().min(0).max(10_000),
  w: z.number().int().min(1).max(48),
  h: z.number().int().min(1).max(200),
  data: z.record(z.string(), z.any()).default({}),
});

type BlockInput = z.infer<typeof blockInputSchema>;

const profileDataSchema = z.object({
  handle: handleSchema.optional(),
  displayName: z.string().min(1).max(120).optional(),
  tagline: z.string().max(240).nullish(),
  bio: z.string().max(20_000).nullish(),
  avatarFileId: z.string().nullish(),
  bannerFileId: z.string().nullish(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  theme: z.string().max(40).nullish(),
  gridCols: z.number().int().min(4).max(24).optional(),
  rowHeightPx: z.number().int().min(20).max(200).optional(),
});

const socialInputSchema = z.object({
  id: z.string().optional(),
  platform: z.string().min(1).max(40),
  url: z.string().url().max(500),
  label: z.string().max(80).nullish(),
  sortOrder: z.number().int().default(0),
});

/** Ensure the current user can edit the given profile. */
async function assertCanEditProfile(
  ctx: {
    db: PrismaClient;
    session: { user: { id: string } } | null;
  },
  profileId: string,
): Promise<{ profileId: string; isAdmin: boolean }> {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const [profile, user] = await Promise.all([
    ctx.db.creatorProfile.findUnique({
      where: { id: profileId },
      select: { id: true, userId: true },
    }),
    ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: { roles: true },
    }),
  ]);
  if (!profile) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
  }
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const isAdmin = userHasRole(user, "ADMIN");
  if (!isAdmin && profile.userId !== user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot edit this profile",
    });
  }
  return { profileId: profile.id, isAdmin };
}

/**
 * Resolve the target profile id. If `profileId` is provided, verify admin OR
 * owner. If omitted, return the current user's profile (creating one if the
 * user has CREATOR role but no profile yet).
 */
async function resolveTargetProfileId(
  ctx: {
    db: PrismaClient;
    session: { user: { id: string } } | null;
  },
  profileId?: string,
): Promise<{ profileId: string; isAdmin: boolean }> {
  if (profileId) return assertCanEditProfile(ctx, profileId);
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const mine = await ctx.db.creatorProfile.findUnique({
    where: { userId: ctx.session.user.id },
    select: { id: true },
  });
  if (!mine) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No profile for this user yet. Create one first.",
    });
  }
  return { profileId: mine.id, isAdmin: false };
}

export const creatorProfilesRouter = createTRPCRouter({
  // ---------- Public reads ----------
  getByHandle: publicProcedure
    .input(z.object({ handle: handleSchema }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.creatorProfile.findUnique({
        where: { handle: input.handle },
        include: {
          blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
          socials: { orderBy: { sortOrder: "asc" } },
          gigCreators: {
            orderBy: { sortOrder: "asc" },
            include: {
              gig: {
                select: {
                  id: true,
                  title: true,
                  subtitle: true,
                  gigStartTime: true,
                  gigEndTime: true,
                  posterFileUploadId: true,
                  mode: true,
                },
              },
            },
          },
          user: { select: { id: true, name: true, image: true } },
        },
      });
      if (!profile) return null;
      return profile;
    }),

  // ---------- Owner & admin reads ----------
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.creatorProfile.findUnique({
      where: { userId: ctx.session.user.id },
      include: {
        blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
        socials: { orderBy: { sortOrder: "asc" } },
      },
    });
    return profile;
  }),

  /**
   * Create the current user's profile if they are a CREATOR (or ADMIN) and
   * don't already have one. Returns the existing profile if they do.
   */
  ensureMine: creatorProcedure
    .input(
      z.object({
        handle: handleSchema.optional(),
        displayName: z.string().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.creatorProfile.findUnique({
        where: { userId: ctx.session.user.id },
      });
      if (existing) return existing;

      const fallbackHandle =
        input.handle ??
        (await generateUniqueHandle(ctx.db, ctx.session.user.id));

      const created = await ctx.db.creatorProfile.create({
        data: {
          userId: ctx.session.user.id,
          handle: fallbackHandle,
          displayName:
            input.displayName ??
            ctx.user?.name ??
            ctx.session.user.id.slice(0, 8),
          claimStatus: ClaimStatus.ACTIVE,
        },
      });
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_CREATED,
        `Created own creator profile @${created.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId: created.id },
      );
      return created;
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.creatorProfile.findUnique({
        where: { id: input.id },
        include: {
          blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
          socials: { orderBy: { sortOrder: "asc" } },
          user: { select: { id: true, name: true, email: true, image: true } },
          crewMembers: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              name: true,
              role: true,
              image: true,
            },
          },
        },
      });
    }),

  listAll: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          claimStatus: z
            .enum(["ACTIVE", "UNCLAIMED", "PENDING_CLAIM"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.toLowerCase().trim();
      return ctx.db.creatorProfile.findMany({
        where: {
          ...(input?.claimStatus ? { claimStatus: input.claimStatus } : {}),
          ...(search
            ? {
                OR: [
                  {
                    handle: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    displayName: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          _count: {
            select: { blocks: true, gigCreators: true, crewMembers: true },
          },
        },
      });
    }),

  // ---------- Mutations (owner or admin) ----------
  updateProfile: protectedProcedure
    .input(
      z.object({
        profileId: z.string().optional(),
        data: profileDataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      if (input.data.handle) {
        const clash = await ctx.db.creatorProfile.findFirst({
          where: { handle: input.data.handle, NOT: { id: profileId } },
          select: { id: true },
        });
        if (clash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Handle is already taken",
          });
        }
      }
      const updated = await ctx.db.creatorProfile.update({
        where: { id: profileId },
        data: input.data,
      });
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_UPDATED,
        `Updated creator profile @${updated.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId },
      );
      return updated;
    }),

  uploadAvatar: protectedProcedure
    .input(
      z.object({
        profileId: z.string().optional(),
        base64: z.string(),
        name: z.string(),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      if (!input.mimeType.startsWith("image/")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Profile photo must be an image file",
        });
      }
      const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > limits.fileSize) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Image is too large (max ${limits.fileSize / 1024 / 1024}MB before processing)`,
        });
      }
      const resized = await toWebPMax(buffer, {
        maxSizePx: 896,
        quality: 82,
      });
      const id = randomUUID();
      const key = `creator-profiles/${profileId}/avatar-${id}.webp`;
      const uploadResult = await uploadBufferToS3({
        buffer: resized.buffer,
        key,
        contentType: resized.contentType,
        name: `${input.name.replace(/\.[^/.]+$/, "") || "avatar"}.webp`,
        fileType: "photo",
        for: "creator_profile_avatar",
        forId: profileId,
        acl: "public-read",
        userId: ctx.session.user.id,
        width: resized.width,
        height: resized.height,
      });
      const newFileId = uploadResult.record.id;
      const prev = await ctx.db.creatorProfile.findUnique({
        where: { id: profileId },
        select: { avatarFileId: true, handle: true },
      });
      await ctx.db.creatorProfile.update({
        where: { id: profileId },
        data: { avatarFileId: newFileId },
      });
      if (
        prev?.avatarFileId &&
        prev.avatarFileId !== newFileId
      ) {
        try {
          await softDeleteFile({ id: prev.avatarFileId });
        } catch {
          // ignore orphan / already deleted
        }
      }
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_UPDATED,
        `Updated profile photo for @${prev?.handle ?? profileId}`,
        ctx.session.user.id,
        undefined,
        { profileId, avatarFileId: newFileId },
      );
      return { avatarFileId: newFileId };
    }),

  clearAvatar: protectedProcedure
    .input(z.object({ profileId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const prev = await ctx.db.creatorProfile.findUnique({
        where: { id: profileId },
        select: { avatarFileId: true, handle: true },
      });
      if (!prev?.avatarFileId) {
        return { ok: true as const, avatarFileId: null as string | null };
      }
      const oldId = prev.avatarFileId;
      await ctx.db.creatorProfile.update({
        where: { id: profileId },
        data: { avatarFileId: null },
      });
      try {
        await softDeleteFile({ id: oldId });
      } catch {
        // ignore
      }
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_UPDATED,
        `Removed profile photo from @${prev.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId },
      );
      return { ok: true as const, avatarFileId: null as string | null };
    }),

  publish: protectedProcedure
    .input(z.object({ profileId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const updated = await ctx.db.creatorProfile.update({
        where: { id: profileId },
        data: { isPublished: true },
      });
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_PUBLISHED,
        `Published creator profile @${updated.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId },
      );
      return updated;
    }),

  unpublish: protectedProcedure
    .input(z.object({ profileId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const updated = await ctx.db.creatorProfile.update({
        where: { id: profileId },
        data: { isPublished: false },
      });
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_UNPUBLISHED,
        `Unpublished creator profile @${updated.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId },
      );
      return updated;
    }),

  saveLayout: protectedProcedure
    .input(
      z.object({
        profileId: z.string().optional(),
        blocks: z.array(blockInputSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const existing = await ctx.db.creatorBlock.findMany({
        where: { profileId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((b) => b.id));
      const keepIds = new Set(
        input.blocks.map((b) => b.id).filter(Boolean) as string[],
      );
      const toDelete = [...existingIds].filter((id) => !keepIds.has(id));

      await ctx.db.$transaction(async (tx) => {
        if (toDelete.length) {
          await tx.creatorBlock.deleteMany({
            where: { id: { in: toDelete } },
          });
        }
        for (const block of input.blocks) {
          if (block.id && existingIds.has(block.id)) {
            await tx.creatorBlock.update({
              where: { id: block.id },
              data: {
                type: block.type as CreatorBlockType,
                x: block.x,
                y: block.y,
                w: block.w,
                h: block.h,
                data: block.data as object,
              },
            });
          } else {
            await tx.creatorBlock.create({
              data: {
                profileId,
                type: block.type as CreatorBlockType,
                x: block.x,
                y: block.y,
                w: block.w,
                h: block.h,
                data: block.data as object,
              },
            });
          }
        }
        await tx.creatorProfile.update({
          where: { id: profileId },
          data: { updatedAt: new Date() },
        });
      });

      return { ok: true as const };
    }),

  setSocials: protectedProcedure
    .input(
      z.object({
        profileId: z.string().optional(),
        socials: z.array(socialInputSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      await ctx.db.$transaction(async (tx) => {
        await tx.creatorSocial.deleteMany({ where: { profileId } });
        if (input.socials.length) {
          await tx.creatorSocial.createMany({
            data: input.socials.map((s, idx) => ({
              profileId,
              platform: s.platform,
              url: s.url,
              label: s.label ?? null,
              sortOrder: s.sortOrder ?? idx,
            })),
          });
        }
      });
      return { ok: true as const };
    }),

  // ---------- Admin-only: profile creation + claim management ----------
  createProfile: adminProcedure
    .input(
      z.object({
        handle: handleSchema,
        displayName: z.string().min(1).max(120),
        tagline: z.string().max(240).nullish(),
        bio: z.string().max(20_000).nullish(),
        avatarFileId: z.string().nullish(),
        userId: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.creatorProfile.findUnique({
        where: { handle: input.handle },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Handle is already taken",
        });
      }

      if (input.userId) {
        const userProfile = await ctx.db.creatorProfile.findUnique({
          where: { userId: input.userId },
          select: { id: true, handle: true },
        });
        if (userProfile) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `That user already has a profile (@${userProfile.handle})`,
          });
        }
      }

      const created = await ctx.db.creatorProfile.create({
        data: {
          userId: input.userId ?? null,
          createdByAdminId: ctx.session.user.id,
          claimStatus: input.userId
            ? ClaimStatus.ACTIVE
            : ClaimStatus.UNCLAIMED,
          handle: input.handle,
          displayName: input.displayName,
          tagline: input.tagline ?? null,
          bio: input.bio ?? null,
          avatarFileId: input.avatarFileId ?? null,
          isPublished: false,
        },
      });
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_CREATED,
        input.userId
          ? `Created creator profile @${created.handle} linked to user ${input.userId}`
          : `Created unclaimed creator profile @${created.handle}`,
        ctx.session.user.id,
        input.userId ?? undefined,
        { profileId: created.id, linked: Boolean(input.userId) },
      );
      return created;
    }),

  linkUserToProfile: adminProcedure
    .input(
      z.object({
        profileId: z.string(),
        userId: z.string(),
        merge: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [profile, existingMine] = await Promise.all([
        ctx.db.creatorProfile.findUnique({ where: { id: input.profileId } }),
        ctx.db.creatorProfile.findUnique({ where: { userId: input.userId } }),
      ]);
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (existingMine && existingMine.id !== input.profileId) {
        if (!input.merge) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "User already has a profile. Pass merge:true to move their blocks into this profile and delete the duplicate.",
          });
        }
        await ctx.db.$transaction(async (tx) => {
          await tx.creatorBlock.updateMany({
            where: { profileId: existingMine.id },
            data: { profileId: input.profileId },
          });
          await tx.creatorSocial.updateMany({
            where: { profileId: existingMine.id },
            data: { profileId: input.profileId },
          });
          await tx.gigCreator.updateMany({
            where: { creatorProfileId: existingMine.id },
            data: { creatorProfileId: input.profileId },
          });
          await tx.creatorProfile.delete({ where: { id: existingMine.id } });
        });
      }
      const updated = await ctx.db.creatorProfile.update({
        where: { id: input.profileId },
        data: { userId: input.userId, claimStatus: ClaimStatus.ACTIVE },
      });
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_LINKED,
        `Linked profile @${updated.handle} to user ${input.userId}`,
        ctx.session.user.id,
        input.userId,
        { profileId: input.profileId },
      );
      return updated;
    }),

  unlinkUser: adminProcedure
    .input(z.object({ profileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.creatorProfile.findUnique({
        where: { id: input.profileId },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.creatorProfile.update({
        where: { id: input.profileId },
        data: { userId: null, claimStatus: ClaimStatus.UNCLAIMED },
      });
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_UNLINKED,
        `Unlinked user from profile @${updated.handle}`,
        ctx.session.user.id,
        profile.userId ?? undefined,
        { profileId: input.profileId },
      );
      return updated;
    }),

  deleteProfile: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.creatorProfile.findUnique({
        where: { id: input.id },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.creatorProfile.delete({ where: { id: input.id } });
      await logUserActivity(
        ActivityType.CREATOR_PROFILE_DELETED,
        `Deleted creator profile @${profile.handle}`,
        ctx.session.user.id,
        profile.userId ?? undefined,
        { profileId: input.id },
      );
      return { ok: true as const };
    }),

  // ---------- Self-claim flow ----------
  requestClaim: protectedProcedure
    .input(
      z.object({
        profileId: z.string(),
        message: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.creatorProfile.findUnique({
        where: { id: input.profileId },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      if (profile.claimStatus === ClaimStatus.ACTIVE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Profile already claimed",
        });
      }
      const existing = await ctx.db.creatorClaimRequest.findFirst({
        where: {
          profileId: input.profileId,
          requestingUserId: ctx.session.user.id,
          status: "PENDING",
        },
      });
      if (existing) return existing;
      const req = await ctx.db.creatorClaimRequest.create({
        data: {
          profileId: input.profileId,
          requestingUserId: ctx.session.user.id,
          message: input.message ?? null,
          status: "PENDING",
        },
      });
      await ctx.db.creatorProfile.update({
        where: { id: input.profileId },
        data: { claimStatus: ClaimStatus.PENDING_CLAIM },
      });
      await logUserActivity(
        ActivityType.CREATOR_CLAIM_REQUESTED,
        `Requested claim of @${profile.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId: input.profileId },
      );
      return req;
    }),

  listClaimRequests: adminProcedure
    .input(
      z
        .object({
          profileId: z.string().optional(),
          status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.creatorClaimRequest.findMany({
        where: {
          ...(input?.profileId ? { profileId: input.profileId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          profile: { select: { id: true, handle: true, displayName: true } },
          requestingUser: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      });
    }),

  approveClaim: adminProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.creatorClaimRequest.findUnique({
        where: { id: input.requestId },
        include: { profile: true },
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (req.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Request already decided",
        });
      }
      await ctx.db.$transaction(async (tx) => {
        await tx.creatorProfile.update({
          where: { id: req.profileId },
          data: {
            userId: req.requestingUserId,
            claimStatus: ClaimStatus.ACTIVE,
          },
        });
        await tx.creatorClaimRequest.update({
          where: { id: req.id },
          data: {
            status: "APPROVED",
            decidedByAdminId: ctx.session.user.id,
            decidedAt: new Date(),
          },
        });
        // Reject any other pending claims on this profile
        await tx.creatorClaimRequest.updateMany({
          where: {
            profileId: req.profileId,
            id: { not: req.id },
            status: "PENDING",
          },
          data: {
            status: "REJECTED",
            decidedByAdminId: ctx.session.user.id,
            decidedAt: new Date(),
          },
        });
      });
      await logUserActivity(
        ActivityType.CREATOR_CLAIM_APPROVED,
        `Approved claim on @${req.profile.handle}`,
        ctx.session.user.id,
        req.requestingUserId,
        { profileId: req.profileId, requestId: req.id },
      );
      return { ok: true as const };
    }),

  rejectClaim: adminProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.creatorClaimRequest.findUnique({
        where: { id: input.requestId },
        include: { profile: true },
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.creatorClaimRequest.update({
        where: { id: req.id },
        data: {
          status: "REJECTED",
          decidedByAdminId: ctx.session.user.id,
          decidedAt: new Date(),
        },
      });
      // If no more pending on this profile, flip back to UNCLAIMED
      const remaining = await ctx.db.creatorClaimRequest.count({
        where: { profileId: req.profileId, status: "PENDING" },
      });
      if (remaining === 0 && req.profile.claimStatus === "PENDING_CLAIM") {
        await ctx.db.creatorProfile.update({
          where: { id: req.profileId },
          data: { claimStatus: ClaimStatus.UNCLAIMED },
        });
      }
      await logUserActivity(
        ActivityType.CREATOR_CLAIM_REJECTED,
        `Rejected claim on @${req.profile.handle}`,
        ctx.session.user.id,
        req.requestingUserId,
        { profileId: req.profileId, requestId: req.id },
      );
      return { ok: true as const };
    }),
});

/** Suggest a unique handle for a user. */
async function generateUniqueHandle(
  db: PrismaClient,
  userId: string,
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const base = (user?.name ?? user?.email ?? "creator")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const safeBase = HANDLE_REGEX.test(base) ? base : "creator";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? safeBase : `${safeBase}-${i}`;
    const exists = await db.creatorProfile.findUnique({
      where: { handle: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${safeBase}-${Date.now().toString(36).slice(-4)}`;
}
