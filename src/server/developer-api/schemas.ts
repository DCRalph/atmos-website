import { z } from "zod";

/**
 * Building blocks shared by the endpoints, so every list pages the same way
 * and every time reads the same way.
 */

/** A time in a request: ISO 8601 with an offset, as a `Date` to the handler. */
export const dateTimeInput = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .meta({ example: "2026-12-12T07:00:00.000Z" });

/** A time in a response. JSON turns the `Date` into ISO 8601 UTC. */
export const dateTime = z.date();

export const id = z.string().min(1).max(100);

export const idParams = z.object({ id });

/** Every list takes these and answers with `page(item)`. */
export const pageQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("At most 100."),
  cursor: z
    .string()
    .optional()
    .describe("The `nextCursor` of the previous page."),
});

export function page<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z
      .string()
      .nullable()
      .describe("Pass as `cursor` for the next page. Null on the last page."),
  });
}

/**
 * One page of rows read with `take: limit + 1`: the extra row only says there
 * is another page, and the last row kept is where it starts.
 */
export function pageOf<T extends { id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; nextCursor: string | null } {
  const data = rows.slice(0, limit);
  return {
    data,
    nextCursor: rows.length > limit ? (data.at(-1)?.id ?? null) : null,
  };
}

/** Prisma's cursor arguments for `pageQuery`. */
export function cursorArgs(query: { limit: number; cursor?: string }) {
  return {
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  };
}

export const ok = z.object({ ok: z.literal(true) });

/** A comma separated list in a query string, as an array. */
export function commaList<T extends z.ZodType<string, string>>(item: T) {
  return z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item));
}
