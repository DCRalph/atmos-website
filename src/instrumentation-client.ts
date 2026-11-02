import { initBotId } from "botid/client/core";

// Vercel BotID: attaches a challenge token to these requests, which the
// server verifies with `checkBotId()`. tRPC batches calls into one path like
// `/api/trpc/a,contact.create`, hence the wildcards.
initBotId({
  protect: [{ path: "/api/trpc/*contact.create*", method: "POST" }],
});
