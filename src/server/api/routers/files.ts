import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { uploadBufferToS3, softDeleteFile, deleteFile, limits } from "~/lib/s3Helper";
import { FileUploadStatus, type file_upload, type file_tag } from "~Prisma/client";

// Revalidation time for file queries (5 minutes)
const FILE_CACHE_SECONDS = 300;

type LinkedEntity = { type: string; id: string; title: string } | null;
type FileTag = { id: string; name: string; description: string | null };
type EnrichedFile = file_upload & { linkedEntity: LinkedEntity; fileTags: FileTag[] };

/**
 * Helper to enrich files with linked entity info using for/forId
 */
async function enrichFilesWithLinkedEntities<T extends file_upload & { fileTags?: FileTag[] }>(
  db: any,
  files: T[]
): Promise<(T & { linkedEntity: LinkedEntity; fileTags: FileTag[] })[]> {
  // Group files by their "for" type
  const gigMediaFiles = files.filter((f) => f.for === "gig_media");
  const gigFiles = files.filter((f) => f.for === "gig");

  // Fetch linked gig media items
  const gigMediaIds = gigMediaFiles.map((f) => f.forId);
  const gigMediaItems: Array<{ id: string; gig: { id: string; title: string } | null }> = gigMediaIds.length > 0
    ? await db.gigMedia.findMany({
      where: { id: { in: gigMediaIds } },
      include: {
        gig: {
          select: { id: true, title: true },
        },
      },
    })
    : [];
  const gigMediaMap = new Map(gigMediaItems.map((m) => [m.id, m]));

  // Fetch linked gigs directly
  const gigIds = gigFiles.map((f) => f.forId);
  const gigs: Array<{ id: string; title: string }> = gigIds.length > 0
    ? await db.gig.findMany({
      where: { id: { in: gigIds } },
      select: { id: true, title: true },
    })
    : [];
  const gigMap = new Map(gigs.map((g) => [g.id, g]));

  // Enrich files with linked entity info
  return files.map((f) => {
    let linkedEntity: LinkedEntity = null;

    if (f.for === "gig_media") {
      const mediaItem = gigMediaMap.get(f.forId);
      if (mediaItem?.gig) {
        linkedEntity = { type: "gig", id: mediaItem.gig.id, title: mediaItem.gig.title };
      }
    } else if (f.for === "gig") {
      const gig = gigMap.get(f.forId);
      if (gig) {
        linkedEntity = { type: "gig", id: gig.id, title: gig.title };
      }
    }

    return { ...f, linkedEntity, fileTags: f.fileTags ?? [] };
  });
}

