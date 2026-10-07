import { z } from "zod";

import {
  lexicalToPlainText,
  plainTextToLexical,
} from "~/lib/gig-import/lexical";

/**
 * Procedure inputs and outputs, between the model and the API. The model
 * reads input schemas as JSON Schema, writes JSON back, and reads results as
 * JSON text; these bridge the two. Input functions take the procedure's first
 * input parser, which is a Zod schema everywhere in this codebase.
 */

/** Roughly 5k tokens. A longer result is cut, and the model is told so. */
export const MAX_OUTPUT_CHARS = 20_000;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Every value in a JSON tree, with its path, outermost first. Where `fn`
 * returns something new, that replaces the value and its children are left
 * alone. Only arrays and plain objects are descended into, so a Date or a
 * Prisma Decimal passes through whole.
 */
function mapJson(
  value: unknown,
  fn: (value: unknown, path: string[]) => unknown,
  path: string[] = [],
): unknown {
  const mapped = fn(value, path);
  if (mapped !== value) return mapped;
  if (Array.isArray(value)) {
    return value.map((item, index) => mapJson(item, fn, [...path, `${index}`]));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        mapJson(item, fn, [...path, key]),
      ]),
    );
  }
  return value;
}

const isRichTextField = (path: string[]) => path.at(-1)?.endsWith("Lexical");

/**
 * The model writes JSON, and some inputs want what JSON cannot carry. Rich
 * text fields (named `…Lexical`) are built from plain text, and any string the
 * input schema rejects for not being a Date is read as one.
 */
export function prepareInput(parser: unknown, input: unknown): unknown {
  const withRichText = mapJson(input, (value, path) =>
    typeof value === "string" && isRichTextField(path)
      ? plainTextToLexical(value)
      : value,
  );
  if (!(parser instanceof z.ZodType)) return withRichText;

  const parsed = parser.safeParse(withRichText);
  if (parsed.success) return withRichText;
  const datePaths = new Set(
    parsed.error.issues
      .filter(
        (issue) => issue.code === "invalid_type" && issue.expected === "date",
      )
      .map((issue) => issue.path.map(String).join(".")),
  );
  return mapJson(withRichText, (value, path) =>
    typeof value === "string" && datePaths.has(path.join("."))
      ? new Date(value)
      : value,
  );
}

/** A procedure's input schema as the model reads it. Dates are ISO strings. */
export function inputSchemaOf(parser: unknown) {
  if (!parser) return "no input";
  if (!(parser instanceof z.ZodType)) return "not describable; try {}";
  const schema: Record<string, unknown> = z.toJSONSchema(parser, {
    io: "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema._zod.def.type === "date") {
        jsonSchema.type = "string";
        jsonSchema.format = "date-time";
      }
    },
  });
  // The same dialect tag on every schema is tokens spent on nothing.
  delete schema.$schema;
  return schema;
}

const stringify = (value: unknown) =>
  JSON.stringify(value ?? null, (_key, item: unknown) =>
    typeof item === "bigint" ? item.toString() : item,
  ) ?? "null";

/**
 * A procedure's result as the model reads it. Rich text comes back as the
 * plain text it was written in, which is also most of the weight of a list of
 * gigs. A list too long to send whole is cut at a whole item and says how many
 * were left out, so the model reads valid JSON and knows to narrow the query.
 */
export function toolOutput(
  value: unknown,
  maxChars: number = MAX_OUTPUT_CHARS,
): string {
  const readable = mapJson(value, (item, path) =>
    isRichTextField(path) && item !== null && typeof item === "object"
      ? (lexicalToPlainText(item) ?? item)
      : item,
  );
  const json = stringify(readable);
  if (json.length <= maxChars) return json;

  if (Array.isArray(readable)) {
    const kept: unknown[] = [];
    let size = 0;
    for (const item of readable) {
      size += stringify(item).length + 1;
      if (size > maxChars) break;
      kept.push(item);
    }
    return stringify({
      items: kept,
      note: `Showing ${kept.length} of ${readable.length}. Narrow the query, such as with a search or filter, to see the rest.`,
    });
  }
  return `${json.slice(0, maxChars)}… [cut at ${maxChars} of ${json.length} characters; ask for less, such as one record]`;
}
