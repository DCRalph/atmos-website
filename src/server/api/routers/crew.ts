import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { logUserActivity } from "~/server/utils/activity-log";
import { uniqueHandleFrom } from "~/server/utils/artist-handles";
import { socialUrlFromInput } from "~/server/utils/artist-socials";
import { mediaFileIdFromUrl } from "~/lib/media-url";
import {
  ActivityType,
  ClaimStatus,
  FileUploadStatus,
  type PrismaClient,
} from "~Prisma/client";

const artistProfileInclude = {
  artistProfile: {
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

const roleSchema = z.string().trim().max(120).nullish();

/**
 * A crew row either points at an artist profile, which supplies its name,
 * photo and socials, or carries all of them itself. Role is the crew row's own
 * in both cases.
 */
const crewDetailsSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("profile"),
    artistProfileId: z.string().min(1),
    role: roleSchema,
  }),
  z.object({
    source: z.literal("manual"),
    name: z.string().trim().min(1).max(120),
    role: roleSchema,
    instagram: z.string().max(500).nullish(),
    soundcloud: z.string().max(500).nullish(),
    image: z
      .string()
      .trim()
      .min(1, "Add a photo for crew members without an artist profile"),
  }),
]);

/**
 * The columns to write for a set of crew details. A linked row keeps its
 * manual fields untouched, so switching back to manual restores them; its
 * `name` tracks the profile so search and confirmations read naturally.
 */
async function crewRowData(
  db: PrismaClient,
  details: z.infer<typeof crewDetailsSchema>,
) {
  const role = details.role || null;
  if (details.source === "manual") {
    return {
      artistProfileId: null,
      name: details.name,
      role,
      instagram: socialUrlFromInput("instagram", details.instagram),
      soundcloud: socialUrlFromInput("soundcloud", details.soundcloud),
      image: details.image,
    };
  }
  const profile = await db.artistProfile.findUnique({
    where: { id: details.artistProfileId },
    select: { id: true, displayName: true },
  });
  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Artist profile not found.",
    });
  }
  return { artistProfileId: profile.id, name: profile.displayName, role };
}

export const crewRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.crewMember.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: artistProfileInclude,
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.crewMember.findUnique({
        where: { id: input.id },
        include: artistProfileInclude,
      });
    }),

  /** Adds a crew member to the end of the crew page. */
  create: adminProcedure
    .input(crewDetailsSchema)
    .mutation(async ({ ctx, input }) => {
      const data = await crewRowData(ctx.db, input);
      const { _max } = await ctx.db.crewMember.aggregate({
        _max: { sortOrder: true },
      });
      const created = await ctx.db.crewMember.create({
        data: { ...data, sortOrder: (_max.sortOrder ?? -1) + 1 },
        include: artistProfileInclude,
      });
      if (created.artistProfile) {
        await logUserActivity(
          ActivityType.CREW_MEMBER_PROFILE_LINKED,
          `Added @${created.artistProfile.handle} to the crew`,
          ctx.session.user.id,
          undefined,
          { crewMemberId: created.id, artistProfileId: created.artistProfile.id },
        );
      }
      return created;
    }),

  update: adminProcedure
    .input(z.object({ id: z.string(), details: crewDetailsSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.crewMember.findUnique({
        where: { id: input.id },
        select: { name: true, artistProfileId: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crew member not found.",
        });
      }
      const data = await crewRowData(ctx.db, input.details);
      const updated = await ctx.db.crewMember.update({
        where: { id: input.id },
        data,
        include: artistProfileInclude,
      });

      if (data.artistProfileId !== existing.artistProfileId) {
        if (updated.artistProfile) {
          await logUserActivity(
            ActivityType.CREW_MEMBER_PROFILE_LINKED,
            `Linked crew member ${existing.name} to artist profile @${updated.artistProfile.handle}`,
            ctx.session.user.id,
            undefined,
            { crewMemberId: input.id, artistProfileId: updated.artistProfile.id },
          );
        } else {
          await logUserActivity(
            ActivityType.CREW_MEMBER_PROFILE_UNLINKED,
            `Unlinked artist profile from crew member ${existing.name}`,
            ctx.session.user.id,
            undefined,
            {
              crewMemberId: input.id,
              previousArtistProfileId: existing.artistProfileId,
            },
          );
        }
      }
      return updated;
    }),

  /**
   * Turns a manual crew row into an unclaimed artist profile and links it, so
   * the person gets a profile page and line-up attributions. The row's photo
   * carries over when it was uploaded rather than a legacy `/public` path.
   */
  makeProfile: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.crewMember.findUnique({
        where: { id: input.id },
      });
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Crew member not found.",
        });
      }
      if (member.artistProfileId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This crew member already has an artist profile.",
        });
      }

      const photoId = mediaFileIdFromUrl(member.image);
      const photo = photoId
        ? await ctx.db.file_upload.findFirst({
            where: { id: photoId, status: FileUploadStatus.OK },
            select: { id: true },
          })
        : null;
      const handle = await uniqueHandleFrom(ctx.db, member.name);
      const socials = [
        { platform: "instagram", url: member.instagram },
        { platform: "soundcloud", url: member.soundcloud },
      ].flatMap(({ platform, url }, sortOrder) =>
        url ? [{ platform, url, sortOrder }] : [],
      );

      const profile = await ctx.db.$transaction(async (tx) => {
        const created = await tx.artistProfile.create({
          data: {
            handle,
            displayName: member.name,
            createdByAdminId: ctx.session.user.id,
            claimStatus: ClaimStatus.UNCLAIMED,
            avatarFileId: photo?.id ?? null,
            socials: { create: socials },
          },
        });
        await tx.crewMember.update({
          where: { id: member.id },
          data: { artistProfileId: created.id },
        });
        return created;
      });

      await logUserActivity(
        ActivityType.ARTIST_PROFILE_CREATED,
        `Created unclaimed artist profile @${profile.handle} from crew member ${member.name}`,
        ctx.session.user.id,
        undefined,
        { profileId: profile.id, crewMemberId: member.id },
      );
      return { profileId: profile.id, handle: profile.handle };
    }),

  /** Saves the crew page order after a drag. `ids` is every row, top first. */
  reorder: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.crewMember.count({
        where: { id: { in: input.ids } },
      });
      const total = await ctx.db.crewMember.count();
      if (count !== input.ids.length || count !== total) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The crew list changed. Refresh and try again.",
        });
      }
      await ctx.db.$transaction(
        input.ids.map((id, sortOrder) =>
          ctx.db.crewMember.update({ where: { id }, data: { sortOrder } }),
        ),
      );
      return { ok: true as const };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.crewMember.delete({
        where: { id: input.id },
      });
    }),
});
