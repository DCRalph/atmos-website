import { TRPCError } from "@trpc/server";
import { uploadPresets, type UploadPresetName } from "~/lib/uploads/presets";
import type { Prisma, PrismaClient } from "~Prisma/client";

/** Library selection follows the destination field's image and size constraints. */
export function imageSelectionWhere(presetName: UploadPresetName) {
  const preset = uploadPresets[presetName];
  return {
    status: "OK",
    size: { lte: preset.maxFileSize },
    OR: preset.accept
      .filter((mime) => mime.startsWith("image/"))
      .map((mime) => ({
        mimeType: mime.endsWith("/*")
          ? { startsWith: mime.slice(0, -1) }
          : mime,
      })),
  } satisfies Prisma.file_uploadWhereInput;
}

export async function assertContentArtwork(db: PrismaClient, id: string) {
  const file = await db.file_upload.findFirst({
    where: { id, ...imageSelectionWhere("contentArtwork") },
    select: { id: true },
  });
  if (!file) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Choose an available image from the media library or upload a new one.",
    });
  }
}
