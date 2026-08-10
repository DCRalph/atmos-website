import "server-only";

import { db } from "~/server/db";
import { FileCategory, FileUploadStatus } from "~Prisma/client";
import { deleteObject } from "./s3";

/**
 * Database-side operations on `file_upload` rows. Anything that needs both the
 * row and the object lives here so deletes can never leave one without the
 * other.
 */

export const fileCategoryFor = (mimeType: string): FileCategory => {
  const type = mimeType.toLowerCase();
  if (type.startsWith("image/")) return FileCategory.IMAGE;
  if (type.startsWith("video/")) return FileCategory.VIDEO;
  if (type.startsWith("audio/")) return FileCategory.AUDIO;
  if (type.includes("pdf")) return FileCategory.PDF;
  if (type.includes("document") || type.includes("word"))
    return FileCategory.DOCUMENT;
  return FileCategory.FILE;
};

/** Lowercase category string for the legacy `file_upload.type` column. */
export const fileTypeFor = (mimeType: string): string =>
  fileCategoryFor(mimeType).toLowerCase();

type FileIdentifier = { id?: string; key?: string };

const identifierOf = (ref: FileIdentifier) => {
  if (ref.id) return { id: ref.id };
  if (ref.key) return { key: ref.key };
  throw new Error("A file reference requires either an id or a key");
};

/** Marks a file as deleted but leaves the object in S3 (recoverable). */
export const softDeleteFile = async (ref: FileIdentifier) =>
  db.file_upload.update({
    where: identifierOf(ref),
    data: { status: FileUploadStatus.SOFT_DELETED },
  });

/** Removes the object from S3 and marks the row DELETED. */
export const deleteFile = async (ref: FileIdentifier) => {
  const existing = await db.file_upload.findUnique({
    where: identifierOf(ref),
  });
  if (!existing) throw new Error("File not found");

  await deleteObject(existing.key);

  return db.file_upload.update({
    where: { id: existing.id },
    data: { status: FileUploadStatus.DELETED },
  });
};
