import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  changesIn,
  closeOff,
  willGptMessageSchema,
  type WillGptMessage,
} from "~/lib/will-gpt";
import type { Prisma, PrismaClient } from "~Prisma/client";

/**
 * Reading and writing `WillGptConversation` rows. A run loads the admin's own
 * conversation, and saves it after every message it adds, so an interrupted
 * run still leaves an accurate record of whatever did happen.
 */

const messagesSchema = z.array(willGptMessageSchema);

/**
 * Stored messages, read back. Anything that fails the schema was written by
 * an older shape of this feature and reads as empty rather than half-trusted.
 */
export function readMessages(value: Prisma.JsonValue): WillGptMessage[] {
  const parsed = messagesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * The admin's own conversation, ready to continue: calls an interrupted run
 * left open are closed off. Empty when the chat is new. Another admin's
 * conversation is refused, whatever id the panel sends.
 */
export async function loadOwnConversation(
  db: PrismaClient,
  id: string,
  userId: string,
): Promise<{ messages: WillGptMessage[]; awaiting: string[] }> {
  const row = await db.willGptConversation.findUnique({
    where: { id },
    select: { userId: true, messages: true, awaiting: true },
  });
  if (!row) return { messages: [], awaiting: [] };
  if (row.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "That conversation belongs to someone else.",
    });
  }
  return {
    messages: closeOff(readMessages(row.messages), row.awaiting),
    awaiting: row.awaiting,
  };
}

/**
 * The title a conversation starts with: the first thing asked, on one line.
 * A small model replaces it moments later (see `./title`); this is what shows
 * if that fails.
 */
const fallbackTitle = (messages: WillGptMessage[]) => {
  const first = messages.find((message) => message.role === "user");
  return (first?.text ?? "Untitled").replace(/\s+/g, " ").trim().slice(0, 120);
};

/**
 * What a model wrote, tidied into a title: its first line, without the
 * quotes, "Title:" label or full stop small models like to add.
 */
export function cleanTitle(text: string): string | null {
  const wrapping = /^[\s"'“‘*#]+|[\s"'”’*.]+$/g;
  const line = text.split("\n").find((candidate) => candidate.trim()) ?? "";
  // Unwrapped twice: the label can sit inside the quotes or outside them.
  const title = line
    .replace(wrapping, "")
    .replace(/^title\s*:\s*/i, "")
    .replace(wrapping, "");
  return title ? title.slice(0, 80) : null;
}

export async function saveConversation(
  db: PrismaClient,
  conversation: {
    id: string;
    userId: string;
    model: string;
    messages: WillGptMessage[];
    awaiting: string[];
  },
) {
  const data = {
    model: conversation.model,
    messages: conversation.messages,
    awaiting: conversation.awaiting,
    changeCount: changesIn(conversation.messages).length,
  };
  await db.willGptConversation.upsert({
    where: { id: conversation.id },
    create: {
      id: conversation.id,
      userId: conversation.userId,
      title: fallbackTitle(conversation.messages),
      ...data,
    },
    // The title is set once at creation and then by the title model only.
    update: data,
  });
}
