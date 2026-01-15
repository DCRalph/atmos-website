import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { getTodayRangeStart, getTodayRangeEnd, isGigUpcoming } from "~/lib/date-utils";
import { uploadBufferToS3, softDeleteFile } from "~/lib/s3Helper";
import { FileUploadStatus, type GigMedia } from "~Prisma/client";
import { toWebPMax } from "~/lib/sparpImage";

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

async function getFileUploadInfoById(db: any, fileUploadId: string | null): Promise<FileUploadInfo> {
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
  if ([FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED].includes(fileUpload.status)) return null;

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
 * Helper to enrich gig media with file upload data
 * Uses for="gig_media" and forId=mediaId to find associated files
 */
async function enrichMediaWithFileUploads<T extends GigMedia>(
  db: any,
  media: T[]
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
      status: { notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED] },
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

  const users = userIds.length > 0
    ? await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
    : [];

  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const fileUploadMap = new Map<string, FileUploadInfo>(
    fileUploads.map((f: any) => [f.id, {
      ...f,
      uploadedBy: f.userId ? userMap.get(f.userId) ?? null : null,
    }])
  );

  return media.map((m) => ({
    ...m,
    fileUpload: m.fileUploadId ? fileUploadMap.get(m.fileUploadId) ?? null : null,
  }));
}

/**
 * Helper to enrich multiple gigs with file upload data
 */
async function enrichGigsWithFileUploads<T extends { media: GigMedia[] }>(
  db: any,
  gigs: T[]
): Promise<(Omit<T, 'media'> & { media: EnrichedMedia[] })[]> {
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
      status: { notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED] },
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

  const users = userIds.length > 0
    ? await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
    : [];

  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const fileUploadMap = new Map<string, FileUploadInfo>(
    fileUploads.map((f: any) => [f.id, {
      ...f,
      uploadedBy: f.userId ? userMap.get(f.userId) ?? null : null,
    }])
  );

  return gigs.map((g) => ({
    ...g,
    media: g.media.map((m) => ({
      ...m,
      fileUpload: m.fileUploadId ? fileUploadMap.get(m.fileUploadId) ?? null : null,
    })),
  }));
}

