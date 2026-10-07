import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
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

/** Calls that ran and changed something: what the history list counts. */
export const changeCountOf = (messages: WillGptMessage[]) =>
  messages.filter(
    (message) =>
      message.role === "tool" &&
      message.status === "ok" &&
      (message.risk === "write" || message.risk === "destructive"),
  ).length;

/** The first thing asked, on one line. */
const titleOf = (messages: WillGptMessage[]) => {
  const first = messages.find((message) => message.role === "user");
  return (first?.text ?? "Untitled").replace(/\s+/g, " ").trim().slice(0, 120);
};

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
    title: titleOf(conversation.messages),
    model: conversation.model,
    messages: conversation.messages,
    awaiting: conversation.awaiting,
    changeCount: changeCountOf(conversation.messages),
  };
  await db.willGptConversation.upsert({
    where: { id: conversation.id },
    create: { id: conversation.id, userId: conversation.userId, ...data },
    update: data,
  });
}
