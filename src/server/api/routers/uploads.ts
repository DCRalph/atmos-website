import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import {
  uploadPresets,
  allPresetConstraints,
  type UploadPresetName,
} from "~/lib/uploads/presets";
import {
  startUpload,
  finishUpload,
  abortUpload,
  sweepStaleUploads,
} from "~/server/uploads/service";
import { FileUploadStatus } from "~Prisma/client";

const presetNames = Object.keys(uploadPresets) as [
  UploadPresetName,
  ...UploadPresetName[],
];

/**
 * Control plane for uploads. The bytes never pass through here — they go
 * straight from the browser to S3 via the presigned URL handed out by `start`.
 */
export const uploadsRouter = createTRPCRouter({
  /**
   * Reserve an upload slot and get a presigned PUT URL. Returns immediately
   * with `status: "duplicate"` when the same file already exists at the same
   * destination, so nothing is transferred.
   */
  start: protectedProcedure
    .input(
      z.object({
        preset: z.enum(presetNames),
        context: z.record(z.string(), z.unknown()).optional(),
        file: z.object({
          name: z.string().min(1).max(400),
          size: z.number().int().positive(),
          type: z.string().max(200).default(""),
          sourceHash: z
            .string()
            .regex(/^[a-f0-9]{64}$/, "sourceHash must be a SHA-256 hex digest")
            .optional(),
        }),
        tagIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(({ ctx, input }) => startUpload(input, ctx)),

  /** Verify the uploaded bytes, process them, and publish the file. */
  finish: protectedProcedure
    .input(z.object({ uploadId: z.string().min(1) }))
    .mutation(({ ctx, input }) => finishUpload(input, ctx)),

  /** Give up on an upload and discard the staged bytes. */
  abort: protectedProcedure
    .input(z.object({ uploadId: z.string().min(1) }))
    .mutation(({ ctx, input }) => abortUpload(input, ctx)),

  /**
   * Every preset with its constraints and current usage, for the admin UI.
   * The constraints themselves also ship to the client directly from
   * `~/lib/uploads/presets`, so components can validate without a round trip.
   */
  presets: adminProcedure.query(async ({ ctx }) => {
    const usage = await ctx.db.file_upload.groupBy({
      by: ["preset"],
      where: { status: FileUploadStatus.OK },
      _count: true,
      _sum: { size: true, originalSize: true },
    });
    const byPreset = new Map(usage.map((u) => [u.preset, u]));

    return allPresetConstraints().map((preset) => {
      const stats = byPreset.get(preset.name);
      return {
        ...preset,
        fileCount: stats?._count ?? 0,
        storedBytes: stats?._sum.size ?? 0,
        originalBytes: stats?._sum.originalSize ?? 0,
      };
    });
  }),

  /** Clear out uploads that were started but never completed. */
  sweepStale: adminProcedure
    .input(z.object({ olderThanHours: z.number().min(1).max(720).default(24) }))
    .mutation(({ ctx, input }) =>
      sweepStaleUploads(ctx.db, input.olderThanHours),
    ),
});
