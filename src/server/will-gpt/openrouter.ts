import "server-only";

import OpenAI from "openai";

import { env } from "~/env";

/**
 * Will GPT's OpenRouter client, or null when `OPENROUTER_API_KEY` is unset.
 * OpenRouter attributes requests to an app by these headers, which is how its
 * dashboard tells Will GPT's spend from the gig import's.
 */
export function openRouter(): OpenAI | null {
  if (!env.OPENROUTER_API_KEY) return null;
  return new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Atmos Admin / Will GPT",
    },
  });
}
