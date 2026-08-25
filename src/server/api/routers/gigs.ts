import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import {
  getTodayRangeStart,
  getTodayRangeEnd,
  isGigUpcoming,
} from "~/lib/date-utils";
import { softDeleteFile } from "~/server/uploads/files";
import { logUserActivity } from "~/server/utils/activity-log";
import {
  ActivityType,
  FileUploadStatus,
  GigMode,
  GigScheduleKind,
  type GigMedia,
} from "~Prisma/client";
import { toPublicLineUp } from "~/lib/run-sheet/line-up";
import { userHasPermission } from "~/server/utils/permissions";
import type { SerializedEditorState } from "lexical";
import { Prisma } from "~Prisma/client";

/**
 * A serialized Lexical editor state. We only check that the value is an
 * object with a `root` key at the boundary; Lexical itself enforces the full
 * schema when it parses the content back into the editor.
 */
const LEXICAL_STATE_SCHEMA = z.custom<SerializedEditorState>(
  (val) =>
    typeof val === "object" &&
    val !== null &&
    "root" in (val as Record<string, unknown>),
  { message: "Invalid Lexical editor state" },
);

/**
 * Convert a user-supplied Lexical state (or explicit null) into a value
 * Prisma accepts for a nullable `Json` column. `undefined` means "leave
 * untouched" and is passed through.
 */
function toLexicalJsonInput(
  value: SerializedEditorState | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as unknown as Prisma.InputJsonValue;
}

/**
 * A gig's run sheet as the admin editor sends it: every row that should exist,
 * in display order. Absent rows are removals, which is why `id` matters — a row
 * that comes back with its id keeps the notifications it has already sent, and a
 * row that comes back without one is new.
 *
 * The line-up is not a separate thing. A `SET` row is a line-up entry; the
 * public bill is built from these and nothing else.
 */
const SCHEDULE_ITEM_INPUT = z
  .array(
    z.object({
      /** Absent on a row that has never been saved. */
      id: z.string().min(1).optional(),
      kind: z.enum(GigScheduleKind),
      /** Who is playing this slot, in billing order. A back to back is two or more. */
      creatorProfileIds: z.array(z.string().min(1)).max(6).default([]),
      label: z.string().max(120).nullish(),
      role: z.string().max(80).nullish(),
      startsAt: z.coerce.date().nullish(),
      endsAt: z.coerce.date().nullish(),
      notes: z.string().max(4000).nullish(),
      /** Minutes before the cue to warn. Capped so a typo cannot warn a week out. */
      leadMinutes: z.array(z.number().int().min(1).max(720)).max(4).default([]),
      /** Narrows the gig's recipients for this cue. Empty means "the gig's list". */
      recipientUserIds: z.array(z.string().min(1)).default([]),
    }),
  )
  .superRefine((rows, ctx) => {
    rows.forEach((row, index) => {
      const artists = uniqueStrings(row.creatorProfileIds);
      if (row.kind === GigScheduleKind.SET && artists.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "A set needs somebody playing it",
          path: [index, "creatorProfileIds"],
        });
      }
      if (row.kind !== GigScheduleKind.SET && artists.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "Only a set carries artists",
          path: [index, "creatorProfileIds"],
        });
      }
      if (row.startsAt && row.endsAt && row.endsAt < row.startsAt) {
        ctx.addIssue({
          code: "custom",
          message: "A row cannot end before it starts",
          path: [index, "endsAt"],
        });
      }
    });
  });

type ScheduleItemInput = z.infer<typeof SCHEDULE_ITEM_INPUT>;

const uniqueStrings = (values: string[]): string[] => [...new Set(values)];

const normalizeRole = (role: string | null | undefined): string | null =>
  role?.trim() ? role.trim() : null;

const normalizeText = (value: string | null | undefined): string | null =>
  value?.trim() ? value.trim() : null;

/**
 * Leads, deduplicated and longest first, so "5, 5, 15" is two warnings and the
 * order they appear in matches the order they arrive.
 */
const uniqueLeads = (minutes: number[]): number[] =>
  [...new Set(minutes)].sort((a, b) => b - a);

/** One run sheet row's columns. `sortOrder` comes from the submitted order. */
const scheduleItemData = (row: ScheduleItemInput[number], index: number) => ({
  kind: row.kind,
  label: normalizeText(row.label),
  role: normalizeRole(row.role),
  startsAt: row.startsAt ?? null,
  endsAt: row.endsAt ?? null,
  notes: normalizeText(row.notes),
  leadMinutes: uniqueLeads(row.leadMinutes),
  sortOrder: index,
});

/** Every distinct artist named by a run sheet, for reference checks. */
const creatorIdsIn = (rows: ScheduleItemInput): string[] =>
  uniqueStrings(rows.flatMap((row) => row.creatorProfileIds));

/**
 * The columns a public line-up is allowed to be built from. Times are absent by
 * construction except where ordering needs them, and ordering is the only thing
 * they are used for — see `toPublicLineUp`.
 */
const LINE_UP_SELECT = {
  id: true,
  kind: true,
  role: true,
  startsAt: true,
  sortOrder: true,
  artists: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      creatorProfile: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarFileId: true,
          tagline: true,
          isPublished: true,
          claimStatus: true,
        },
      },
    },
  },
} satisfies Prisma.GigScheduleItemSelect;

/**
 * Fails cleanly on ids that no longer exist, rather than letting the write hit
 * a foreign key and surface as an opaque 500.
 */
