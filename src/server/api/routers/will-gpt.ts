import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { willGptRunInputSchema, type WillGptEvent } from "~/lib/will-gpt";
import { runWillGpt } from "~/server/will-gpt/agent";

/** Will GPT, the admin assistant. The work is in `~/server/will-gpt`. */
export const willGptRouter = createTRPCRouter({
  /**
   * One run of the assistant, streamed as events (needs `httpBatchStreamLink`).
   * The panel sends the whole transcript each time; see `~/lib/will-gpt`.
   */
  run: adminProcedure.input(willGptRunInputSchema).mutation(async function* ({
    ctx,
    input,
    signal,
  }): AsyncGenerator<WillGptEvent> {
    // Imported here because the root router imports this file: Will GPT
    // calls the procedures of the router it is part of.
    const { appRouter } = await import("~/server/api/root");
    yield* runWillGpt({ router: appRouter, ctx, signal, ...input });
  }),
});
