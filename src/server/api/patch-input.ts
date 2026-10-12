import { TRPCError } from "@trpc/server";
import { z } from "zod";

/**
 * Inputs for edits that change only what they are given. An admin form sends
 * every field anyway, so these cost it nothing; Will GPT sends just the field
 * it was asked to change, and everything it left out stays as stored.
 */

type PatchShape<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: z.ZodOptional<
    Shape[K] extends z.ZodDefault<infer Inner> ? Inner : Shape[K]
  >;
};

/**
 * `schema` with every field optional. `.partial()` is not enough on its own:
 * Zod 4 still fills in a default for a field that is left out, so an edit
 * that never mentioned `visibility` would quietly reset it. This drops the
 * defaults as well, so a field left out is a field left alone.
 */
export function patchOf<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      z.optional(field instanceof z.ZodDefault ? field.unwrap() : field),
    ]),
  );
  return z.object(shape as PatchShape<Shape>);
}

/** `stored`, with each field `patch` sets. Left out or `undefined` keeps the stored value; `null` clears. */
export function applyPatch<T extends object>(
  stored: T,
  patch: { [K in keyof T]?: T[K] },
): T {
  const merged = { ...stored };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/**
 * A list edit made whole, then checked as the full list would be. A row with
 * the id of a stored row is that row with the fields it sets; a row without
 * one is new and has to be complete; a row marked `remove` is dropped. The
 * result is in the order given, and `listSchema` sees it exactly as it would
 * see a list the editor sent.
 */
export function patchRows<Schema extends z.ZodType>(
  listSchema: Schema,
  stored: ReadonlyMap<string, object>,
  rows: { id?: string; remove?: boolean; [field: string]: unknown }[],
): z.output<Schema> {
  const merged = rows.flatMap(({ remove, ...row }) => {
    if (remove) return [];
    const current = row.id ? stored.get(row.id) : undefined;
    return [
      current ? applyPatch<Record<string, unknown>>({ ...current }, row) : row,
    ];
  });
  const parsed = listSchema.safeParse(merged);
  if (!parsed.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: z.prettifyError(parsed.error),
    });
  }
  return parsed.data;
}
