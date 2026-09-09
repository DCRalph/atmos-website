/**
 * Marking up a caption with what each field was read from.
 *
 * The review screen shows the post beside the form, and a value is only
 * checkable if you can see the line it came from. The extraction records an
 * exact quote per field; this turns those quotes into non-overlapping segments
 * of the caption so they can be rendered without any of them swallowing
 * another.
 */

export type CaptionMark<TField extends string> = {
  field: TField;
  /** Exact substring of the caption. Empty quotes are ignored. */
  quote: string;
};

export type CaptionSegment<TField extends string> = {
  text: string;
  /** Null for the stretches between marks. */
  field: TField | null;
};

/**
 * Split `caption` into runs, each either plain or attributed to one field.
 *
 * Quotes are placed longest first, so a field quoting a whole line does not
 * lose to another quoting three words inside it, and anything that would
 * overlap an already-placed quote is dropped rather than nested. A quote the
 * model got slightly wrong simply does not appear, which is the right failure:
 * the value is still shown, just without a highlight behind it.
 */
export function segmentCaption<TField extends string>(
  caption: string,
  marks: readonly CaptionMark<TField>[],
): CaptionSegment<TField>[] {
  type Placed = { start: number; end: number; field: TField };

  const placed: Placed[] = [];
  const byLongest = [...marks]
    .filter((mark) => mark.quote.trim().length > 0)
    .sort((a, b) => b.quote.length - a.quote.length);

  for (const mark of byLongest) {
    const start = caption.indexOf(mark.quote);
    if (start === -1) continue;
    const end = start + mark.quote.length;
    const clashes = placed.some(
      (other) => start < other.end && end > other.start,
    );
    if (clashes) continue;
    placed.push({ start, end, field: mark.field });
  }

  if (placed.length === 0) {
    return caption ? [{ text: caption, field: null }] : [];
  }

  placed.sort((a, b) => a.start - b.start);

  const segments: CaptionSegment<TField>[] = [];
  let cursor = 0;
  for (const mark of placed) {
    if (mark.start > cursor) {
      segments.push({ text: caption.slice(cursor, mark.start), field: null });
    }
    segments.push({
      text: caption.slice(mark.start, mark.end),
      field: mark.field,
    });
    cursor = mark.end;
  }
  if (cursor < caption.length) {
    segments.push({ text: caption.slice(cursor), field: null });
  }
  return segments;
}
