import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  changesIn,
  closeOff,
  willGptRunInputSchema,
  type WillGptEvent,
  type WillGptMessage,
} from "~/lib/will-gpt";
import { runWillGpt } from "~/server/will-gpt/agent";
import {
  loadOwnConversation,
  readMessages,
  saveConversation,
} from "~/server/will-gpt/conversations";
import { generateTitle } from "~/server/will-gpt/title";

const userSelect = {
  select: { id: true, name: true, email: true, image: true },
} as const;

/** Will GPT, the admin assistant. The work is in `~/server/will-gpt`. */
export const willGptRouter = createTRPCRouter({
  /**
   * One run of the assistant, streamed as events (needs `httpBatchStreamLink`).
   * The transcript is the server's: the panel sends only the next message or
   * its answers to the calls waiting for approval.
   */
  run: adminProcedure.input(willGptRunInputSchema).mutation(async function* ({
    ctx,
    input,
    signal,
  }): AsyncGenerator<WillGptEvent> {
    const saved = await loadOwnConversation(
      ctx.db,
      input.conversationId,
      ctx.user.id,
    );
    if (input.message && saved.awaiting.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Approve or decline the waiting calls first.",
      });
    }
    if (!input.message && saved.awaiting.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nothing to run: send a message.",
      });
    }

    let messages: WillGptMessage[] = input.message
      ? [...saved.messages, { role: "user", text: input.message }]
      : saved.messages;
    let awaiting: string[] = [];
    const save = () =>
      saveConversation(ctx.db, {
        id: input.conversationId,
        userId: ctx.user.id,
        model: input.model,
        messages,
        awaiting,
      });
    await save();

    // A new conversation gets its title alongside its first run rather than
    // before it, so the admin never waits on it.
    const titling =
      input.message && saved.messages.length === 0
        ? generateTitle(input.message).then(async (title) => {
            if (!title) return;
            await ctx.db.willGptConversation.update({
              where: { id: input.conversationId },
              data: { title },
            });
          })
        : null;

    try {
      // Imported here because the root router imports this file: Will GPT
      // calls the procedures of the router it is part of.
      const { appRouter } = await import("~/server/api/root");
      for await (const event of runWillGpt({
        router: appRouter,
        ctx,
        signal,
        model: input.model,
        page: input.page,
        messages,
        // Only a call that was actually waiting can be approved.
        decisions: Object.fromEntries(
          Object.entries(input.decisions).filter(([id]) =>
            saved.awaiting.includes(id),
          ),
        ),
      })) {
        if (event.type === "message") {
          messages = [...messages, event.message];
          await save();
        }
        if (event.type === "awaiting") {
          awaiting = event.callIds;
          await save();
        }
        yield event;
      }
    } finally {
      // Held until the title is written, so the request does not end first.
      await titling?.catch((error: unknown) =>
        console.error("[Will GPT] saving the title failed", error),
      );
    }
  }),

  /**
   * Every conversation, newest activity first, for the history page. Any
   * admin sees every admin's conversations: knowing who asked for what is the
   * point of keeping them.
   */
  list: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
        userId: z.string().optional(),
        /** Only conversations that changed something, or are waiting to. */
        changedOnly: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.willGptConversation.findMany({
        where: {
          ...(input.userId ? { userId: input.userId } : {}),
          ...(input.changedOnly
            ? {
                OR: [
                  { changeCount: { gt: 0 } },
                  { awaiting: { isEmpty: false } },
                ],
              }
            : {}),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          title: true,
          model: true,
          changeCount: true,
          awaiting: true,
          createdAt: true,
          updatedAt: true,
          user: userSelect,
        },
      });
      const next = rows.length > input.limit ? rows.pop() : undefined;
      return { rows, nextCursor: next?.id ?? null };
    }),

  /** Everyone who has talked to Will GPT, for the history page's filter. */
  people: adminProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      where: { willGptConversations: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ),

  /**
   * What one conversation changed, without the rest of it: a history row
   * opens to this, and a conversation's tool output can run to megabytes.
   */
  changes: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.willGptConversation.findUnique({
        where: { id: input.id },
        select: { messages: true },
      });
      return row ? changesIn(readMessages(row.messages)) : [];
    }),

  /**
   * One conversation in full. The history page shows anyone's; the panel uses
   * it to pick its own chat back up after a reload.
   */
  byId: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.willGptConversation.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          title: true,
          model: true,
          messages: true,
          awaiting: true,
          changeCount: true,
          createdAt: true,
          updatedAt: true,
          user: userSelect,
        },
      });
      if (!row) return null;
      return {
        ...row,
        messages: closeOff(readMessages(row.messages), row.awaiting),
      };
    }),
});
