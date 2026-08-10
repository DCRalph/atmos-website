import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  presetConstraints,
  uploadPresets,
  type UploadPresetName,
} from "~/lib/uploads/presets";
import type { UploadedFile } from "~/lib/uploads/types";
import {
  extensionOf,
  resolveMimeType,
  validateFile,
  formatBytes,
  matchesAccept,
} from "~/lib/uploads/validate";
import { FileUploadStatus, type PrismaClient } from "~Prisma/client";
import { authorizeUpload, type UploadAuthContext } from "./authorize";
import { fileCategoryFor, fileTypeFor } from "./files";
import {
  buildPublicUrl,
  copyObject,
  deleteObject,
  deleteObjects,
  getObjectBuffer,
  headObject,
  presignPut,
  putBuffer,
  PRESIGN_EXPIRY_SECONDS,
} from "./s3";
import { canProcessImage, processImage, readImageDimensions } from "./process-image";

/**
 * The upload pipeline, in three steps:
 *
 *   1. `startUpload`  — authorize, validate, reserve a `file_upload` row in
 *                       UPLOADING state, hand back a presigned PUT URL.
 *   2. (browser)      — PUT the bytes straight to S3 staging. No size limit,
 *                       real progress, no request body through this app.
 *   3. `finishUpload` — verify what actually landed, run image processing,
 *                       move it to its final key, flip the row to OK.
 *
 * Uploads that are never finished leave a staging object and an UPLOADING row,
 * both cleaned up by `sweepStaleUploads`.
 */

/** Prefix for bytes that have not been verified yet. Never served to anyone. */
const STAGING_PREFIX = "_staging";

/**
 * Pass-through files under this size are still downloaded once so we can record
 * their real hash and pixel dimensions. Above it, that round trip is not worth
 * it and those fields are left null.
 */
const INSPECT_LIMIT_BYTES = 20 * 1024 * 1024;

const stagingKeyFor = (uploadId: string) => `${STAGING_PREFIX}/${uploadId}`;

const sha256 = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

export type StartUploadInput = {
  preset: UploadPresetName;
  context?: unknown;
  file: {
    name: string;
    size: number;
    type: string;
    /** SHA-256 of the source file, computed in the browser. Enables dedupe
     *  before a single byte is transferred. Optional. */
    sourceHash?: string;
  };
  /** File tags to attach once the upload completes. */
  tagIds?: string[];
};

export type StartUploadResult =
  | {
      status: "ready";
      uploadId: string;
      /** Presigned PUT target. Send the raw file as the body. */
      uploadUrl: string;
      /** Headers the PUT must include for the signature to match. */
      headers: Record<string, string>;
      expiresInSeconds: number;
    }
  | {
      status: "duplicate";
      file: UploadedFile;
    };