const assertReferencesExist = async (
  db: GigsContext["db"],
  {
    tagIds,
    creatorProfileIds,
    userIds = [],
  }: { tagIds: string[]; creatorProfileIds: string[]; userIds?: string[] },
) => {
  if (userIds.length > 0) {
    const found = await db.user.count({ where: { id: { in: userIds } } });
    if (found !== userIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "One or more of those people no longer has an account",
      });
    }
  }
  if (tagIds.length > 0) {
    const found = await db.gigTag.count({ where: { id: { in: tagIds } } });
    if (found !== tagIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "One or more of those tags no longer exists",
      });
    }
  }
  if (creatorProfileIds.length > 0) {
    const found = await db.creatorProfile.count({
      where: { id: { in: creatorProfileIds } },
    });
    if (found !== creatorProfileIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "One or more of those creator profiles no longer exists",
      });
    }
  }
};

type FileUploadInfo = {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  status: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
  uploadedBy: { id: string; name: string; email: string } | null;
} | null;

type EnrichedMedia = GigMedia & { fileUpload: FileUploadInfo };

const TBA_TITLE = "TBA...";

type GigsContext = {
  session?: { user?: { id: string } } | null;
  db: typeof import("~/server/db").db;
};

const isAdminSession = async (ctx: GigsContext): Promise<boolean> => {
  const userId = ctx.session?.user?.id;
  if (!userId) return false;
  const user = await ctx.db.user.findUnique({
    where: { id: userId },
    include: { permissions: true },
  });
  return user ? userHasPermission(user, "ADMIN") : false;
};

const redactGigForPublic = <T extends { mode?: GigMode }>(gig: T) => {
  if (gig.mode !== GigMode.TO_BE_ANNOUNCED) return gig;
  const redacted = {
    ...gig,
    title: TBA_TITLE,
    subtitle: "",
    shortDescription: "",
    descriptionLexical: null,
    ticketLink: null,
    gigTags: [],
    media: [],
  };
  if ("gigStartTime" in gig) {
    (redacted as { gigStartTime?: Date }).gigStartTime = new Date(0);
  }
  if ("gigEndTime" in gig) {
    (redacted as { gigEndTime?: Date | null }).gigEndTime = null;
  }
  return redacted;
};

const redactGigsForPublic = <T extends { mode?: GigMode }>(gigs: T[]) =>
  gigs.map(redactGigForPublic);

async function getFileUploadInfoById(
  db: any,
  fileUploadId: string | null,
): Promise<FileUploadInfo> {
  if (!fileUploadId) return null;

  const fileUpload = await db.file_upload.findUnique({
    where: { id: fileUploadId },
    select: {
      id: true,
      url: true,
      name: true,
      mimeType: true,
      status: true,
      size: true,
      width: true,
      height: true,
      createdAt: true,
      userId: true,
    },
  });

  if (!fileUpload) return null;
  if (
    [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED].includes(
      fileUpload.status,
    )
  )
    return null;

  const uploadedBy = fileUpload.userId
    ? await db.user.findUnique({
        where: { id: fileUpload.userId },
        select: { id: true, name: true, email: true },
      })
    : null;

  return {
    ...fileUpload,
    uploadedBy,
  };
}

/**
 * Helper to enrich multiple gigs with poster file upload data
 */
async function enrichGigsWithPosterFileUploads<
  T extends { posterFileUploadId: string | null },
>(db: any, gigs: T[]): Promise<(T & { posterFileUpload: FileUploadInfo })[]> {
  const posterFileIds = Array.from(
    new Set(
      gigs
        .map((g) => g.posterFileUploadId)
        .filter((id): id is string => id !== null),
    ),
  );

  if (posterFileIds.length === 0) {
    return gigs.map((g) => ({ ...g, posterFileUpload: null }));
  }

  const fileUploads = await db.file_upload.findMany({
    where: {
      id: { in: posterFileIds },
      status: {
        notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED],
      },
    },
    select: {
      id: true,
      url: true,
      name: true,
      mimeType: true,
      status: true,
      size: true,
      width: true,
      height: true,
      createdAt: true,
      userId: true,
    },
  });

  const userIds = fileUploads
    .map((f: any) => f.userId)
    .filter((id: string | null): id is string => id !== null);

  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const posterMap = new Map<string, FileUploadInfo>(
    fileUploads.map((f: any) => [
      f.id,
      {
        ...f,
        uploadedBy: f.userId ? (userMap.get(f.userId) ?? null) : null,
      },
    ]),
  );

  return gigs.map((g) => ({
    ...g,
    posterFileUpload: g.posterFileUploadId
      ? (posterMap.get(g.posterFileUploadId) ?? null)
      : null,
  }));
}

/**
 * Helper to enrich gig media with file upload data
 * Uses for="gig_media" and forId=mediaId to find associated files
 */
async function enrichMediaWithFileUploads<T extends GigMedia>(
  db: any,
  media: T[],
): Promise<(T & { fileUpload: FileUploadInfo })[]> {
  const fileUploadIds = media
    .map((m) => m.fileUploadId)
    .filter((id): id is string => id !== null);

  if (fileUploadIds.length === 0) {
    return media.map((m) => ({ ...m, fileUpload: null }));
  }

  const fileUploads = await db.file_upload.findMany({
    where: {
      id: { in: fileUploadIds },
      status: {
        notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED],
      },
    },
    select: {
      id: true,
      url: true,
      name: true,
      mimeType: true,
      status: true,
      size: true,
      width: true,
      height: true,
      createdAt: true,
      userId: true,
    },
  });

  // Fetch user info for uploads that have a userId
  const userIds = fileUploads
    .map((f: any) => f.userId)
    .filter((id: string | null): id is string => id !== null);

  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const fileUploadMap = new Map<string, FileUploadInfo>(
    fileUploads.map((f: any) => [
      f.id,
      {
        ...f,
        uploadedBy: f.userId ? (userMap.get(f.userId) ?? null) : null,
      },
    ]),
  );

  return media.map((m) => ({
    ...m,
    fileUpload: m.fileUploadId
      ? (fileUploadMap.get(m.fileUploadId) ?? null)
      : null,
  }));
}

