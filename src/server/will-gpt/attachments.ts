import { TRPCError } from "@trpc/server";
import { env } from "~/env";
import { readDocument, readTextAttachment } from "./attachment-content";

import type { WillGptAttachment } from "~/lib/will-gpt";
import { uploadPresets } from "~/lib/uploads/presets";
import { FileUploadStatus, type PrismaClient } from "~Prisma/client";
import { getObjectBuffer } from "~/server/uploads/r2";
import { openRouter } from "./openrouter";

/** Load only completed files this admin uploaded into this conversation. */
export async function ownAttachment(
  db: PrismaClient,
  id: string,
  conversationId: string,
  userId: string,
) {
  const file = await db.file_upload.findFirst({
    where: {
      id,
      userId,
      forId: conversationId,
      preset: "willGptAttachment",
      status: FileUploadStatus.OK,
    },
  });
  if (!file) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Attachment not available in this conversation.",
    });
  }
  return file;
}

/** Extract documents once, before the assistant can make changes. No bytes or provider URLs are saved in the transcript. */
export async function readAttachments(opts: {
  db: PrismaClient;
  ids: string[];
  conversationId: string;
  userId: string;
  signal?: AbortSignal;
}): Promise<WillGptAttachment[]> {
  const files = await Promise.all(
    [...new Set(opts.ids)].map((id) =>
      ownAttachment(opts.db, id, opts.conversationId, opts.userId),
    ),
  );
  if (
    files.reduce((size, file) => size + file.size, 0) >
    uploadPresets.willGptAttachment.maxTotalSize
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Attachments exceed the 50 MB total limit.",
    });
  }

  // Sequential reads keep memory bounded when several PDFs are attached.
  const attachments: WillGptAttachment[] = [];
  for (const file of files) {
    opts.signal?.throwIfAborted();
    try {
      if (file.size > uploadPresets.willGptAttachment.maxFileSize)
        throw new Error("File exceeds the 25 MB limit.");
      const body = await getObjectBuffer(file.key);
      let content: string;
      if (
        file.mimeType.startsWith("image/") ||
        file.mimeType === "application/pdf"
      ) {
        const client = openRouter();
        if (!client)
          throw new Error(
            "Will GPT is not set up: OPENROUTER_API_KEY is unset.",
          );
        content = await readDocument({
          client,
          model: env.OPENROUTER_MODEL,
          file,
          body,
          signal: opts.signal,
        });
      } else {
        content = readTextAttachment(body);
      }
      attachments.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        content,
      });
    } catch (cause) {
      if (opts.signal?.aborted) throw cause;
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Could not read ${file.name}: ${cause instanceof Error ? cause.message : "Please try again."}`,
        cause,
      });
    }
  }
  return attachments;
}
