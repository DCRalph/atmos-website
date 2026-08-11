import "server-only";

import { z } from "zod";

/**
 * The picker contract.
 *
 * A "picker" is the server half of a `<PickerSelect>`: a search-as-you-type
 * source for a combobox. Every picker in the app takes the same input and
 * returns the same shape, which is what lets one client component drive all of
 * them without knowing anything about the underlying table.
 *
 * The rules a picker guarantees:
 *
 *  - it never returns more than `PICKER_MAX_LIMIT` rows, so a table with a
 *    million rows costs the same as one with ten;
 *  - it reports `total`, the true number of matches, so the UI can say
 *    "showing 20 of 340" instead of silently truncating;
 *  - it always includes the rows named in `includeValues`, even when they do
 *    not match the query — that is how an already-selected value keeps its
 *    label when you open the picker and start typing something else.
 *
 * To add a picker: write one entry in `~/server/api/routers/pickers.ts`.
 * Nothing else needs to change — the client component is already generic.
 */

export type PickerOption = {
  value: string;
  label: string;
  /** Secondary line: an email, a date, a venue. Keep it short. */
  description?: string;
};

export type PickerResult = {
  options: PickerOption[];
  /** Total matches, not the number returned. */
  total: number;
};

export const PICKER_DEFAULT_LIMIT = 20;
export const PICKER_MAX_LIMIT = 50;

/** The input every picker accepts. `filter` carries picker-specific narrowing. */
export function pickerInput<TFilter extends z.ZodTypeAny>(filter: TFilter) {
  return z.object({
    query: z.string().trim().max(100).default(""),
    limit: z
      .number()
      .int()
      .min(1)
      .max(PICKER_MAX_LIMIT)
      .default(PICKER_DEFAULT_LIMIT),
    /**
     * Values that must appear in the result regardless of the query. The
     * client sends the current selection so its label survives searching.
     */
    includeValues: z.array(z.string()).max(50).default([]),
    filter,
  });
}

/** Pickers with nothing to narrow by. */
export const noFilter = z.object({}).default({});

export type PickerInput = {
  query: string;
  limit: number;
  includeValues: string[];
};

/**
 * A Prisma `OR ... contains` clause across several string columns, or
 * `undefined` when there is no query so the caller can spread it away.
 *
 * Postgres `contains` with `mode: "insensitive"` is an unindexed sequential
 * scan. That is fine for the tens of thousands of rows these tables will
 * realistically hold; past that, swap the picker's `find` for a trigram or
 * tsvector index — the contract does not change.
 */
export function searchAcross<TField extends string>(
  query: string,
  fields: readonly TField[],
) {
  if (!query) return undefined;
  return {
    OR: fields.map((field) => ({
      [field]: { contains: query, mode: "insensitive" as const },
    })),
  };
}

/**
 * Assemble a `PickerResult`.
 *
 * Runs the search and the count together, then unions in any pinned
 * `includeValues` rows, de-duplicated and sorted to the front so the current
 * selection is always the first thing you see.
 */
export async function buildPicker<TRow>({
  input,
  find,
  count,
  findByValues,
  toOption,
}: {
  input: PickerInput;
  /** Matching rows, already limited to `take`. */
  find: (take: number) => Promise<TRow[]>;
  /** Total matches, ignoring the limit. */
  count: () => Promise<number>;
  /** Rows for specific values, regardless of the query. */
  findByValues: (values: string[]) => Promise<TRow[]>;
  toOption: (row: TRow) => PickerOption;
}): Promise<PickerResult> {
  const take = Math.min(input.limit, PICKER_MAX_LIMIT);

  const [rows, total, pinnedRows] = await Promise.all([
    find(take),
    count(),
    input.includeValues.length > 0
      ? findByValues(input.includeValues)
      : Promise.resolve<TRow[]>([]),
  ]);

  const pinned = pinnedRows.map(toOption);
  const found = rows.map(toOption);

  const seen = new Set(pinned.map((option) => option.value));
  const options = [
    ...pinned,
    ...found.filter((option) => !seen.has(option.value)),
  ];

  return { options, total };
}
