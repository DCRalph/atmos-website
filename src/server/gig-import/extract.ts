import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { env } from "~/env";
import {
  gigExtractionSchema,
  type GigExtraction,
} from "~/lib/gig-import/extraction";
import { RUN_SHEET_TIMEZONE } from "~/lib/run-sheet/schedule";
import type { InstagramPost } from "./instagram";

/**
 * Turning a caption into a gig.
 *
 * One call through OpenRouter, one schema-validated object back. The image goes
 * with the caption because a poster usually carries the date and the venue in
 * larger type than the caption bothers to repeat, and half the captions worth
 * importing are one line and an emoji.
 *
 * The model is asked for provenance alongside every value. That is not
 * decoration: the review screen's ability to say "this came from line 2" and to
 * offer a way back to it depends on the quote being recorded at the moment the
 * value was decided, which is here.
 *
 * Which model runs is `OPENROUTER_MODEL` and is recorded on every import, so
 * changing it later does not rewrite what an older extraction claims about
 * itself. It has to accept images and JSON schema output.
 */

/** Images cost tokens and the second one is rarely the poster. */
const MAX_IMAGES = 2;

/** The model gets one shot; a caption is short and a retry would just cost more. */
const REQUEST_TIMEOUT_MS = 120_000;

export class ExtractionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionUnavailableError";
  }
}

/** The model each import ran on, stored so a bad reading can be traced to it. */
export const extractionModel = (): string => env.OPENROUTER_MODEL;

const SYSTEM = `You read gig announcements from Instagram and turn them into structured records for a New Zealand music promoter's admin system.

Rules that matter more than being helpful:

- Never invent a value. If the post does not say, the value is null. A null with a note is far more useful than a plausible guess presented as fact.
- When you do infer something, say so: set confidence to "low" and put the reasoning in note. Inferring is allowed, hiding it is not.
- quote must be an exact substring of the caption, copied character for character, so it can be highlighted. If the value came from the image or from inference rather than the caption text, leave quote empty.
- Times are local wall time at the venue, formatted YYYY-MM-DDTHH:mm with no timezone. Resolve weekday and month names against the post's date: a gig announced in September that says "Friday 23 October" is that October, and a date already past is next year.
- A club night that says "til late" or "all night" has no stated end time. Use null, not a guess.
- Titles are the event's name, cased as a name rather than shouted. Drop "ATMOS PRESENTS" and similar promoter prefixes from the title.
- venue is the venue's name alone. Street or suburb belongs in the description, not the venue.
- shortDescription is one or two plain sentences for a listing card. Do not copy the caption into it, and do not include the line-up.
- description is the caption tidied into paragraphs, with the line-up lines removed because those become the run sheet. Plain text only.
- Line-up entries are in billing order, opener first. Two or more handles in one entry means a back to back, which is one slot and not two. "b2b", "back to back" and "x" between two handles all mean this.
- Strip the leading @ from handles.
- tags may only contain names from the list of existing tags you are given. Anything else is dropped.
- mode is TO_BE_ANNOUNCED only when the post is a teaser with no named line-up and no date. A named line-up means NORMAL.
- unused is where anything you read but did not use goes: ticket prices, age restrictions that are not tags, calls to action. It is how the admin learns what was dropped.`;

type ExtractionInput = {
  post: InstagramPost;
  /** Gig tag names the site already has. The model may only pick from these. */
  existingTagNames: string[];
  /** The images, already downloaded. Empty on a pasted caption. */
  images: { buffer: Buffer; contentType: string }[];
};

/**
 * The media types worth sending. Anything else is dropped rather than sent and
 * rejected by whichever provider OpenRouter routes to.
 */
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

const asSupportedType = (contentType: string): string | null => {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return SUPPORTED_IMAGE_TYPES.find((type) => type === base) ?? null;
};

export async function extractGigFromPost({
  post,
  existingTagNames,
  images,
}: ExtractionInput): Promise<GigExtraction> {
  if (!env.OPENROUTER_API_KEY) {
    throw new ExtractionUnavailableError(
      "Gig import is not configured: OPENROUTER_API_KEY is unset.",
    );
  }

  const client = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    timeout: REQUEST_TIMEOUT_MS,
    // OpenRouter attributes requests to an app by these. They are optional to
    // the API and useful in its dashboard when working out what spent what.
    defaultHeaders: {
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Atmos Admin",
    },
  });

  const imageParts = images.slice(0, MAX_IMAGES).flatMap((image) => {
    const mediaType = asSupportedType(image.contentType);
    if (!mediaType) return [];
    return [
      {
        type: "image_url" as const,
        image_url: {
          url: `data:${mediaType};base64,${image.buffer.toString("base64")}`,
        },
      },
    ];
  });

  const brief = [
    `Timezone: ${RUN_SHEET_TIMEZONE}`,
    `Posted at: ${post.postedAt}`,
    post.username ? `Account: @${post.username}` : null,
    `Existing gig tags (the only ones you may use): ${
      existingTagNames.length > 0 ? existingTagNames.join(", ") : "none"
    }`,
    "",
    "Caption:",
    post.caption.trim() || "(the post has no caption)",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const completion = await client.chat.completions.parse({
    model: extractionModel(),
    response_format: zodResponseFormat(gigExtractionSchema, "gig_extraction"),
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          ...imageParts,
          {
            type: "text",
            text:
              imageParts.length > 0
                ? `${brief}\n\nThe attached image is the post's artwork. Read it as well as the caption; posters often carry the date, venue and line-up that the caption leaves out.`
                : brief,
          },
        ],
      },
    ],
  });

  const choice = completion.choices[0];
  if (choice?.message.refusal) {
    throw new ExtractionUnavailableError(
      "The extraction was declined. Paste the details in by hand.",
    );
  }

  const parsed = choice?.message.parsed;
  if (!parsed) {
    throw new ExtractionUnavailableError(
      "The post could not be read into a gig. Try pasting the caption instead.",
    );
  }

  return parsed;
}
