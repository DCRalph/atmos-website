import "server-only";

import { z } from "zod";

import { env } from "~/env";
import type {
  JsonSchema,
  OpenApiMethod,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiSpec,
} from "~/lib/developer/openapi";
import { KEY_REQUESTS_PER_MINUTE } from "~/lib/developer/scopes";
import { scopesOf, type Endpoint } from "./endpoint";
import { ENDPOINTS, TAGS } from "./registry";

/**
 * The developer API as an OpenAPI 3.1 document, built from the endpoint list.
 * Served at `GET /api/v1/openapi.json` for any tool that reads OpenAPI, and
 * rendered by the admin's reference and playground.
 */

const ERROR_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
      required: ["code", "message"],
    },
  },
  required: ["error"],
};

/** Zod's JSON Schema, tidied for reading: dates as date-time, no noise. */
function jsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = z.toJSONSchema(schema, {
    io,
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema: out }) => {
      if (zodSchema._zod.def.type === "date") {
        out.type = "string";
        out.format = "date-time";
      }
      // The ISO pattern is a screenful of regex that says "date-time".
      if (out.format === "date-time") delete out.pattern;
      if (out.maximum === Number.MAX_SAFE_INTEGER) delete out.maximum;
      if (out.minimum === Number.MIN_SAFE_INTEGER) delete out.minimum;
    },
  }) as JsonSchema & { $schema?: string };
  delete json.$schema;
  return json;
}

/** Each field of a params or query object as its own parameter. */
function parametersOf(
  shape: z.ZodObject | undefined,
  location: "path" | "query",
): OpenApiParameter[] {
  if (!shape) return [];
  return Object.entries(shape.shape).map(([name, field]) => {
    const schema = jsonSchema(field as z.ZodType, "input");
    const { description, ...rest } = schema;
    return {
      name,
      in: location,
      required:
        location === "path" ||
        !(field as z.ZodType).safeParse(undefined).success,
      ...(description ? { description } : {}),
      schema: rest,
    };
  });
}

function operationOf(endpoint: Endpoint, order: number): OpenApiOperation {
  const status = String(endpoint.status ?? 200);
  return {
    operationId: `${endpoint.method.toLowerCase()}${endpoint.path
      .replace(/\{(\w+)\}/g, "by-$1")
      .split(/[/-]/)
      .filter(Boolean)
      .map((part) => part[0]!.toUpperCase() + part.slice(1))
      .join("")}`,
    summary: endpoint.summary,
    ...(endpoint.description ? { description: endpoint.description } : {}),
    tags: [endpoint.tag],
    parameters: [
      ...parametersOf(endpoint.params, "path"),
      ...parametersOf(endpoint.query, "query"),
    ],
    ...(endpoint.body
      ? {
          requestBody: {
            required: true as const,
            content: {
              "application/json": {
                schema: jsonSchema(endpoint.body, "input"),
                ...(endpoint.example !== undefined
                  ? { example: endpoint.example }
                  : {}),
              },
            },
          },
        }
      : {}),
    responses: {
      [status]: {
        description: status === "201" ? "Created" : "OK",
        content: {
          "application/json": {
            schema: jsonSchema(endpoint.response, "output"),
          },
        },
      },
      default: {
        description: "An error. See Errors.",
        content: { "application/json": { schema: ERROR_SCHEMA } },
      },
    },
    "x-scopes": scopesOf(endpoint.scope),
    "x-widened-by": endpoint.widenedBy ?? [],
    "x-order": order,
  };
}

let cached: OpenApiSpec | null = null;

export function openApiSpec(): OpenApiSpec {
  if (cached) return cached;

  const paths: OpenApiSpec["paths"] = {};
  ENDPOINTS.forEach((endpoint, order) => {
    const methods = (paths[endpoint.path] ??= {});
    methods[endpoint.method.toLowerCase() as OpenApiMethod] = operationOf(
      endpoint,
      order,
    );
  });

  cached = {
    openapi: "3.1.0",
    info: {
      title: "Atmos API",
      version: "1",
      description: `Gigs, ticketed events, sales, the door and notifications. Authenticate with an API key from Admin, Developer as a bearer token. Each key may make ${KEY_REQUESTS_PER_MINUTE} requests a minute.`,
    },
    servers: [{ url: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/v1` }],
    tags: TAGS,
    paths,
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    },
    security: [{ bearer: [] }],
  };
  return cached;
}
