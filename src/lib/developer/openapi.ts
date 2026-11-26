import type { ApiScope } from "./scopes";

/**
 * The slice of OpenAPI 3.1 the developer API's spec uses, typed for the admin
 * reference and playground that render it. The spec itself is built from the
 * endpoint list by `~/server/developer-api/openapi`.
 *
 * Client-safe.
 */

/** JSON Schema, as Zod writes it. Only the keywords the reference reads. */
export type JsonSchema = {
  type?: string | string[];
  format?: string;
  description?: string;
  enum?: readonly unknown[];
  const?: unknown;
  default?: unknown;
  example?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
};

export type OpenApiParameter = {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  schema: JsonSchema;
};

export type OpenApiOperation = {
  operationId: string;
  summary: string;
  description?: string;
  tags: [string];
  parameters: OpenApiParameter[];
  requestBody?: {
    required: true;
    content: { "application/json": { schema: JsonSchema; example?: unknown } };
  };
  responses: Record<
    string,
    {
      description: string;
      content?: { "application/json": { schema: JsonSchema } };
    }
  >;
  /** Every scope the request might need. Empty for any working key. */
  "x-scopes": readonly ApiScope[];
  /** Sensitive scopes that add fields to the response. */
  "x-widened-by": readonly ApiScope[];
  /** Its place in the reference. Paths group operations, this doesn't. */
  "x-order": number;
};

export type OpenApiMethod = "get" | "post" | "patch" | "delete";

export type OpenApiSpec = {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  servers: [{ url: string }];
  tags: readonly { name: string; description: string }[];
  paths: Record<string, Partial<Record<OpenApiMethod, OpenApiOperation>>>;
  components: {
    securitySchemes: { bearer: { type: "http"; scheme: "bearer" } };
  };
  security: [{ bearer: [] }];
};

/** An operation with where it lives, as the reference walks them. */
export type SpecOperation = OpenApiOperation & {
  method: OpenApiMethod;
  path: string;
};

/** Every operation in the spec, in the reference's order. */
export function operationsOf(spec: OpenApiSpec): SpecOperation[] {
  return Object.entries(spec.paths)
    .flatMap(([path, methods]) =>
      (Object.entries(methods) as [OpenApiMethod, OpenApiOperation][]).map(
        ([method, operation]) => ({ ...operation, method, path }),
      ),
    )
    .sort((a, b) => a["x-order"] - b["x-order"]);
}
