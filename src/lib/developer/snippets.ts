import type { JsonSchema, OpenApiMethod, SpecOperation } from "./openapi";

/**
 * Examples and code samples drawn from the spec, for the reference and the
 * playground. Pure, and client-safe.
 */

const EXAMPLE_TIME = "2026-12-12T07:00:00.000Z";

/** A value that fits the schema, for showing what a response looks like. */
export function exampleFor(schema: JsonSchema | undefined, depth = 0): unknown {
  if (!schema || depth > 8) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.default !== undefined) return schema.default;

  const variants = schema.anyOf ?? schema.oneOf;
  if (variants?.length) {
    const solid = variants.find((variant) => variant.type !== "null");
    return exampleFor(solid ?? variants[0], depth + 1);
  }

  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null")
    : schema.type;
  switch (type) {
    case "object":
      return Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([key, value]) => [
          key,
          exampleFor(value, depth + 1),
        ]),
      );
    case "array":
      return [exampleFor(schema.items, depth + 1)];
    case "string":
      if (schema.format === "date-time") return EXAMPLE_TIME;
      if (schema.format === "email") return "sam@example.com";
      if (schema.format === "uri") return "https://example.com";
      return "string";
    case "integer":
    case "number":
      return schema.minimum ?? 0;
    case "boolean":
      return false;
    case "null":
      return null;
    default:
      return null;
  }
}

/** One line for a schema's type, as the reference's field tables show it. */
export function typeLabel(schema: JsonSchema): string {
  if (schema.enum?.length) return schema.enum.map(String).join(" | ");
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants?.length) {
    return [...new Set(variants.map(typeLabel))].join(" | ");
  }
  const type = Array.isArray(schema.type)
    ? schema.type.join(" | ")
    : schema.type;
  if (type === "array")
    return `${schema.items ? typeLabel(schema.items) : "any"}[]`;
  if (type === "string" && schema.format) return schema.format;
  return type ?? "any";
}

/** The object behind a schema, looking past `| null`. */
export function objectSchema(
  schema: JsonSchema | undefined,
): JsonSchema | null {
  if (!schema) return null;
  if (schema.properties) return schema;
  if (schema.items) return objectSchema(schema.items);
  for (const variant of schema.anyOf ?? schema.oneOf ?? []) {
    const inner = objectSchema(variant);
    if (inner) return inner;
  }
  return null;
}

/** `/gigs/{id}` with its params filled in, and a query string. */
export function fillPath(
  path: string,
  params: Record<string, string>,
  query: Record<string, string> = {},
): string {
  const filled = path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value ? encodeURIComponent(value) : `{${name}}`;
  });
  const search = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== ""),
  ).toString();
  return search ? `${filled}?${search}` : filled;
}

export type Snippet = "curl" | "javascript" | "python";

export const SNIPPETS: { value: Snippet; label: string }[] = [
  { value: "curl", label: "curl" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
];

/** A request as code, using `$ATMOS_API_KEY` (or the given key). */
export function snippet(
  kind: Snippet,
  request: {
    base: string;
    method: OpenApiMethod;
    path: string;
    body?: unknown;
    key?: string;
  },
): string {
  const url = `${request.base}${request.path}`;
  const method = request.method.toUpperCase();
  const json =
    request.body === undefined ? null : JSON.stringify(request.body, null, 2);

  if (kind === "curl") {
    const key = request.key ?? "$ATMOS_API_KEY";
    const lines = [
      `curl${method === "GET" ? "" : ` -X ${method}`} "${url}"`,
      `  -H "Authorization: Bearer ${key}"`,
    ];
    if (json !== null) {
      lines.push(`  -H "Content-Type: application/json"`);
      lines.push(`  -d '${json.replaceAll("'", "'\\''")}'`);
    }
    return lines.join(" \\\n");
  }

  if (kind === "javascript") {
    const key = request.key ? `"${request.key}"` : "process.env.ATMOS_API_KEY";
    const headers = [
      `    Authorization: \`Bearer \${${key}}\`,`,
      ...(json !== null ? [`    "Content-Type": "application/json",`] : []),
    ];
    return [
      `const response = await fetch("${url}", {`,
      `  method: "${method}",`,
      `  headers: {`,
      ...headers,
      `  },`,
      ...(json !== null
        ? [`  body: JSON.stringify(${json.replaceAll("\n", "\n  ")}),`]
        : []),
      `});`,
      `const data = await response.json();`,
    ].join("\n");
  }

  const key = request.key ? `"${request.key}"` : `os.environ["ATMOS_API_KEY"]`;
  return [
    ...(request.key ? [] : ["import os"]),
    "import requests",
    "",
    `response = requests.${request.method}(`,
    `    "${url}",`,
    `    headers={"Authorization": f"Bearer {${key}}"},`,
    ...(request.body !== undefined
      ? [`    json=${pythonLiteral(request.body, "    ")},`]
      : []),
    ")",
    "data = response.json()",
  ].join("\n");
}

/** A JSON value as Python source, indented to sit at `indent`. */
function pythonLiteral(value: unknown, indent: string): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value !== "object") return JSON.stringify(value);

  const inner = `${indent}    `;
  const entries = Array.isArray(value)
    ? value.map((item) => pythonLiteral(item, inner))
    : Object.entries(value).map(
        ([key, item]) =>
          `${JSON.stringify(key)}: ${pythonLiteral(item, inner)}`,
      );
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  if (entries.length === 0) return `${open}${close}`;
  return `${open}\n${entries.map((entry) => `${inner}${entry},`).join("\n")}\n${indent}${close}`;
}

/** An operation's starting body: its example, or one made from its schema. */
export function exampleBody(operation: SpecOperation): unknown {
  const content = operation.requestBody?.content["application/json"];
  if (!content) return undefined;
  return content.example ?? exampleFor(content.schema);
}

/** The schema of an operation's successful response. */
export function responseSchema(
  operation: SpecOperation,
): JsonSchema | undefined {
  const ok = Object.entries(operation.responses).find(([status]) =>
    status.startsWith("2"),
  );
  return ok?.[1].content?.["application/json"].schema;
}

/** A stable id for an operation, for links and selection. */
export function operationKey(operation: {
  method: OpenApiMethod;
  path: string;
}): string {
  return `${operation.method} ${operation.path}`;
}