/**
 * Helper to enrich multiple gigs with file upload data
 */
async function enrichGigsWithFileUploads<T extends { media: GigMedia[] }>(
  db: any,
  gigs: T[],
): Promise<(Omit<T, "media"> & { media: EnrichedMedia[] })[]> {
  // Collect all file upload IDs from all gigs
  const allFileUploadIds = gigs
    .flatMap((g) => g.media.map((m) => m.fileUploadId))
    .filter((id): id is string => id !== null);

  if (allFileUploadIds.length === 0) {
    return gigs.map((g) => ({
      ...g,
      media: g.media.map((m) => ({ ...m, fileUpload: null })),
    }));
  }

  const fileUploads = await db.file_upload.findMany({
    where: {
      id: { in: allFileUploadIds },
      status: {
        notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED],
      },
    },
    select: {
      id: true,
      url: true,
      name: true,
      mimeType: true,
      status: true,
      size: true,
      width: true,
      height: true,
      createdAt: true,
      userId: true,
    },
  });

  // Fetch user info for uploads that have a userId
  const userIds = fileUploads
    .map((f: any) => f.userId)
    .filter((id: string | null): id is string => id !== null);

  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const fileUploadMap = new Map<string, FileUploadInfo>(
    fileUploads.map((f: any) => [
      f.id,
      {
        ...f,
        uploadedBy: f.userId ? (userMap.get(f.userId) ?? null) : null,
      },
    ]),
  );

  return gigs.map((g) => ({
    ...g,
    media: g.media.map((m) => ({
      ...m,
      fileUpload: m.fileUploadId
        ? (fileUploadMap.get(m.fileUploadId) ?? null)
        : null,
    })),
  }));
}