export const startUpload = async (
  input: StartUploadInput,
  ctx: UploadAuthContext,
): Promise<StartUploadResult> => {
  const preset = uploadPresets[input.preset];
  const constraints = presetConstraints(input.preset);

  const { userId, context } = await authorizeUpload(
    input.preset,
    input.context,
    ctx,
  );

  const mimeType = resolveMimeType(input.file.name, input.file.type);
  const reason = validateFile(
    { name: input.file.name, size: input.file.size, type: mimeType },
    constraints,
  );
  if (reason) {
    throw new TRPCError({ code: "BAD_REQUEST", message: reason });
  }

  const forId = preset.forId(context as never);

  // Same file, same destination, already stored — hand back what we have
  // instead of uploading it again. Scoped to the destination on purpose: the
  // same photo on two different gigs should be two independent records.
  if (input.file.sourceHash) {
    const existing = await ctx.db.file_upload.findFirst({
      where: {
        sourceHash: input.file.sourceHash,
        for: preset.for,
        forId,
        status: FileUploadStatus.OK,
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return { status: "duplicate", file: toUploadedFile(existing, true) };
    }
  }

  const extension = extensionOf(input.file.name);
  const key = `${preset.keyPrefix(context as never)}/${randomUUID()}${
    extension ? `.${extension}` : ""
  }`;

  const record = await ctx.db.file_upload.create({
    data: {
      url: buildPublicUrl(key),
      key,
      name: input.file.name,
      type: fileTypeFor(mimeType),
      category: fileCategoryFor(mimeType),
      size: input.file.size,
      originalSize: input.file.size,
      mimeType,
      acl: preset.acl,
      status: FileUploadStatus.UPLOADING,
      preset: input.preset,
      sourceHash: input.file.sourceHash ?? null,
      for: preset.for,
      forId,
      userId,
      ...(input.tagIds?.length
        ? { fileTags: { connect: input.tagIds.map((id) => ({ id })) } }
        : {}),
    },
  });

  const uploadUrl = await presignPut({
    key: stagingKeyFor(record.id),
    contentType: mimeType,
  });

  return {
    status: "ready",
    uploadId: record.id,
    uploadUrl,
    headers: { "Content-Type": mimeType },
    expiresInSeconds: PRESIGN_EXPIRY_SECONDS,
  };
};

export const finishUpload = async (
  input: { uploadId: string },
  ctx: UploadAuthContext,
): Promise<UploadedFile> => {
  const record = await requirePendingUpload(input.uploadId, ctx);
  const presetName = record.preset as UploadPresetName | null;
  if (!presetName || !(presetName in uploadPresets)) {
    await failUpload(ctx.db, record.id);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Upload is missing its preset",
    });
  }
  const preset = uploadPresets[presetName];
  const constraints = presetConstraints(presetName);
  const stagingKey = stagingKeyFor(record.id);

  try {
    const head = await headObject(stagingKey);
    if (!head) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No uploaded file found — the transfer did not complete",
      });
    }

    // Re-check against the real object rather than what the client claimed.
    if (head.size === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "File is empty" });
    }
    if (head.size > preset.maxFileSize) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `File is ${formatBytes(head.size)}, over the ${formatBytes(
          preset.maxFileSize,
        )} limit`,
      });
    }
    const storedMime = resolveMimeType(record.name, head.contentType);
    if (!matchesAccept(storedMime, constraints.accept)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Uploaded file is ${storedMime}, which this upload does not accept`,
      });
    }

    const shouldProcess =
      Boolean(preset.image) && canProcessImage(storedMime) && head.size > 0;

    let finalKey = record.key;
    let finalMime = storedMime;
    let finalSize = head.size;
    let hash: string | null = record.sourceHash;
    let width: number | null = null;
    let height: number | null = null;

    if (shouldProcess && preset.image) {
      const source = await getObjectBuffer(stagingKey);
      // The declared hash is unverified; recompute it from the real bytes.
      hash = sha256(source);
      if (hash !== record.sourceHash) {
        await ctx.db.file_upload.update({
          where: { id: record.id },
          data: { sourceHash: hash },
        });
      }

      const processed = await processImage(
        source,
        preset.image,
        storedMime,
        extensionOf(record.name),
      );

      finalKey = replaceExtension(record.key, processed.extension);
      finalMime = processed.contentType;
      finalSize = processed.buffer.length;
      width = processed.width;
      height = processed.height;
      // The stored bytes are what matter for the `hash` column.
      hash = sha256(processed.buffer);

      await putBuffer({
        key: finalKey,
        body: processed.buffer,
        contentType: finalMime,
        acl: preset.acl,
        cacheControl: "public, max-age=31536000, immutable",
      });
    } else {
      // Stored untouched (SVG, animated GIF, video, PDF…), so the source hash
      // also describes the stored bytes. Small images are still pulled down
      // once to record real dimensions and a verified hash; for large files
      // that round trip is not worth it and those fields stay null.
      if (storedMime.startsWith("image/") && head.size <= INSPECT_LIMIT_BYTES) {
        const source = await getObjectBuffer(stagingKey);
        hash = sha256(source);
        const dims = await readImageDimensions(source);
        width = dims.width;
        height = dims.height;

        if (hash !== record.sourceHash) {
          await ctx.db.file_upload.update({
            where: { id: record.id },
            data: { sourceHash: hash },
          });
        }
      }

      await copyObject({
        fromKey: stagingKey,
        toKey: finalKey,
        contentType: finalMime,
        acl: preset.acl,
      });
    }

    // A second dedupe pass, for clients that did not send a source hash.
    if (hash) {
      const twin = await ctx.db.file_upload.findFirst({
        where: {
          hash,
          for: record.for,
          forId: record.forId,
          status: FileUploadStatus.OK,
          NOT: { id: record.id },
        },
        orderBy: { createdAt: "desc" },
      });
      if (twin) {
        await deleteObjects([stagingKey, finalKey]);
        await ctx.db.file_upload.delete({ where: { id: record.id } });
        return toUploadedFile(twin, true);
      }
    }

    const updated = await ctx.db.file_upload.update({
      where: { id: record.id },
      data: {
        status: FileUploadStatus.OK,
        key: finalKey,
        url: buildPublicUrl(finalKey),
        mimeType: finalMime,
        type: fileTypeFor(finalMime),
        category: fileCategoryFor(finalMime),
        size: finalSize,
        hash,
        width,
        height,
      },
    });

    await deleteObject(stagingKey).catch(() => {
      // A leftover staging object is swept up later; it must not fail the upload.
    });

    return toUploadedFile(updated, false);
  } catch (error) {
    await failUpload(ctx.db, record.id);
    await deleteObject(stagingKey).catch(() => undefined);
    throw error;
  }
};

/** Cancels an upload that was started but never completed. */
export const abortUpload = async (
  input: { uploadId: string },
  ctx: UploadAuthContext,
): Promise<{ ok: true }> => {
  const record = await requirePendingUpload(input.uploadId, ctx);
  await deleteObject(stagingKeyFor(record.id)).catch(() => undefined);
  await ctx.db.file_upload.delete({ where: { id: record.id } });
  return { ok: true };
};

/**
 * Removes abandoned uploads — rows still UPLOADING (or ERRORED) past the
 * presign window, plus their staging objects.
 */
export const sweepStaleUploads = async (
  db: PrismaClient,
  olderThanHours = 24,
): Promise<{ removed: number }> => {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const stale = await db.file_upload.findMany({
    where: {
      status: { in: [FileUploadStatus.UPLOADING, FileUploadStatus.ERRORED] },
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 1000,
  });
  if (stale.length === 0) return { removed: 0 };

  await deleteObjects(stale.map((row) => stagingKeyFor(row.id)));
  await db.file_upload.deleteMany({
    where: { id: { in: stale.map((row) => row.id) } },
  });
  return { removed: stale.length };
};

const requirePendingUpload = async (
  uploadId: string,
  ctx: UploadAuthContext,
) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const record = await ctx.db.file_upload.findUnique({
    where: { id: uploadId },
  });
  if (!record) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
  }
  if (record.status !== FileUploadStatus.UPLOADING) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This upload has already been completed",
    });
  }
  // Only the user who started an upload can complete it, so a leaked id cannot
  // be used to attach someone else's bytes to their record.
  if (record.userId !== ctx.session.user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your upload" });
  }
  return record;
};

const failUpload = async (db: PrismaClient, id: string) => {
  await db.file_upload
    .update({ where: { id }, data: { status: FileUploadStatus.ERRORED } })
    .catch(() => undefined);
};

const replaceExtension = (key: string, extension: string) => {
  const withoutExt = key.replace(/\.[^./]+$/, "");
  return `${withoutExt}.${extension}`;
};

const toUploadedFile = (
  record: {
    id: string;
    url: string;
    key: string;
    name: string;
    size: number;
    mimeType: string;
    width: number | null;
    height: number | null;
  },
  isDuplicate: boolean,
): UploadedFile => ({
  id: record.id,
  url: record.url,
  key: record.key,
  name: record.name,
  size: record.size,
  mimeType: record.mimeType,
  width: record.width,
  height: record.height,
  isDuplicate,
});
