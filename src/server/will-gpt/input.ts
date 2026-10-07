import { z } from "zod";

import { plainTextToLexical } from "~/lib/gig-import/lexical";

/**
 * Procedure inputs, between the model and the API. The model reads input
 * schemas as JSON Schema and writes JSON back; these bridge the two. Each
 * takes the procedure's first input parser, which is a Zod schema everywhere
 * in this codebase.
 */

/**
 * Every value in a JSON tree, with its path, outermost first. Where `fn`
 * returns something new, that replaces the value and its children are left
 * alone.
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
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        mapJson(item, fn, [...path, key]),
      ]),
    );
  }
  return value;
}

/**
 * The model writes JSON, and some inputs want what JSON cannot carry. Rich
 * text fields (named `…Lexical`) are built from plain text, and any string the
 * input schema rejects for not being a Date is read as one.
 */
export function prepareInput(parser: unknown, input: unknown): unknown {
  const withRichText = mapJson(input, (value, path) =>
    typeof value === "string" && path.at(-1)?.endsWith("Lexical")
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
  return z.toJSONSchema(parser, {
    io: "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema._zod.def.type === "date") {
        jsonSchema.type = "string";
        jsonSchema.format = "date-time";
      }
    },
  });
}