export const filesRouter = createTRPCRouter({
  /**
   * Get all files with pagination and filtering
   * Cached for 5 minutes
   */
  getAll: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        for: z.string().optional(),
        forId: z.string().optional(),
        status: z.nativeEnum(FileUploadStatus).optional(),
        search: z.string().optional(),
        mimeTypePrefix: z.string().optional(), // e.g., "image/" or "video/"
        tagIds: z.array(z.string()).optional(), // Filter by tag IDs
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const page = input?.page ?? 1;
      const skip = (page - 1) * limit;

      const where = {
        ...(input?.for && { for: input.for }),
        ...(input?.forId && { forId: input.forId }),
        ...(input?.status && { status: input.status }),
        ...(input?.mimeTypePrefix && {
          mimeType: { startsWith: input.mimeTypePrefix },
        }),
        ...(input?.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { key: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
        // Filter by tags - files must have ALL specified tags
        ...(input?.tagIds && input.tagIds.length > 0 && {
          fileTags: {
            some: {
              id: { in: input.tagIds },
            },
          },
        }),
        // By default, exclude deleted files
        ...(!input?.status && {
          status: { notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED] },
        }),
      };

      const [files, total] = await Promise.all([
        ctx.db.file_upload.findMany({
          where,
          take: limit,
          skip,
          orderBy: { createdAt: "desc" },
          include: {
            fileTags: {
              select: { id: true, name: true, description: true },
            },
          },
        }),
        ctx.db.file_upload.count({ where }),
      ]);

      // Enrich files with linked entity info
      const enrichedFiles = await enrichFilesWithLinkedEntities(ctx.db, files);

      return {
        files: enrichedFiles,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        // Cache hint for client
        _cacheSeconds: FILE_CACHE_SECONDS,
      };
    }),

  /**
   * Get a single file by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const file = await ctx.db.file_upload.findUnique({
        where: {
          id: input.id,
          status: { notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED] },
        },
      });

      if (!file) return null;

      const enriched = await enrichFilesWithLinkedEntities(ctx.db, [file]);
      return enriched[0];
    }),

  /**
   * Get files for a specific entity (gig, etc.)
   * Cached response
   */
  getForEntity: publicProcedure
    .input(
      z.object({
        for: z.string(),
        forId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const files = await ctx.db.file_upload.findMany({
        where: {
          for: input.for,
          forId: input.forId,
          status: FileUploadStatus.OK,
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        files,
        _cacheSeconds: FILE_CACHE_SECONDS,
      };
    }),

  /**
   * Upload a file via base64 (for smaller files via tRPC)
   * For larger files, use the direct upload endpoint
   */
  uploadBase64: adminProcedure
    .input(
      z.object({
        base64: z.string(),
        name: z.string(),
        mimeType: z.string(),
        for: z.string(),
        forId: z.string(),
        keyPrefix: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Decode base64 to buffer
      const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Check size limit
      if (buffer.length > limits.fileSize) {
        throw new Error(`File size exceeds limit of ${limits.fileSize / 1024 / 1024}MB`);
      }

      // Generate key
      const ext = input.name.split(".").pop() ?? "";
      const uuid = crypto.randomUUID();
      const keyPrefix = input.keyPrefix?.replace(/\/$/, "") ?? `uploads/${input.for}`;
      const key = `${keyPrefix}/${uuid}${ext ? `.${ext}` : ""}`;

      const result = await uploadBufferToS3({
        buffer,
        key,
        contentType: input.mimeType,
        name: input.name,
        fileType: getFileTypeFromMime(input.mimeType),
        for: input.for,
        forId: input.forId,
        acl: "private", // Always use private ACL - admins cannot change this
        userId: ctx.user?.id ?? ctx.session.user.id,
      });

      // Connect tags if provided
      if (input.tagIds && input.tagIds.length > 0 && !result.isDuplicate) {
        await ctx.db.file_upload.update({
          where: { id: result.record.id },
          data: {
            fileTags: {
              connect: input.tagIds.map((id) => ({ id })),
            },
          },
        });
      }

      return result;
    }),

  /**
   * Soft delete a file (mark as deleted but keep in S3)
   */
  softDelete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return softDeleteFile({ id: input.id });
    }),

  /**
   * Permanently delete a file from S3 and database
   */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return deleteFile({ id: input.id });
    }),

  /**
   * Restore a soft-deleted file
   */
  restore: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.file_upload.update({
        where: { id: input.id },
        data: { status: FileUploadStatus.OK },
      });
    }),

  /**
   * Get upload limits configuration (for client-side validation)
   */
  getLimits: publicProcedure.query(() => {
    return {
      maxFileSize: limits.fileSize,
      maxFiles: limits.files,
      maxTotalSize: limits.totalSize,
      maxConcurrency: limits.concurrency,
    };
  }),

  /**
   * Get file statistics for admin dashboard
   */
  getStats: adminProcedure.query(async ({ ctx }) => {
    const [totalFiles, totalSize, byStatus, byFor] = await Promise.all([
      ctx.db.file_upload.count({
        where: { status: { notIn: [FileUploadStatus.DELETED] } },
      }),
      ctx.db.file_upload.aggregate({
        where: { status: FileUploadStatus.OK },
        _sum: { size: true },
      }),
      ctx.db.file_upload.groupBy({
        by: ["status"],
        _count: true,
      }),
      ctx.db.file_upload.groupBy({
        by: ["for"],
        where: { status: FileUploadStatus.OK },
        _count: true,
        _sum: { size: true },
      }),
    ]);

    return {
      totalFiles,
      totalSize: totalSize._sum.size ?? 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byFor: byFor.map((f) => ({
        for: f.for,
        count: f._count,
        size: f._sum.size ?? 0,
      })),
    };
  }),

  /**
   * Update file attributes
   */
  updateFile: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        for: z.string().optional(),
        forId: z.string().optional(),
        status: z.enum(["NO_FILE", "UPLOADING", "OK", "SOFT_DELETED", "DELETED", "ERRORED"]).optional(),
        category: z.enum(["IMAGE", "VIDEO", "AUDIO", "PDF", "DOCUMENT", "FILE"]).optional(),
        tagIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tagIds, ...data } = input;

      const updateData: any = { ...data };

      // Handle tag updates - replace all tags
      if (tagIds !== undefined) {
        updateData.fileTags = {
          set: tagIds.map((tagId) => ({ id: tagId })),
        };
      }

      const updated = await ctx.db.file_upload.update({
        where: { id },
        data: updateData,
        include: {
          fileTags: {
            select: { id: true, name: true, description: true },
          },
        },
      });

      const enriched = await enrichFilesWithLinkedEntities(ctx.db, [updated]);
      return enriched[0];
    }),

  // ============ File Tag Management ============

  /**
   * Get all file tags
   */
  getAllTags: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.file_tag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { fileUploads: true },
        },
      },
    });
  }),

  /**
   * Create a new file tag
   */
  createTag: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        description: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.file_tag.create({
        data: input,
      });
    }),

  /**
   * Update a file tag
   */
  updateTag: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(200).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.file_tag.update({
        where: { id },
        data,
      });
    }),

  /**
   * Delete a file tag
   */
  deleteTag: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.file_tag.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Bulk add tags to multiple files
   */
  bulkAddTags: adminProcedure
    .input(
      z.object({
        fileIds: z.array(z.string()),
        tagIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { fileIds, tagIds } = input;

      // Update each file to connect the tags
      await Promise.all(
        fileIds.map((fileId) =>
          ctx.db.file_upload.update({
            where: { id: fileId },
            data: {
              fileTags: {
                connect: tagIds.map((tagId) => ({ id: tagId })),
              },
            },
          })
        )
      );

      return { success: true, filesUpdated: fileIds.length };
    }),

  /**
   * Bulk remove tags from multiple files
   */
  bulkRemoveTags: adminProcedure
    .input(
      z.object({
        fileIds: z.array(z.string()),
        tagIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { fileIds, tagIds } = input;

      // Update each file to disconnect the tags
      await Promise.all(
        fileIds.map((fileId) =>
          ctx.db.file_upload.update({
            where: { id: fileId },
            data: {
              fileTags: {
                disconnect: tagIds.map((tagId) => ({ id: tagId })),
              },
            },
          })
        )
      );

      return { success: true, filesUpdated: fileIds.length };
    }),
});

/**
 * Helper to determine file type from MIME type
 */
function getFileTypeFromMime(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("document") || mimeType.includes("word")) return "document";
  return "file";
}
