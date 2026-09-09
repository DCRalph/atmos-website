import type {
  ExtractionField,
  GigExtraction,
} from "~/lib/gig-import/extraction";
import type { CaptionMark } from "~/lib/gig-import/highlight";

/**
 * Which fields get a colour in the caption, and which colour.
 *
 * Only the fields worth tracing back to a line are here. Marking all ten would
 * turn the caption into a rainbow and stop any single highlight meaning
 * anything, so the long prose fields, the tags and the mode are deliberately
 * left plain — they are summaries of the whole post rather than readings of one
 * line in it.
 */
export const MARKED_FIELDS = {
  title: {
    label: "Title",
    /** Applied to the caption run and to the marker beside the field. */
    text: "text-violet-300",
    chip: "bg-violet-300 text-black",
  },
  venue: {
    label: "Venue",
    text: "text-sky-300",
    chip: "bg-sky-300 text-black",
  },
  startsAt: {
    label: "Starts",
    text: "text-emerald-300",
    chip: "bg-emerald-300 text-black",
  },
  endsAt: {
    label: "Ends",
    text: "text-amber-300",
    chip: "bg-amber-300 text-black",
  },
  ticketUrl: {
    label: "Ticket link",
    text: "text-rose-300",
    chip: "bg-rose-300 text-black",
  },
  lineUp: {
    label: "Line-up",
    text: "text-teal-300",
    chip: "bg-teal-300 text-black",
  },
} as const satisfies Partial<
  Record<ExtractionField, { label: string; text: string; chip: string }>
>;

export type MarkedField = keyof typeof MARKED_FIELDS;

export const MARKED_FIELD_ORDER = Object.keys(MARKED_FIELDS) as MarkedField[];

/** The number shown on a highlight, so a run and a field can be matched up. */
export const markerNumber = (field: MarkedField): number =>
  MARKED_FIELD_ORDER.indexOf(field) + 1;

/** Every quote worth highlighting, in the order the fields are listed. */
export function captionMarks(
  extraction: GigExtraction,
): CaptionMark<MarkedField>[] {
  return MARKED_FIELD_ORDER.map((field) => ({
    field,
    quote: extraction[field].quote,
  }));
}
