import { z } from "zod";

/**
 * What one Instagram post becomes on the way to being a gig.
 *
 * Every field carries where it came from, not just what it says. That is the
 * whole point of the shape: the review screen has to be able to show the admin
 * the caption line behind a value, and offer a way back to it after they have
 * typed over it. Provenance that is only computed in the UI cannot do either,
 * so it is part of the model's output and is stored with the import.
 *
 * Client-safe: this is the contract between the extraction call and the wizard.
 */

/** How much the extraction trusts a value. `low` is surfaced for review. */
export const CONFIDENCE = ["high", "low"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

/**
 * A value plus its receipt.
 *
 * `quote` is the exact substring of the caption the value was read from, so the
 * review screen can highlight it. It is empty when nothing was read and the
 * value was inferred instead, in which case `note` says what the inference was.
 */
const field = <T extends z.ZodType>(value: T) =>
  z.object({
    /** Null when the post does not say. Never guessed silently. */
    value: value.nullable(),
    quote: z.string(),
    confidence: z.enum(CONFIDENCE),
    /** Why, when the value was inferred or is uncertain. Empty otherwise. */
    note: z.string(),
  });

/** One slot on the bill. Two or more handles is a back to back, not two sets. */
const lineUpEntry = z.object({
  /** Instagram handles without the `@`, in billing order. */
  handles: z.array(z.string()),
  /** What the caption calls them, when it names them without a handle. */
  name: z.string().nullable(),
  /** Free text as written: "Headliner", "Support", "Opening". */
  role: z.string().nullable(),
});

export const gigExtractionSchema = z.object({
  title: field(z.string()),
  /** The venue. It is the gig's subtitle everywhere else in this codebase. */
  venue: field(z.string()),
  /**
   * Local wall time at the venue, `YYYY-MM-DDTHH:mm`, with no offset. The zone
   * is applied server-side so a caption that says "10pm" cannot end up meaning
   * 10pm UTC. See `zonedWallTimeToDate`.
   */
  startsAt: field(z.string()),
  endsAt: field(z.string()),
  shortDescription: field(z.string()),
  /** Plain text, paragraphs separated by blank lines. Converted to Lexical. */
  description: field(z.string()),
  ticketUrl: field(z.string()),
  /** Names only. Matched against existing gig tags; import never creates one. */
  tags: field(z.array(z.string())),
  lineUp: field(z.array(lineUpEntry)),
  mode: field(z.enum(["NORMAL", "TO_BE_ANNOUNCED"])),
  /**
   * Read, understood, and deliberately not used. Shown on the review screen so
   * that "the import ignored the door price" is something the admin is told
   * rather than something they have to notice.
   */
  unused: z.array(z.object({ quote: z.string(), reason: z.string() })),
});

export type GigExtraction = z.infer<typeof gigExtractionSchema>;
export type ExtractedLineUpEntry = z.infer<typeof lineUpEntry>;

/** The keys the review screen walks. Order is the order they are shown in. */
export const EXTRACTION_FIELDS = [
  "title",
  "venue",
  "startsAt",
  "endsAt",
  "shortDescription",
  "description",
  "ticketUrl",
  "tags",
  "lineUp",
  "mode",
] as const satisfies readonly (keyof GigExtraction)[];

export type ExtractionField = (typeof EXTRACTION_FIELDS)[number];

/**
 * Whether a field is worth stopping on before publishing: the post did not say,
 * or it said something the extraction had to interpret.
 */
export function needsReview(
  extraction: GigExtraction,
  key: ExtractionField,
): boolean {
  const field = extraction[key];
  return field.value === null || field.confidence === "low";
}
