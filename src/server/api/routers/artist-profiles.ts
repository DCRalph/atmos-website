import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  APPEARANCE_ORDER,
  APPEARANCE_SELECT,
  APPEARANCE_WHERE,
  toGigAttributions,
} from "~/server/artist-appearances";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  artistProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { logUserActivity } from "~/server/utils/activity-log";
import { resolveTargetProfileId } from "~/server/utils/artist-profile-access";
import { HANDLE_REGEX, uniqueHandleFrom } from "~/server/utils/artist-handles";
import { resolveSocialPlatform } from "~/lib/social-pills";
import {
  setProfileSocial,
  socialUrlFromInput,
} from "~/server/utils/artist-socials";
import { grantUserPermission } from "~/server/utils/permissions";
import { isOwnTheme } from "~/server/artist-public-profile";
import { GRID } from "~/lib/artist-grid";
import { readLayout } from "~/lib/artist-sections";
import { zArtistTheme } from "~/lib/artist-theme";
import {
  ActivityType,
  ClaimStatus,
  FileUploadStatus,
  type PrismaClient,
} from "~Prisma/client";

const handleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(
    HANDLE_REGEX,
    "Handle must be 3-30 chars, lowercase a-z, 0-9, _ or - only",
  );

const blockInputSchema = z.object({
  /** The block's row, when it has one. */
  id: z.string().optional(),
  /** The editor's own id for the block, to map a new row back to it. */
  clientId: z.string().max(40).optional(),
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
    "PAST_GIGS",
    "CONTENT_LIST",
    "DIVIDER",
    "SPACER",
    "CUSTOM_EMBED",
  ]),
  x: z
    .number()
    .int()
    .min(0)
    .max(GRID.cols - 1),
  y: z.number().int().min(0).max(100_000),
  w: z.number().int().min(1).max(GRID.cols),
  h: z.number().int().min(1).max(5_000),
  data: z.record(z.string(), z.any()).default({}),
});

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
  themeId: z.string().nullish(),
});

const socialInputSchema = z.object({
  id: z.string().optional(),
  platform: z.string().min(1).max(40),
  url: z.string().url().max(500),
  label: z.string().max(80).nullish(),
  sortOrder: z.number().int().default(0),
});

/**
 * Confirms a file id refers to a usable image before a profile points at it.
 * The upload itself is already constrained by its preset; this guards against
 * a caller passing the id of a deleted or non-image file.
 */
async function assertUsableImage(db: PrismaClient, fileId: string) {
  const file = await db.file_upload.findUnique({
    where: { id: fileId },
    select: { id: true, status: true, mimeType: true },
  });
  if (!file) {
    throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
  }
  if (file.status !== FileUploadStatus.OK) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "File is not available",
    });
  }
  if (!file.mimeType.startsWith("image/")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "File must be an image",
    });
  }
  return file;
}

/** Whether two JSON values are equal, whatever order their keys are in. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((k) =>
      sameJson(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    )
  );
}

/** A theme the caller may put on a profile: shared, a starter, or theirs. */
async function assertThemeUsable(
  ctx: { db: PrismaClient; session: { user: { id: string } } },
  themeId: string,
  isAdmin: boolean,
) {
  const theme = await ctx.db.artistProfileTheme.findUnique({
    where: { id: themeId },
    select: { ownerUserId: true, isPublic: true, isSystem: true },
  });
  if (!theme) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Theme not found" });
  }
  const readable =
    theme.isPublic ||
    theme.isSystem ||
    isAdmin ||
    theme.ownerUserId === ctx.session.user.id;
  if (!readable) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot use this theme",
    });
  }
}