export const gigsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.toLowerCase().trim();

      const where = search
        ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { subtitle: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
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
              { createdAt: "asc" }
            ],
          },
          gigTags: {
            include: {
              gigTag: true,
            },
          },
        },
      });

      return enrichGigsWithFileUploads(ctx.db, gigs);
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
            orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          },
          gigTags: {
            include: {
              gigTag: true,
            },
          },
        },
        take: Math.max(20, pastLimit + 10),
      });

      const enriched = await enrichGigsWithFileUploads(ctx.db, gigs);

      const featuredCandidates = enriched.filter((g) => g.isFeatured);
      const featuredGig = featuredCandidates[0] ?? null;

      const pastGigs = enriched
        .filter((g) => (featuredGig ? g.id !== featuredGig.id : true))
        .slice(0, pastLimit);

      return { featuredGig, pastGigs };
    }),

  getUpcoming: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const gigs = await ctx.db.gig.findMany({
      where: {
        gigEndTime: {
          gte: now,
        },
      },
      orderBy: { gigStartTime: "asc" },
      include: {
        media: {
          orderBy: [
            { section: "asc" },
            { sortOrder: "asc" },
            { createdAt: "asc" }
          ],
        },
        gigTags: {
          include: {
            gigTag: true,
          },
        },
      },
    });

    return enrichGigsWithFileUploads(ctx.db, gigs);
  }),

  getPast: publicProcedure
    .input(z.object({
      limit: z.number(),
    }).optional()
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();

      const gigs = await ctx.db.gig.findMany({
        where: {
          gigEndTime: {
            lt: now,
          },
        },
        orderBy: [{ pastSortOrder: "asc" }, { gigEndTime: "desc" }],
        include: {
          media: {
            orderBy: [
              { section: "asc" },
              { sortOrder: "asc" },
              { createdAt: "asc" }
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

      return enrichGigsWithFileUploads(ctx.db, gigs);
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
            { createdAt: "asc" }
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

    return enrichedGigs;
  }),

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
              { createdAt: "asc" }
            ],
          },
          gigTags: {
            include: {
              gigTag: true,
            },
          },
        },
      });

      if (!gig) return null;

      const enrichedMedia = await enrichMediaWithFileUploads(ctx.db, gig.media);
      const posterFileUpload = await getFileUploadInfoById(ctx.db, gig.posterFileUploadId ?? null);
      return { ...gig, media: enrichedMedia, posterFileUpload };
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        subtitle: z.string().min(1),
        description: z.string().optional(),
        gigStartTime: z.date(),
        gigEndTime: z.date().optional(),
        ticketLink: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.gig.create({
        data: input,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        subtitle: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        gigStartTime: z.date().optional(),
        gigEndTime: z.date().optional().nullable(),
        ticketLink: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.gig.update({
        where: { id },
        data,
      });
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
   * Add media via base64 upload to S3
   */
  uploadMedia: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        base64: z.string(),
        name: z.string(),
        mimeType: z.string(),
        section: z.enum(["featured", "gallery"]).default("gallery"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Decode base64 to buffer
      const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const resized = await toWebPMax(buffer, { maxSizePx: 2048, quality: 80 });

      // Determine type from mimeType
      const type = input.mimeType.startsWith("video/") ? "video" : "photo";

      // Get max sort order for section first
      const maxOrder = await ctx.db.gigMedia.aggregate({
        where: { gigId: input.gigId, section: input.section },
        _max: { sortOrder: true },
      });

      // Create GigMedia record first to get the ID
      const media = await ctx.db.gigMedia.create({
        data: {
          gigId: input.gigId,
          type,
          section: input.section,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });

      // Upload to S3 with for="gig_media" and forId=media.id
      const ext = input.name.split(".").pop() ?? "";
      const uuid = crypto.randomUUID();
      const key = `gigs/${input.gigId}/${uuid}${ext ? `.${ext}` : ""}`;

      const uploadResult = await uploadBufferToS3({
        buffer: resized.buffer,
        key,
        contentType: resized.contentType,
        name: input.name,
        fileType: type,
        for: "gig_media",
        forId: media.id,
        acl: "public-read",
        userId: ctx.user?.id ?? ctx.session.user.id,
        width: resized.width,
        height: resized.height,
      });

      // If duplicate, delete the created GigMedia record and return warning
      if (uploadResult.isDuplicate) {
        await ctx.db.gigMedia.delete({ where: { id: media.id } });
        return {
          isDuplicate: true,
          warning: uploadResult.warning,
          existingFileId: uploadResult.record.id,
          existingUrl: uploadResult.url,
          existingName: uploadResult.record.name,
        };
      }

      // Update GigMedia with the file upload ID
      const updatedMedia = await ctx.db.gigMedia.update({
        where: { id: media.id },
        data: { fileUploadId: uploadResult.record.id },
      });

      return {
        isDuplicate: false,
        ...updatedMedia,
        fileUpload: {
          id: uploadResult.record.id,
          url: uploadResult.url,
          name: input.name,
          mimeType: input.mimeType,
          status: FileUploadStatus.OK,
        },
      };
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
          const enriched = await enrichMediaWithFileUploads(ctx.db, [updatedMedia]);
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
    .input(z.object({
      id: z.string(),
      deleteFile: z.boolean().default(false),
    }))
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
          })
        )
      );

      // Return updated media for the gig
      const media = await ctx.db.gigMedia.findMany({
        where: { gigId: input.gigId },
        orderBy: [
          { section: "asc" },
          { sortOrder: "asc" },
        ],
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
        where: { id: input.mediaId }
      });

      if (!media) {
        throw new Error("Media not found");
      }

      // Get max sort order for target section
      const maxOrder = await ctx.db.gigMedia.aggregate({
        where: { gigId: media.gigId, section: input.targetSection },
        _max: { sortOrder: true },
      });

      const newSortOrder = input.targetIndex ?? (maxOrder._max.sortOrder ?? -1) + 1;

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
        (m) => !m.fileUpload || m.fileUpload.status === FileUploadStatus.OK
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

      const users = userIds.length > 0
        ? await ctx.db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
        : [];

      const userMap = new Map(users.map((u) => [u.id, u]));

      return availableUploads.map((f) => ({
        ...f,
        uploadedBy: f.userId ? userMap.get(f.userId) ?? null : null,
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

  uploadPoster: adminProcedure
    .input(
      z.object({
        gigId: z.string(),
        base64: z.string(),
        name: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.mimeType.startsWith("image/")) {
        throw new Error("Poster must be an image");
      }

      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: { id: true, posterFileUploadId: true },
      });
      if (!gig) throw new Error("Gig not found");

      const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const resized = await toWebPMax(buffer, { maxSizePx: 2048, quality: 80 });

      const uuid = crypto.randomUUID();
      const key = `gigs/${input.gigId}/poster/${uuid}.webp`;

      const uploadResult = await uploadBufferToS3({
        buffer: resized.buffer,
        key,
        contentType: resized.contentType,
        name: input.name,
        fileType: "image",
        for: "gig",
        forId: input.gigId,
        acl: "public-read",
        userId: ctx.user?.id ?? ctx.session.user.id,
        width: resized.width,
        height: resized.height,
      });

      // If duplicate upload, still allow using it as the poster.
      const nextPosterFileId = uploadResult.record.id;

      await ctx.db.gig.update({
        where: { id: input.gigId },
        data: { posterFileUploadId: nextPosterFileId },
      });

      // Soft-delete previous poster file (if any and different)
      if (gig.posterFileUploadId && gig.posterFileUploadId !== nextPosterFileId) {
        await softDeleteFile({ id: gig.posterFileUploadId });
      }

      const posterFileUpload = await getFileUploadInfoById(ctx.db, nextPosterFileId);
      return { posterFileUpload };
    }),

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
      if (file.status !== FileUploadStatus.OK) throw new Error("File is not available");
      if (!file.mimeType.startsWith("image/")) throw new Error("Poster must be an image");

      await ctx.db.gig.update({
        where: { id: input.gigId },
        data: { posterFileUploadId: input.fileUploadId },
      });

      if (gig.posterFileUploadId && gig.posterFileUploadId !== input.fileUploadId) {
        await softDeleteFile({ id: gig.posterFileUploadId });
      }

      const posterFileUpload = await getFileUploadInfoById(ctx.db, input.fileUploadId);
      return { posterFileUpload };
    }),

  clearPoster: adminProcedure
    .input(z.object({ gigId: z.string(), deleteFile: z.boolean().default(true) }))
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
