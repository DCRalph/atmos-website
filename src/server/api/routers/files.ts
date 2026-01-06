import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { uploadBufferToS3, softDeleteFile, deleteFile, limits } from "~/lib/s3Helper";
import { FileUploadStatus, type file_upload } from "~Prisma/client";

// Revalidation time for file queries (5 minutes)
const FILE_CACHE_SECONDS = 300;

type LinkedEntity = { type: string; id: string; title: string } | null;
type EnrichedFile = file_upload & { linkedEntity: LinkedEntity };

/**
 * Helper to enrich files with linked entity info using for/forId
 */
async function enrichFilesWithLinkedEntities<T extends file_upload>(
  db: any,
  files: T[]
): Promise<(T & { linkedEntity: LinkedEntity })[]> {
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

    return { ...f, linkedEntity };
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
        cursor: z.string().optional(),
        for: z.string().optional(),
        forId: z.string().optional(),
        status: z.nativeEnum(FileUploadStatus).optional(),
        search: z.string().optional(),
        mimeTypePrefix: z.string().optional(), // e.g., "image/" or "video/"
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const cursor = input?.cursor;

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
        // By default, exclude deleted files
        ...(!input?.status && {
          status: { notIn: [FileUploadStatus.DELETED, FileUploadStatus.SOFT_DELETED] },
        }),
      };

      const files = await ctx.db.file_upload.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (files.length > limit) {
        const nextItem = files.pop();
        nextCursor = nextItem?.id;
      }

      // Enrich files with linked entity info
      const enrichedFiles = await enrichFilesWithLinkedEntities(ctx.db, files);

      return {
        files: enrichedFiles,
        nextCursor,
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
      })
    )
    .mutation(async ({ input }) => {
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
      });

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