export const gigsRouter = createTRPCRouter({
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
              { title: { contains: search, mode: "insensitive" as const } },
              { subtitle: { contains: search, mode: "insensitive" as const } },
              {
                shortDescription: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : undefined;

      const gigs = await ctx.db.gig.findMany({
        where,
        orderBy: { gigStartTime: "desc" },
        include: {
          media: {
            orderBy: [
              { section: "asc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
          gigTags: {
            include: {
              gigTag: true,
            },
          },
        },
      });

      const enriched = await enrichGigsWithFileUploads(ctx.db, gigs);
      const withPosters = await enrichGigsWithPosterFileUploads(
        ctx.db,
        enriched,
      );
      return (await isAdminSession(ctx))
        ? withPosters
        : redactGigsForPublic(withPosters);
    }),

  /**
   * Home page: get a single "featured" past gig and additional past gigs in admin-defined order.
   * - Featured gig is chosen from past gigs where `isFeatured=true`, ordered by `featuredSortOrder`.
   * - Past list excludes the featured gig, ordered by `pastSortOrder`.
   */
  getHomePast: publicProcedure
    .input(
      z
        .object({
          pastLimit: z.number().min(0).max(24).default(2),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const pastLimit = input?.pastLimit ?? 2;

      // Fetch enough rows to reliably build featured+past lists.
      const gigs = await ctx.db.gig.findMany({
        where: {
          gigEndTime: {
            lt: now,
          },
        },
        orderBy: [
          { isFeatured: "desc" },
          { featuredSortOrder: "asc" },
          { pastSortOrder: "asc" },
          { gigEndTime: "desc" },
        ],
        include: {
          media: {
            orderBy: [
              { section: "asc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
          gigTags: {
            include: {
              gigTag: true,
            },
          },
        },
        take: Math.max(20, pastLimit + 10),
      });

      const withMediaUploads = await enrichGigsWithFileUploads(ctx.db, gigs);
      const enriched = await enrichGigsWithPosterFileUploads(
        ctx.db,
        withMediaUploads,
      );

      const featuredCandidates = enriched.filter((g) => g.isFeatured);
      const featuredGig = featuredCandidates[0] ?? null;

      const pastGigs = enriched
        .filter((g) => (featuredGig ? g.id !== featuredGig.id : true))
        .slice(0, pastLimit);

      if (await isAdminSession(ctx)) {
        return { featuredGig, pastGigs };
      }

      return {
        featuredGig: featuredGig ? redactGigForPublic(featuredGig) : null,
        pastGigs: redactGigsForPublic(pastGigs),
      };
    }),

  getUpcoming: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const gigs = await ctx.db.gig.findMany({
      where: {
        // A `TO_BE_ANNOUNCED` gig is a date nobody has picked yet, but
        // `gigStartTime` is not nullable, so it carries a placeholder — and a
        // placeholder in the past used to drop it out of here and into the past
        // list, where it rendered as a show that happened in 1970. It belongs
        // here regardless of what its stand-in date says.
        OR: [
          { gigEndTime: { gte: now } },
          { mode: GigMode.TO_BE_ANNOUNCED },
        ],
      },
      // Announced dates first, in order; anything unannounced after them,
      // rather than sorted by a placeholder into the hero slot on the home
      // screen. Postgres orders an enum by its declaration order, and `NORMAL`
      // is declared first.
      orderBy: [{ mode: "asc" }, { gigStartTime: "asc" }],
      include: {
        media: {
          orderBy: [
            { section: "asc" },
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
        },
        gigTags: {
          include: {
            gigTag: true,
          },
        },
      },
    });

    const enriched = await enrichGigsWithFileUploads(ctx.db, gigs);
    const withPosters = await enrichGigsWithPosterFileUploads(ctx.db, enriched);
    return (await isAdminSession(ctx))
      ? withPosters
      : redactGigsForPublic(withPosters);
  }),

  getPast: publicProcedure
    .input(
      z
        .object({
          limit: z.number(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();

      const gigs = await ctx.db.gig.findMany({
        where: {
          gigEndTime: {
            lt: now,
          },
          // See `getUpcoming`: an unannounced date has not been and gone.
          mode: { not: GigMode.TO_BE_ANNOUNCED },
        },
        orderBy: [{ pastSortOrder: "asc" }, { gigEndTime: "desc" }],
        include: {
          media: {
            orderBy: [
              { section: "asc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
          gigTags: {
            include: {
              gigTag: true,
            },
          },
        },
        take: input?.limit,
      });

      const enriched = await enrichGigsWithFileUploads(ctx.db, gigs);
      const withPosters = await enrichGigsWithPosterFileUploads(
        ctx.db,
        enriched,
      );
      return (await isAdminSession(ctx))
        ? withPosters
        : redactGigsForPublic(withPosters);
    }),

  /**
   * Admin: fetch past gigs with current ordering fields so the UI can reorder them.
   */
  getPastForOrdering: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    return ctx.db.gig.findMany({
      where: {
        gigEndTime: { lt: now },
      },
      orderBy: [
        { isFeatured: "desc" },
        { featuredSortOrder: "asc" },
        { pastSortOrder: "asc" },
        { gigEndTime: "desc" },
      ],
      select: {
        id: true,
        title: true,
        subtitle: true,
        gigStartTime: true,
        gigEndTime: true,
        isFeatured: true,
        featuredSortOrder: true,
        pastSortOrder: true,
      },
    });
  }),

  /**
   * Admin: persist ordering for featured + past gigs.
   * Accepts ordered arrays of IDs. Any gig in `featuredGigIds` becomes featured.
   * Any gig in `pastGigIds` becomes non-featured (and ordered among past).
   */
  updateHomeGigOrdering: adminProcedure
    .input(
      z.object({
        featuredGigIds: z.array(z.string()),
        pastGigIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const allIds = [...input.featuredGigIds, ...input.pastGigIds];
      const unique = new Set(allIds);
      if (unique.size !== allIds.length) {
        throw new Error("Duplicate gig IDs in ordering payload");
      }

      await ctx.db.$transaction([
        ...input.featuredGigIds.map((id, index) =>
          ctx.db.gig.update({
            where: { id },
            data: {
              isFeatured: true,
              featuredSortOrder: index,
            },
          }),
        ),
        ...input.pastGigIds.map((id, index) =>
          ctx.db.gig.update({
            where: { id },
            data: {
              isFeatured: false,
              pastSortOrder: index,
            },
          }),
        ),
      ]);

      return { ok: true };
    }),

  getToday: publicProcedure.query(async ({ ctx }) => {
    // Use UTC time for all comparisons
    const startDate = getTodayRangeStart();
    const endDate = getTodayRangeEnd();

    const todayGigs = await ctx.db.gig.findMany({
      where: {
        // gigStartTime: {
        //   gte: startDate,
        //   lt: endDate,
        // },
      },
      orderBy: { gigStartTime: "asc" },
      include: {
        media: {
          orderBy: [
            { section: "asc" },
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
        },
        gigTags: {
          include: {
            gigTag: true,
          },
        },
      },
    });

    const filteredGigs = todayGigs.filter((gig) => isGigUpcoming(gig));
    const enrichedGigs = await enrichGigsWithFileUploads(ctx.db, filteredGigs);
    const withPosters = await enrichGigsWithPosterFileUploads(
      ctx.db,
      enrichedGigs,
    );

    return (await isAdminSession(ctx))
      ? withPosters
      : redactGigsForPublic(withPosters);
  }),

  /**
   * One gig, for anybody.
   *
   * The line-up is assembled from a select narrow enough that a set time, a
   * note or a non-set cue has nowhere to be. Admins do not get more here; they
   * get `getForEditor`, which is a different procedure with a different guard,
   * so "who can see the run sheet" is answered by tRPC rather than by a branch
   * inside a query somebody has to keep correct.
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.id },
        include: {
          media: {
            orderBy: [
              { section: "asc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
          gigTags: { include: { gigTag: true } },
          scheduleItems: { select: LINE_UP_SELECT },
        },
      });

      if (!gig) return null;

      const enrichedMedia = await enrichMediaWithFileUploads(ctx.db, gig.media);
      const posterFileUpload = await getFileUploadInfoById(
        ctx.db,
        gig.posterFileUploadId ?? null,
      );

      const { scheduleItems, ...rest } = gig;
      const result = {
        ...rest,
        media: enrichedMedia,
        posterFileUpload,
        lineUp: toPublicLineUp(scheduleItems),
      };

      return (await isAdminSession(ctx)) ? result : redactGigForPublic(result);
    }),

  /**
   * Everything the gig editor owns, including the run sheet.
   *
   * Admin-only and deliberately separate from `getById`: the run sheet is
   * internal, and the cheapest way to keep it internal is for the public
   * procedure to have no code path that returns it.
   */
  getForEditor: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.id },
        include: {
          media: {
            orderBy: [
              { section: "asc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
          gigTags: { include: { gigTag: true } },
          scheduleItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              artists: {
                orderBy: { sortOrder: "asc" },
                select: {
                  creatorProfile: {
                    select: {
                      id: true,
                      handle: true,
                      displayName: true,
                      avatarFileId: true,
                      isPublished: true,
                      claimStatus: true,
                    },
                  },
                },
              },
              recipients: { select: { userId: true } },
              // Which cues have already gone out, so "running late" can leave
              // them alone and the row can say it has been announced.
              fires: {
                select: { offsetMinutes: true, skipped: true, createdAt: true },
              },
            },
          },
          notifyRecipients: { select: { userId: true } },
          // Only for seeding the doors row. The two are independent afterwards.
          ticketEvents: { select: { id: true, doorsAt: true } },
        },
      });

      if (!gig) return null;

      const enrichedMedia = await enrichMediaWithFileUploads(ctx.db, gig.media);
      const posterFileUpload = await getFileUploadInfoById(
        ctx.db,
        gig.posterFileUploadId ?? null,
      );

      return { ...gig, media: enrichedMedia, posterFileUpload };
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        subtitle: z.string().min(1),
        shortDescription: z.string().optional(),
        descriptionLexical: LEXICAL_STATE_SCHEMA.optional().nullable(),
        mode: z.nativeEnum(GigMode).optional(),
        gigStartTime: z.date(),
        gigEndTime: z.date().optional(),
        ticketLink: z.string().optional(),
        /** Tags picked before the gig existed. */
        tagIds: z.array(z.string()).default([]),
        /** Run sheet built before the gig existed, in running order. */
        scheduleItems: SCHEDULE_ITEM_INPUT.default([]),
        /** Who hears this gig's cues. */
        notifyUserIds: z.array(z.string().min(1)).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { descriptionLexical, tagIds, scheduleItems, notifyUserIds, ...rest } =
        input;
      const wantedTagIds = uniqueStrings(tagIds);
      const wantedRecipients = uniqueStrings(notifyUserIds);

      await assertReferencesExist(ctx.db, {
        tagIds: wantedTagIds,
        creatorProfileIds: creatorIdsIn(scheduleItems),
        userIds: uniqueStrings([
          ...wantedRecipients,
          ...scheduleItems.flatMap((row) => row.recipientUserIds),
        ]),
      });

      // Nested writes, so a gig never lands without the tags and run sheet that
      // were saved alongside it.
      const created = await ctx.db.gig.create({
        data: {
          ...rest,
          descriptionLexical: toLexicalJsonInput(descriptionLexical),
          ...(wantedTagIds.length > 0
            ? {
                gigTags: {
                  create: wantedTagIds.map((gigTagId) => ({ gigTagId })),
                },
              }
            : {}),
          ...(scheduleItems.length > 0
            ? {
                scheduleItems: {
                  create: scheduleItems.map((row, index) => ({
                    ...scheduleItemData(row, index),
                    artists: {
                      create: uniqueStrings(row.creatorProfileIds).map(
                        (creatorProfileId, billing) => ({
                          creatorProfileId,
                          sortOrder: billing,
                        }),
                      ),
                    },
                    recipients: {
                      create: uniqueStrings(row.recipientUserIds).map(
                        (userId) => ({ userId }),
                      ),
                    },
                  })),
                },
              }
            : {}),
          ...(wantedRecipients.length > 0
            ? {
                notifyRecipients: {
                  create: wantedRecipients.map((userId) => ({ userId })),
                },
              }
            : {}),
        },
      });

      await logUserActivity(
        ActivityType.GIG_CREATED,
        `Created gig "${created.title}"`,
        ctx.session.user.id,
        undefined,
        {
          gigId: created.id,
          tagCount: wantedTagIds.length,
          creatorCount: creatorIdsIn(scheduleItems).length,
        },
      );

      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        subtitle: z.string().min(1).optional(),
        shortDescription: z.string().optional().nullable(),
        descriptionLexical: LEXICAL_STATE_SCHEMA.optional().nullable(),
        mode: z.enum(GigMode).optional(),
        gigStartTime: z.date().optional(),
        gigEndTime: z.date().optional().nullable(),
        ticketLink: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, descriptionLexical, ...rest } = input;
      return ctx.db.gig.update({
        where: { id },
        data: {
          ...rest,
          descriptionLexical: toLexicalJsonInput(descriptionLexical),
        },
      });
    }),

  /**
   * Everything the gig editor owns, written in one transaction: core fields,
   * date/time, tags, the run sheet and who hears it. The editor commits all of
   * it behind a single Save, so a half-applied save — tags written, run sheet
   * not — must not be reachable. `tagIds`, `scheduleItems` and `notifyUserIds`
   * are the complete desired state; anything absent from them is removed.
   */
  saveAll: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        subtitle: z.string().min(1),
        shortDescription: z.string().nullish(),
        descriptionLexical: LEXICAL_STATE_SCHEMA.optional().nullable(),
        mode: z.enum(GigMode),
        ticketLink: z.string().nullish(),
        gigStartTime: z.date(),
        gigEndTime: z.date().nullish(),
        tagIds: z.array(z.string()),
        scheduleItems: SCHEDULE_ITEM_INPUT,
        notifyUserIds: z.array(z.string().min(1)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        id,
        descriptionLexical,
        tagIds,
        scheduleItems,
        notifyUserIds,
        ...rest
      } = input;
      const wantedTagIds = uniqueStrings(tagIds);
      const wantedRecipients = uniqueStrings(notifyUserIds);
      const wantedCreatorIds = creatorIdsIn(scheduleItems);

      const existing = await ctx.db.gig.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          gigTags: { select: { id: true, gigTagId: true } },
          scheduleItems: {
            select: {
              id: true,
              artists: {
                select: {
                  creatorProfileId: true,
                  creatorProfile: { select: { handle: true } },
                },
              },
            },
          },
        },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
      }

      await assertReferencesExist(ctx.db, {
        tagIds: wantedTagIds,
        creatorProfileIds: wantedCreatorIds,
        userIds: uniqueStrings([
          ...wantedRecipients,
          ...scheduleItems.flatMap((row) => row.recipientUserIds),
        ]),
      });

      // A row keeps its id across a save, and with it the record of what has
      // already been announced. Only ids we actually hold are honoured, so a
      // stale draft cannot adopt another gig's row.
      const existingItemIds = new Set(
        existing.scheduleItems.map((row) => row.id),
      );
      const keptItemIds = new Set(
        scheduleItems.flatMap((row) =>
          row.id && existingItemIds.has(row.id) ? [row.id] : [],
        ),
      );
      const removedItems = existing.scheduleItems.filter(
        (row) => !keptItemIds.has(row.id),
      );

      const hadCreatorIds = new Set(
        existing.scheduleItems.flatMap((row) =>
          row.artists.map((artist) => artist.creatorProfileId),
        ),
      );
      const addedCreatorIds = wantedCreatorIds.filter(
        (creatorProfileId) => !hadCreatorIds.has(creatorProfileId),
      );
      // Somebody is off the bill when no slot names them any more, not merely
      // when the slot they were in went away — a back to back that loses one
      // name keeps the other.
      const removedCreators = [...hadCreatorIds]
        .filter((creatorProfileId) => !wantedCreatorIds.includes(creatorProfileId))
        .map((creatorProfileId) => ({
          creatorProfileId,
          handle: existing.scheduleItems
            .flatMap((row) => row.artists)
            .find((artist) => artist.creatorProfileId === creatorProfileId)
            ?.creatorProfile.handle,
        }));

      // Legacy rows: `gig_tag_relationship` has no unique constraint, so the
      // same tag can appear twice. Keep the first row per tag and drop the rest.
      const firstTagRowIds = new Map<string, string>();
      const duplicateTagRowIds: string[] = [];
      for (const row of existing.gigTags) {
        if (firstTagRowIds.has(row.gigTagId)) duplicateTagRowIds.push(row.id);
        else firstTagRowIds.set(row.gigTagId, row.id);
      }
      const newTagIds = wantedTagIds.filter(
        (tagId) => !firstTagRowIds.has(tagId),
      );

      await ctx.db.$transaction(async (tx) => {
        await tx.gig.update({
          where: { id },
          data: {
            ...rest,
            descriptionLexical: toLexicalJsonInput(descriptionLexical),
          },
        });

        // Spelled out rather than leaning on `notIn: []` semantics: clearing
        // every tag has to actually clear every tag.
        await tx.gigTagRelationship.deleteMany({
          where:
            wantedTagIds.length > 0
              ? {
                  gigId: id,
                  OR: [
                    { gigTagId: { notIn: wantedTagIds } },
                    { id: { in: duplicateTagRowIds } },
                  ],
                }
              : { gigId: id },
        });
        if (newTagIds.length > 0) {
          await tx.gigTagRelationship.createMany({
            data: newTagIds.map((gigTagId) => ({ gigId: id, gigTagId })),
          });
        }

        if (removedItems.length > 0) {
          await tx.gigScheduleItem.deleteMany({
            where: { id: { in: removedItems.map((row) => row.id) } },
          });
        }

        // Sequential on purpose: `sortOrder` comes from the submitted order and
        // (gigId, sortOrder) is a plain index, so transient overlap is fine.
        for (const [index, row] of scheduleItems.entries()) {
          const data = scheduleItemData(row, index);
          const recipients = uniqueStrings(row.recipientUserIds);
          const itemId =
            row.id && existingItemIds.has(row.id)
              ? (
                  await tx.gigScheduleItem.update({
                    where: { id: row.id },
                    data,
                    select: { id: true },
                  })
                ).id
              : (
                  await tx.gigScheduleItem.create({
                    data: { ...data, gigId: id },
                    select: { id: true },
                  })
                ).id;

          // Billing order changes as often as the line-up does, and the rows
          // carry nothing else, so they are replaced rather than reconciled.
          const artists = uniqueStrings(row.creatorProfileIds);
          await tx.gigSetArtist.deleteMany({ where: { itemId } });
          if (artists.length > 0) {
            await tx.gigSetArtist.createMany({
              data: artists.map((creatorProfileId, billing) => ({
                itemId,
                creatorProfileId,
                sortOrder: billing,
              })),
            });
          }

          await tx.gigScheduleRecipient.deleteMany({
            where:
              recipients.length > 0
                ? { itemId, userId: { notIn: recipients } }
                : { itemId },
          });
          if (recipients.length > 0) {
            await tx.gigScheduleRecipient.createMany({
              data: recipients.map((userId) => ({ itemId, userId })),
              skipDuplicates: true,
            });
          }
        }

        await tx.gigNotifyRecipient.deleteMany({
          where:
            wantedRecipients.length > 0
              ? { gigId: id, userId: { notIn: wantedRecipients } }
              : { gigId: id },
        });
        if (wantedRecipients.length > 0) {
          await tx.gigNotifyRecipient.createMany({
            data: wantedRecipients.map((userId) => ({ gigId: id, userId })),
            skipDuplicates: true,
          });
        }
      });

      await logUserActivity(
        ActivityType.GIG_UPDATED,
        `Updated gig "${rest.title}"`,
        ctx.session.user.id,
        undefined,
        { gigId: id },
      );
      for (const creatorProfileId of addedCreatorIds) {
        await logUserActivity(
          ActivityType.GIG_CREATOR_ADDED,
          `Added a creator to gig "${rest.title}"`,
          ctx.session.user.id,
          undefined,
          { gigId: id, creatorProfileId },
        );
      }
      for (const row of removedCreators) {
        await logUserActivity(
          ActivityType.GIG_CREATOR_REMOVED,
          `Removed @${row.handle ?? "someone"} from gig "${rest.title}"`,
          ctx.session.user.id,
          undefined,
          { gigId: id, creatorProfileId: row.creatorProfileId },
        );
      }

      return { ok: true as const };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gig.delete({
        where: { id: input.id },
      });
    }),

  // Media management endpoints

  /**
   * Add media via URL (legacy support)
   */
  addMedia: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        type: z.enum(["photo", "video"]),
        url: z.string().url(),
        section: z.enum(["featured", "gallery"]).default("gallery"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get max sort order for section
      const maxOrder = await ctx.db.gigMedia.aggregate({
        where: { gigId: input.gigId, section: input.section },
        _max: { sortOrder: true },
      });

      return ctx.db.gigMedia.create({
        data: {
          gigId: input.gigId,
          type: input.type,
          url: input.url,
          section: input.section,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
    }),

  /**
   * Update media properties
   */
  updateMedia: adminProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.enum(["photo", "video"]).optional(),
        url: z.string().url().optional(),
        section: z.enum(["featured", "gallery"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // If moving to a new section, get max sort order for that section
      if (data.section) {
        const media = await ctx.db.gigMedia.findUnique({ where: { id } });
        if (media && media.section !== data.section) {
          const maxOrder = await ctx.db.gigMedia.aggregate({
            where: { gigId: media.gigId, section: data.section },
            _max: { sortOrder: true },
          });
          const updatedMedia = await ctx.db.gigMedia.update({
            where: { id },
            data: {
              ...data,
              sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
            },
          });
          const enriched = await enrichMediaWithFileUploads(ctx.db, [
            updatedMedia,
          ]);
          return enriched[0];
        }
      }

      const updatedMedia = await ctx.db.gigMedia.update({
        where: { id },
        data,
      });
      const enriched = await enrichMediaWithFileUploads(ctx.db, [updatedMedia]);
      return enriched[0];
    }),

  /**
   * Delete media (and optionally the S3 file)
   */
  deleteMedia: adminProcedure
    .input(
      z.object({
        id: z.string(),
        deleteFile: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const media = await ctx.db.gigMedia.findUnique({
        where: { id: input.id },
      });

      if (!media) {
        throw new Error("Media not found");
      }

      // If deleting the file and there's a linked fileUpload, soft delete it
      if (input.deleteFile && media.fileUploadId) {
        await softDeleteFile({ id: media.fileUploadId });
      }

      // Delete the GigMedia record
      return ctx.db.gigMedia.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Reorder media within a section
   * Accepts an array of media IDs in the desired order
   */
  reorderMedia: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        section: z.enum(["featured", "gallery"]),
        mediaIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Update sort order for each media item
      await Promise.all(
        input.mediaIds.map((id, index) =>
          ctx.db.gigMedia.update({
            where: { id },
            data: { sortOrder: index },
          }),
        ),
      );

      // Return updated media for the gig
      const media = await ctx.db.gigMedia.findMany({
        where: { gigId: input.gigId },
        orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
      });

      return enrichMediaWithFileUploads(ctx.db, media);
    }),

  /**
   * Move media between sections
   */
  moveMediaToSection: adminProcedure
    .input(
      z.object({
        mediaId: z.string(),
        targetSection: z.enum(["featured", "gallery"]),
        targetIndex: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const media = await ctx.db.gigMedia.findUnique({
        where: { id: input.mediaId },
      });

      if (!media) {
        throw new Error("Media not found");
      }

      // Get max sort order for target section
      const maxOrder = await ctx.db.gigMedia.aggregate({
        where: { gigId: media.gigId, section: input.targetSection },
        _max: { sortOrder: true },
      });

      const newSortOrder =
        input.targetIndex ?? (maxOrder._max.sortOrder ?? -1) + 1;

      // If inserting at specific index, shift existing items
      if (input.targetIndex !== undefined) {
        await ctx.db.gigMedia.updateMany({
          where: {
            gigId: media.gigId,
            section: input.targetSection,
            sortOrder: { gte: input.targetIndex },
          },
          data: {
            sortOrder: { increment: 1 },
          },
        });
      }

      const updatedMedia = await ctx.db.gigMedia.update({
        where: { id: input.mediaId },
        data: {
          section: input.targetSection,
          sortOrder: newSortOrder,
        },
      });

      const enriched = await enrichMediaWithFileUploads(ctx.db, [updatedMedia]);
      return enriched[0];
    }),

  /**
   * Get media for a gig with proper ordering
   * Cached endpoint for public display
   */
  getMedia: publicProcedure
    .input(z.object({ gigId: z.string() }))
    .query(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: { mode: true },
      });

      if (
        gig?.mode === GigMode.TO_BE_ANNOUNCED &&
        !(await isAdminSession(ctx))
      ) {
        return { featured: [], gallery: [], all: [] };
      }

      const media = await ctx.db.gigMedia.findMany({
        where: { gigId: input.gigId },
        orderBy: [
          { section: "asc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
      });

      const enrichedMedia = await enrichMediaWithFileUploads(ctx.db, media);

      // Filter out media with deleted files
      const validMedia = enrichedMedia.filter(
        (m) => !m.fileUpload || m.fileUpload.status === FileUploadStatus.OK,
      );

      return {
        featured: validMedia.filter((m) => m.section === "featured"),
        gallery: validMedia.filter((m) => m.section === "gallery"),
        all: validMedia,
      };
    }),

  /**
   * Get all available uploads that can be added to a gig
   * Returns file uploads with for="gig_media" that aren't already linked to this gig
   */
  getAvailableUploads: adminProcedure
    .input(z.object({ gigId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get all file upload IDs already linked to this gig
      const existingMedia = await ctx.db.gigMedia.findMany({
        where: { gigId: input.gigId },
        select: { fileUploadId: true },
      });

      const linkedFileIds = existingMedia
        .map((m) => m.fileUploadId)
        .filter((id): id is string => id !== null);

      // Get all file uploads that are images/videos and not already linked
      const availableUploads = await ctx.db.file_upload.findMany({
        where: {
          status: FileUploadStatus.OK,
          category: { in: ["IMAGE", "VIDEO"] },
          id: { notIn: linkedFileIds },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          url: true,
          name: true,
          mimeType: true,
          size: true,
          width: true,
          height: true,
          createdAt: true,
          category: true,
          userId: true,
        },
      });

      // Fetch user info
      const userIds = availableUploads
        .map((f) => f.userId)
        .filter((id): id is string => id !== null);

      const users =
        userIds.length > 0
          ? await ctx.db.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true },
            })
          : [];

      const userMap = new Map(users.map((u) => [u.id, u]));

      return availableUploads.map((f) => ({
        ...f,
        uploadedBy: f.userId ? (userMap.get(f.userId) ?? null) : null,
      }));
    }),

  /**
   * Add an existing file upload to a gig as media
   */
  addExistingMedia: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        fileUploadId: z.string(),
        section: z.enum(["featured", "gallery"]).default("gallery"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the file upload to determine type
      const fileUpload = await ctx.db.file_upload.findUnique({
        where: { id: input.fileUploadId },
      });

      if (!fileUpload) {
        throw new Error("File upload not found");
      }

      // Determine type from mimeType
      const type = fileUpload.mimeType.startsWith("video/") ? "video" : "photo";

      // Get max sort order for section
      const maxOrder = await ctx.db.gigMedia.aggregate({
        where: { gigId: input.gigId, section: input.section },
        _max: { sortOrder: true },
      });

      // Create the GigMedia record
      const media = await ctx.db.gigMedia.create({
        data: {
          gigId: input.gigId,
          type,
          section: input.section,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          fileUploadId: input.fileUploadId,
        },
      });

      const enriched = await enrichMediaWithFileUploads(ctx.db, [media]);
      return enriched[0];
    }),

  // Poster management endpoints

  setPosterFromUpload: adminProcedure
    .input(z.object({ gigId: z.string(), fileUploadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: { id: true, posterFileUploadId: true },
      });
      if (!gig) throw new Error("Gig not found");

      const file = await ctx.db.file_upload.findUnique({
        where: { id: input.fileUploadId },
        select: { id: true, status: true, mimeType: true },
      });
      if (!file) throw new Error("File upload not found");
      if (file.status !== FileUploadStatus.OK)
        throw new Error("File is not available");
      if (!file.mimeType.startsWith("image/"))
        throw new Error("Poster must be an image");

      await ctx.db.gig.update({
        where: { id: input.gigId },
        data: { posterFileUploadId: input.fileUploadId },
      });

      if (
        gig.posterFileUploadId &&
        gig.posterFileUploadId !== input.fileUploadId
      ) {
        await softDeleteFile({ id: gig.posterFileUploadId });
      }

      const posterFileUpload = await getFileUploadInfoById(
        ctx.db,
        input.fileUploadId,
      );
      return { posterFileUpload };
    }),

  clearPoster: adminProcedure
    .input(
      z.object({ gigId: z.string(), deleteFile: z.boolean().default(true) }),
    )
    .mutation(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: { id: true, posterFileUploadId: true },
      });
      if (!gig) throw new Error("Gig not found");

      await ctx.db.gig.update({
        where: { id: input.gigId },
        data: { posterFileUploadId: null },
      });

      if (input.deleteFile && gig.posterFileUploadId) {
        await softDeleteFile({ id: gig.posterFileUploadId });
      }

      return { ok: true };
    }),

  // Tag management endpoints
  assignTag: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        tagId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if relationship already exists
      const existing = await ctx.db.gigTagRelationship.findFirst({
        where: {
          gigId: input.gigId,
          gigTagId: input.tagId,
        },
      });

      if (existing) {
        return existing;
      }

      return ctx.db.gigTagRelationship.create({
        data: {
          gigId: input.gigId,
          gigTagId: input.tagId,
        },
      });
    }),

  removeTag: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        tagId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const relationship = await ctx.db.gigTagRelationship.findFirst({
        where: {
          gigId: input.gigId,
          gigTagId: input.tagId,
        },
      });

      if (!relationship) {
        throw new Error("Tag relationship not found");
      }

      return ctx.db.gigTagRelationship.delete({
        where: { id: relationship.id },
      });
    }),
});