export const artistProfilesRouter = createTRPCRouter({
  // ---------- Public reads ----------
  // Admin only: it returns the raw rows, drafts and TBA gigs included, and
  // the public pages read `PUBLIC_PROFILE_INCLUDE` and `publicSummary` instead.
  getByHandle: adminProcedure
    .input(z.object({ handle: handleSchema }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.artistProfile.findUnique({
        where: { handle: input.handle },
        include: {
          blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
          socials: { orderBy: { sortOrder: "asc" } },
          themeRef: true,
          // The gigs this artist is on, one row each. A run sheet row carries
          // set times and internal notes, so this names the columns rather than
          // including the row: an artist page is public.
          scheduleItems: {
            distinct: ["gigId"],
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              role: true,
              gig: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  subtitle: true,
                  gigStartTime: true,
                  gigEndTime: true,
                  posterFileUploadId: true,
                  isTba: true,
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

  /**
   * Everything the line-up popover on a gig page draws: who the artist is,
   * every gig they have done for us, and the two links out.
   *
   * Not `getByHandle`, which also carries blocks, the theme and the linked user
   * row, none of which a popover renders. Set times and run sheet notes stay
   * behind for the same reason they do in `toPublicLineUp`: this is public.
   */
  publicSummary: publicProcedure
    .input(z.object({ handle: handleSchema }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.artistProfile.findUnique({
        where: { handle: input.handle.toLowerCase() },
        select: {
          id: true,
          handle: true,
          displayName: true,
          tagline: true,
          avatarFileId: true,
          isPublished: true,
          socials: {
            select: { platform: true, url: true },
            orderBy: { sortOrder: "asc" },
          },
          setAppearances: {
            where: APPEARANCE_WHERE,
            orderBy: APPEARANCE_ORDER,
            select: APPEARANCE_SELECT,
          },
        },
      });
      if (!profile) return null;

      // The stored `platform` is free text, so the URL is the fallback tell.
      const instagram = profile.socials.find(
        (social) =>
          resolveSocialPlatform(social.platform, social.url)?.id ===
          "instagram",
      );

      return {
        id: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
        tagline: profile.tagline,
        avatarFileId: profile.avatarFileId,
        isPublished: profile.isPublished,
        instagramUrl: instagram?.url ?? null,
        gigs: toGigAttributions(profile.setAppearances).map((entry) => ({
          role: entry.role,
          ...entry.gig,
        })),
      };
    }),

  // ---------- Owner & admin reads ----------
  getMine: artistProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.artistProfile.findUnique({
      where: { userId: ctx.session.user.id },
      include: {
        blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
        socials: { orderBy: { sortOrder: "asc" } },
        themeRef: true,
      },
    });
    return profile;
  }),

  /**
   * Create the current user's profile if they are an ARTIST (or ADMIN) and
   * don't already have one. Returns the existing profile if they do.
   */
  ensureMine: artistProcedure
    .input(
      z.object({
        handle: handleSchema.optional(),
        displayName: z.string().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.artistProfile.findUnique({
        where: { userId: ctx.session.user.id },
      });
      if (existing) return existing;

      if (input.handle) {
        const taken = await ctx.db.artistProfile.findUnique({
          where: { handle: input.handle },
          select: { id: true },
        });
        if (taken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That handle is taken. Try another.",
          });
        }
      }
      const fallbackHandle =
        input.handle ??
        (await generateUniqueHandle(ctx.db, ctx.session.user.id));

      const created = await ctx.db.artistProfile.create({
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
        ActivityType.ARTIST_PROFILE_CREATED,
        `Created own artist profile @${created.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId: created.id },
      );
      return created;
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.artistProfile.findUnique({
        where: { id: input.id },
        include: {
          blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
          socials: { orderBy: { sortOrder: "asc" } },
          themeRef: true,
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
      const profiles = await ctx.db.artistProfile.findMany({
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
          socials: {
            orderBy: { sortOrder: "asc" },
            select: { platform: true, url: true },
          },
          crewMembers: { select: { id: true, role: true } },
          _count: { select: { blocks: true } },
        },
      });

      // Counted here because `_count` counts rows, and an artist can hold two
      // of them for one night: an opening set and a closing one, or a solo slot
      // and a back to back.
      const appearances = await ctx.db.gigSetArtist.findMany({
        where: { artistProfileId: { in: profiles.map((row) => row.id) } },
        select: { artistProfileId: true, item: { select: { gigId: true } } },
      });
      const seenPairs = new Set<string>();
      const gigCounts = new Map<string, number>();
      for (const appearance of appearances) {
        const pair = `${appearance.artistProfileId}:${appearance.item.gigId}`;
        if (seenPairs.has(pair)) continue;
        seenPairs.add(pair);
        gigCounts.set(
          appearance.artistProfileId,
          (gigCounts.get(appearance.artistProfileId) ?? 0) + 1,
        );
      }

      return profiles.map((profile) => ({
        ...profile,
        gigCount: gigCounts.get(profile.id) ?? 0,
      }));
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
      const { profileId, isAdmin } = await resolveTargetProfileId(
        ctx,
        input.profileId,
      );
      if (input.data.handle) {
        const clash = await ctx.db.artistProfile.findFirst({
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
      if (input.data.themeId) {
        await assertThemeUsable(ctx, input.data.themeId, isAdmin);
      }
      const updated = await ctx.db.artistProfile.update({
        where: { id: profileId },
        data: input.data,
      });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_UPDATED,
        `Updated artist profile @${updated.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId },
      );
      return updated;
    }),

  /**
   * The admin "core details" save: name, handle and the two socials the crew
   * page and line-ups read. Instagram and SoundCloud take a handle or a URL,
   * and an empty value removes the link. Other socials are left alone.
   */
  updateCore: adminProcedure
    .input(
      z.object({
        profileId: z.string(),
        displayName: z.string().trim().min(1).max(120),
        handle: handleSchema,
        instagram: z.string().trim().max(500),
        soundcloud: z.string().trim().max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clash = await ctx.db.artistProfile.findFirst({
        where: { handle: input.handle, NOT: { id: input.profileId } },
        select: { id: true },
      });
      if (clash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Handle is already taken",
        });
      }

      const instagram = socialUrlFromInput("instagram", input.instagram);
      const soundcloud = socialUrlFromInput("soundcloud", input.soundcloud);

      const updated = await ctx.db.$transaction(async (tx) => {
        await setProfileSocial(tx, input.profileId, "instagram", instagram);
        await setProfileSocial(tx, input.profileId, "soundcloud", soundcloud);
        return tx.artistProfile.update({
          where: { id: input.profileId },
          data: { displayName: input.displayName, handle: input.handle },
        });
      });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_UPDATED,
        `Updated core details for @${updated.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId: input.profileId },
      );
      return updated;
    }),

  /**
   * Point the profile at an already-uploaded avatar.
   *
   * The file itself arrives through the shared upload system
   * (`useUpload("artistAvatar")`); this only moves the FK and retires the
   * image it replaces.
   */
  setAvatar: protectedProcedure
    .input(
      z.object({
        profileId: z.string().optional(),
        fileId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const file = await assertUsableImage(ctx.db, input.fileId);

      const prev = await ctx.db.artistProfile.findUnique({
        where: { id: profileId },
        select: { avatarFileId: true, handle: true },
      });

      await ctx.db.artistProfile.update({
        where: { id: profileId },
        data: { avatarFileId: file.id },
      });

      await logUserActivity(
        ActivityType.ARTIST_PROFILE_UPDATED,
        `Updated profile photo for @${prev?.handle ?? profileId}`,
        ctx.session.user.id,
        undefined,
        { profileId, avatarFileId: file.id },
      );
      return { avatarFileId: file.id };
    }),

  /** Point the profile at an already-uploaded banner. */
  setBanner: protectedProcedure
    .input(
      z.object({
        profileId: z.string().optional(),
        fileId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const file = await assertUsableImage(ctx.db, input.fileId);

      const prev = await ctx.db.artistProfile.findUnique({
        where: { id: profileId },
        select: { bannerFileId: true, handle: true },
      });

      await ctx.db.artistProfile.update({
        where: { id: profileId },
        data: { bannerFileId: file.id },
      });

      await logUserActivity(
        ActivityType.ARTIST_PROFILE_UPDATED,
        `Updated banner image for @${prev?.handle ?? profileId}`,
        ctx.session.user.id,
        undefined,
        { profileId, bannerFileId: file.id },
      );
      return { bannerFileId: file.id };
    }),

  clearAvatar: protectedProcedure
    .input(z.object({ profileId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const prev = await ctx.db.artistProfile.findUnique({
        where: { id: profileId },
        select: { avatarFileId: true, handle: true },
      });
      if (!prev?.avatarFileId) {
        return { ok: true as const, avatarFileId: null as string | null };
      }
      await ctx.db.artistProfile.update({
        where: { id: profileId },
        data: { avatarFileId: null },
      });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_UPDATED,
        `Removed profile photo from @${prev.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId },
      );
      return { ok: true as const, avatarFileId: null as string | null };
    }),

  clearBanner: protectedProcedure
    .input(z.object({ profileId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const prev = await ctx.db.artistProfile.findUnique({
        where: { id: profileId },
        select: { bannerFileId: true, handle: true },
      });
      if (!prev?.bannerFileId) {
        return { ok: true as const, bannerFileId: null as string | null };
      }
      await ctx.db.artistProfile.update({
        where: { id: profileId },
        data: { bannerFileId: null },
      });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_UPDATED,
        `Removed banner image from @${prev.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId },
      );
      return { ok: true as const, bannerFileId: null as string | null };
    }),

  publish: protectedProcedure
    .input(z.object({ profileId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const updated = await ctx.db.artistProfile.update({
        where: { id: profileId },
        data: { isPublished: true },
      });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_PUBLISHED,
        `Published artist profile @${updated.handle}`,
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
      const updated = await ctx.db.artistProfile.update({
        where: { id: profileId },
        data: { isPublished: false },
      });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_UNPUBLISHED,
        `Unpublished artist profile @${updated.handle}`,
        ctx.session.user.id,
        undefined,
        { profileId },
      );
      return updated;
    }),

  /**
   * Replace a profile's blocks with the page editor's. Blocks without a row
   * (new ones, or ones deleted by an earlier save and brought back by undo)
   * are created; the answer maps each one's `clientId` (or the stale `id`) to
   * its new row so the editor's next save updates rather than recreates it.
   * Stamps the layout with today's row height (see `readLayout`).
   */
  saveLayout: protectedProcedure
    .input(
      z.object({
        profileId: z.string().optional(),
        blocks: z.array(blockInputSchema).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const [profile, existing] = await Promise.all([
        ctx.db.artistProfile.findUniqueOrThrow({
          where: { id: profileId },
          select: { rowHeightPx: true, gridCols: true },
        }),
        ctx.db.artistBlock.findMany({
          where: { profileId },
          select: {
            id: true,
            type: true,
            x: true,
            y: true,
            w: true,
            h: true,
            data: true,
          },
        }),
      ]);
      const rows = new Map(existing.map((b) => [b.id, b]));
      // A layout saved in older units is rewritten whole, in today's.
      const rescaled =
        profile.rowHeightPx !== GRID.row || profile.gridCols !== GRID.cols;
      const keepIds = new Set(
        input.blocks.flatMap((b) => (b.id ? [b.id] : [])),
      );
      const toDelete = existing.flatMap((b) =>
        keepIds.has(b.id) ? [] : [b.id],
      );
      const created: Record<string, string> = {};

      // Each autosave sends every block, so rows that haven't changed are
      // left alone: most saves touch a handful.
      await ctx.db.$transaction(
        async (tx) => {
          if (toDelete.length) {
            await tx.artistBlock.deleteMany({
              where: { id: { in: toDelete }, profileId },
            });
          }
          for (const { id, clientId, ...block } of input.blocks) {
            const fields = {
              type: block.type,
              x: block.x,
              y: block.y,
              w: block.w,
              h: block.h,
              data: block.data as object,
            };
            const row = id ? rows.get(id) : undefined;
            if (row) {
              const same =
                !rescaled &&
                row.type === fields.type &&
                row.x === fields.x &&
                row.y === fields.y &&
                row.w === fields.w &&
                row.h === fields.h &&
                sameJson(row.data, fields.data);
              if (!same)
                await tx.artistBlock.update({
                  where: { id: row.id },
                  data: fields,
                });
            } else {
              const made = await tx.artistBlock.create({
                data: { profileId, ...fields },
                select: { id: true },
              });
              const key = clientId ?? id;
              if (key) created[key] = made.id;
            }
          }
          if (rescaled) {
            await tx.artistProfile.update({
              where: { id: profileId },
              data: { rowHeightPx: GRID.row, gridCols: GRID.cols },
            });
          }
        },
        { timeout: 20_000 },
      );
      return { created };
    }),

  /**
   * Put a theme on a profile from the page editor. Answers with whether
   * later changes go into it or into a copy (see `isOwnTheme`).
   */
  setTheme: protectedProcedure
    .input(z.object({ profileId: z.string().optional(), themeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { profileId, isAdmin } = await resolveTargetProfileId(
        ctx,
        input.profileId,
      );
      await assertThemeUsable(ctx, input.themeId, isAdmin);
      const profile = await ctx.db.artistProfile.update({
        where: { id: profileId },
        data: { themeId: input.themeId },
        select: {
          userId: true,
          themeRef: {
            select: {
              id: true,
              name: true,
              isSystem: true,
              isPublic: true,
              ownerUserId: true,
              _count: { select: { profiles: true } },
            },
          },
        },
      });
      const theme = profile.themeRef;
      if (!theme) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        theme: {
          id: theme.id,
          name: theme.name,
          own: isOwnTheme(
            { ...theme, profiles: theme._count.profiles },
            profile.userId,
          ),
        },
      };
    }),

  /**
   * Change the look of a profile from the page editor. A theme made for this
   * page is changed in place; a starter, someone else's theme or one shared
   * with other pages is copied into a new theme for this page first, so no
   * other page changes. The profile's own accent override is cleared, since
   * the accent being set here is the one the artist sees.
   */
  customizeTheme: protectedProcedure
    .input(
      z.object({
        profileId: z.string().optional(),
        tokens: zArtistTheme,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { profileId } = await resolveTargetProfileId(ctx, input.profileId);
      const profile = await ctx.db.artistProfile.findUniqueOrThrow({
        where: { id: profileId },
        select: {
          userId: true,
          displayName: true,
          handle: true,
          themeRef: {
            select: {
              id: true,
              name: true,
              isSystem: true,
              isPublic: true,
              ownerUserId: true,
              _count: { select: { profiles: true } },
            },
          },
        },
      });
      const current = profile.themeRef;
      const inPlace =
        current &&
        isOwnTheme(
          { ...current, profiles: current._count.profiles },
          profile.userId,
        );

      const theme = await ctx.db.$transaction(async (tx) => {
        const saved = inPlace
          ? await tx.artistProfileTheme.update({
              where: { id: current.id },
              data: { tokens: input.tokens },
              select: { id: true, name: true },
            })
          : await tx.artistProfileTheme.create({
              data: {
                name: `${profile.displayName}'s theme`.slice(0, 80),
                description: current ? `Started from ${current.name}` : null,
                ownerUserId: profile.userId,
                isPublic: false,
                isSystem: false,
                tokens: input.tokens,
              },
              select: { id: true, name: true },
            });
        await tx.artistProfile.update({
          where: { id: profileId },
          data: { themeId: saved.id, accentColor: null },
        });
        return saved;
      });

      if (!inPlace) {
        await logUserActivity(
          ActivityType.ARTIST_THEME_CREATED,
          `Made a theme for @${profile.handle} from the page editor`,
          ctx.session.user.id,
          undefined,
          { themeId: theme.id, profileId },
        );
      }
      return { theme: { ...theme, own: true } };
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
        await tx.artistSocial.deleteMany({ where: { profileId } });
        if (input.socials.length) {
          await tx.artistSocial.createMany({
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

  /**
   * A free handle derived from a display name, for the quick-create form. Keeps
   * handle slugging and collision-suffixing in one place instead of guessing in
   * the browser and finding out on submit.
   */
  suggestHandle: adminProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const trimmed = input.name.trim();
      if (!trimmed) return { handle: "" };
      return { handle: await uniqueHandleFrom(ctx.db, trimmed) };
    }),

  /** Live check for a hand-edited handle, so conflicts surface before submit. */
  handleAvailable: adminProcedure
    .input(z.object({ handle: z.string() }))
    .query(async ({ ctx, input }) => {
      const handle = input.handle.trim().toLowerCase();
      const parsed = handleSchema.safeParse(handle);
      if (!parsed.success) {
        return {
          available: false,
          reason: parsed.error.issues[0]?.message ?? "Invalid handle",
        };
      }
      const existing = await ctx.db.artistProfile.findUnique({
        where: { handle },
        select: { id: true },
      });
      return existing
        ? { available: false, reason: "Handle is already taken" }
        : { available: true, reason: null };
    }),

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
      const existing = await ctx.db.artistProfile.findUnique({
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
        const userProfile = await ctx.db.artistProfile.findUnique({
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

      const created = await ctx.db.artistProfile.create({
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
      if (input.userId) {
        await grantUserPermission(input.userId, "ARTIST", {
          createdBy: ctx.session.user.id,
        });
      }
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_CREATED,
        input.userId
          ? `Created artist profile @${created.handle} linked to user ${input.userId}`
          : `Created unclaimed artist profile @${created.handle}`,
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
        ctx.db.artistProfile.findUnique({ where: { id: input.profileId } }),
        ctx.db.artistProfile.findUnique({ where: { userId: input.userId } }),
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
          // Both layouts in today's grid units, the moved blocks under the
          // ones already here.
          const [kept, moved] = await Promise.all([
            tx.artistBlock.findMany({ where: { profileId: input.profileId } }),
            tx.artistBlock.findMany({ where: { profileId: existingMine.id } }),
          ]);
          const keptLayout = readLayout(kept, profile.rowHeightPx);
          const below = Math.max(0, ...keptLayout.map((b) => b.y + b.h));
          const movedLayout = readLayout(moved, existingMine.rowHeightPx).map(
            (b) => ({ ...b, y: b.y + below }),
          );
          for (const b of [...keptLayout, ...movedLayout]) {
            await tx.artistBlock.update({
              where: { id: b.id },
              data: {
                profileId: input.profileId,
                x: b.x,
                y: b.y,
                w: b.w,
                h: b.h,
              },
            });
          }
          await tx.artistProfile.update({
            where: { id: input.profileId },
            data: { rowHeightPx: GRID.row, gridCols: GRID.cols },
          });
          await tx.artistSocial.updateMany({
            where: { profileId: existingMine.id },
            data: { profileId: input.profileId },
          });
          await tx.gigSetArtist.updateMany({
            where: { artistProfileId: existingMine.id },
            data: { artistProfileId: input.profileId },
          });
          await tx.artistProfile.delete({ where: { id: existingMine.id } });
        });
      }
      const updated = await ctx.db.artistProfile.update({
        where: { id: input.profileId },
        data: { userId: input.userId, claimStatus: ClaimStatus.ACTIVE },
      });
      await grantUserPermission(input.userId, "ARTIST", {
        createdBy: ctx.session.user.id,
      });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_LINKED,
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
      const profile = await ctx.db.artistProfile.findUnique({
        where: { id: input.profileId },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.artistProfile.update({
        where: { id: input.profileId },
        data: { userId: null, claimStatus: ClaimStatus.UNCLAIMED },
      });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_UNLINKED,
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
      const profile = await ctx.db.artistProfile.findUnique({
        where: { id: input.id },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.artistProfile.delete({ where: { id: input.id } });
      await logUserActivity(
        ActivityType.ARTIST_PROFILE_DELETED,
        `Deleted artist profile @${profile.handle}`,
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
      const profile = await ctx.db.artistProfile.findUnique({
        where: { id: input.profileId },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      if (profile.claimStatus === ClaimStatus.ACTIVE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Profile already claimed",
        });
      }
      const existing = await ctx.db.artistClaimRequest.findFirst({
        where: {
          profileId: input.profileId,
          requestingUserId: ctx.session.user.id,
          status: "PENDING",
        },
      });
      if (existing) return existing;
      const req = await ctx.db.artistClaimRequest.create({
        data: {
          profileId: input.profileId,
          requestingUserId: ctx.session.user.id,
          message: input.message ?? null,
          status: "PENDING",
        },
      });
      await ctx.db.artistProfile.update({
        where: { id: input.profileId },
        data: { claimStatus: ClaimStatus.PENDING_CLAIM },
      });
      await logUserActivity(
        ActivityType.ARTIST_CLAIM_REQUESTED,
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
      return ctx.db.artistClaimRequest.findMany({
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
      const req = await ctx.db.artistClaimRequest.findUnique({
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
        await tx.artistProfile.update({
          where: { id: req.profileId },
          data: {
            userId: req.requestingUserId,
            claimStatus: ClaimStatus.ACTIVE,
          },
        });
        await tx.artistClaimRequest.update({
          where: { id: req.id },
          data: {
            status: "APPROVED",
            decidedByAdminId: ctx.session.user.id,
            decidedAt: new Date(),
          },
        });
        // Reject any other pending claims on this profile
        await tx.artistClaimRequest.updateMany({
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
      await grantUserPermission(req.requestingUserId, "ARTIST", {
        createdBy: ctx.session.user.id,
      });
      await logUserActivity(
        ActivityType.ARTIST_CLAIM_APPROVED,
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
      const req = await ctx.db.artistClaimRequest.findUnique({
        where: { id: input.requestId },
        include: { profile: true },
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.artistClaimRequest.update({
        where: { id: req.id },
        data: {
          status: "REJECTED",
          decidedByAdminId: ctx.session.user.id,
          decidedAt: new Date(),
        },
      });
      // If no more pending on this profile, flip back to UNCLAIMED
      const remaining = await ctx.db.artistClaimRequest.count({
        where: { profileId: req.profileId, status: "PENDING" },
      });
      if (remaining === 0 && req.profile.claimStatus === "PENDING_CLAIM") {
        await ctx.db.artistProfile.update({
          where: { id: req.profileId },
          data: { claimStatus: ClaimStatus.UNCLAIMED },
        });
      }
      await logUserActivity(
        ActivityType.ARTIST_CLAIM_REJECTED,
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
  return uniqueHandleFrom(db, user?.name ?? user?.email ?? "artist");
}
