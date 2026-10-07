import "server-only";

import { cleanTitle } from "./conversations";
import { openRouter } from "./openrouter";

/**
 * Titles for the history page, written by a small model from the first thing
 * the admin asked. Small and not a reasoning model, so a five word answer is
 * all it spends and it comes back well before the conversation's first turn.
 */
const TITLE_MODEL = "mistralai/ministral-8b-2512";

const SYSTEM = `You title conversations between an admin of Atmos, a New Zealand music promoter, and the assistant that runs their website's admin.

Reply with the title alone: three to six words saying what the admin asked for, in sentence case. Name the gig, page or person when the request does. No quotes and no full stop.`;

/** Null when it cannot be had; the conversation keeps its first line as a title. */
export async function generateTitle(request: string): Promise<string | null> {
  const client = openRouter();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create(
      {
        model: TITLE_MODEL,
        max_tokens: 30,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: request.slice(0, 4_000) },
        ],
      },
      { timeout: 15_000 },
    );
    return cleanTitle(completion.choices[0]?.message.content ?? "");
  } catch (error) {
    console.error("[Will GPT] title failed", error);
    return null;
  }
}
