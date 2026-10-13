import { z } from "zod";

import {
  eventPassDesignSchema,
  passDesignSchema,
  type PassDesign,
} from "./pass-design";

/**
 * The wallet debugger's draft, and the shape of what it talks to the server
 * about. Client-safe: the page validates before it sends, the route validates
 * again before it signs.
 *
 * A draft is three things laid over each other:
 *
 *   1. a source: a sample night, a real event and level, or a real ticket,
 *      which the server composes into pass.json and artwork exactly as a
 *      holder would get them;
 *   2. a design layer, which the Look, Links, Back and Phone tabs edit the way
 *      the event editor does, over whatever the source's own design is;
 *   3. a patch of raw keys from the Fields, Semantics, Advanced and JSON tabs,
 *      applied last. Anything touched there is the organiser's; the rest keeps
 *      following the source.
 */

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema,
);

const DATA_BASE64_LIMIT = 3_000_000;

/**
 * Pass assets accepted by Wallet, optionally inside one localization folder.
 * Keeping the path grammar narrow prevents uploaded names from becoming paths
 * outside the pass bundle while still allowing every image slot Apple uses.
 */
export const PASS_ASSET_NAME_PATTERN =
  /^(?:[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*\.lproj\/)?[A-Za-z][A-Za-z0-9_-]*(?:@[23]x)?\.png$/;

export const walletPassAssetSchema = z.object({
  fileName: z.string().regex(PASS_ASSET_NAME_PATTERN),
  dataBase64: z
    .string()
    .min(1)
    .max(DATA_BASE64_LIMIT)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

export type WalletPassAsset = z.infer<typeof walletPassAssetSchema>;

export const walletPassLocalizationSchema = z.object({
  language: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
  translations: z.record(
    z.string().trim().min(1).max(200),
    z.string().max(2_000),
  ),
});

export type WalletPassLocalization = z.infer<
  typeof walletPassLocalizationSchema
>;

/** Where a draft starts. Changing it recomposes everything under it. */
export const walletPassSourceSchema = z.discriminatedUnion("kind", [
  /** A sample night at a sample venue, at the chosen level. */
  z.object({ kind: z.literal("standalone"), level: z.string().optional() }),
  /** A real event's design, with a sample ticket at the chosen level. */
  z.object({
    kind: z.literal("event"),
    eventId: z.string().min(1),
    level: z.string().optional(),
  }),
  /** A real ticket. Its QR is real, so send it only to yourself. */
  z.object({
    kind: z.literal("ticket"),
    ticketNumber: z.string().trim().min(1),
  }),
]);

export type WalletPassSource = z.infer<typeof walletPassSourceSchema>;

export const walletPassDebugDraftSchema = z.object({
  source: walletPassSourceSchema,
  design: passDesignSchema,
  patch: jsonObjectSchema,
  assets: z.array(walletPassAssetSchema).max(30),
  localizations: z.array(walletPassLocalizationSchema).max(20),
  personalization: jsonObjectSchema.nullable(),
});

export type WalletPassDebugDraft = z.infer<typeof walletPassDebugDraftSchema>;

export function blankDraft(source: WalletPassSource): WalletPassDebugDraft {
  return {
    source,
    design: {},
    patch: {},
    assets: [],
    localizations: [],
    personalization: null,
  };
}

export const walletPassDebugRequestSchema = z
  .object({
    action: z.enum(["compose", "download", "send"]),
    recipient: z.string().trim().email().optional(),
    draft: walletPassDebugDraftSchema,
  })
  .superRefine((value, ctx) => {
    if (value.action === "send" && !value.recipient) {
      ctx.addIssue({
        code: "custom",
        path: ["recipient"],
        message: "Enter an email recipient.",
      });
    }
  });

export type WalletPassDebugRequest = z.infer<
  typeof walletPassDebugRequestSchema
>;

/** What the page needs before it can compose anything. */
export const walletPassDebugDefaultsResponseSchema = z.object({
  configured: z.boolean(),
  certificateDaysRemaining: z.number().int().nullable(),
  events: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      startsAt: z.string(),
      status: z.string(),
    }),
  ),
  levels: z.array(
    z.object({ code: z.string(), label: z.string(), short: z.string() }),
  ),
});

export type WalletPassDebugDefaultsResponse = z.infer<
  typeof walletPassDebugDefaultsResponseSchema
>;

/**
 * One composition: the source and design turned into a pass, the patch laid
 * over it, and what the pass library makes of the result.
 */
export const walletPassDebugComposeResponseSchema = z.object({
  manifest: jsonObjectSchema,
  /** The files the bundle would carry, by name, with their size in bytes. */
  files: z.array(z.object({ name: z.string(), bytes: z.number().int() })),
  /** Null when signing is not configured, so nothing could validate it. */
  validation: z
    .discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), keys: z.number().int() }),
      z.object({ ok: z.literal(false), error: z.string() }),
    ])
    .nullable(),
  /**
   * The layers under the debugger's own, so the Look tab can resolve the
   * design and its chip exactly as the builder did, and label where each
   * inherited field comes from.
   */
  eventDesign: eventPassDesignSchema,
  gig: passDesignSchema,
  level: z.object({
    code: z.string(),
    label: z.string(),
    short: z.string(),
    rank: z.number(),
    intensity: z.number(),
    passDesign: passDesignSchema,
  }),
  context: z.object({
    eventName: z.string(),
    venueAddress: z.string().nullable(),
    /** A real ticket's pass, with a real QR. */
    real: z.boolean(),
  }),
});

export type WalletPassDebugComposeResponse = z.infer<
  typeof walletPassDebugComposeResponseSchema
>;

export const PASS_FIELD_SLOTS = [
  "headerFields",
  "primaryFields",
  "secondaryFields",
  "auxiliaryFields",
  "additionalInfoFields",
  "backFields",
] as const;

export type PassFieldSlot = (typeof PASS_FIELD_SLOTS)[number];

export const PASS_FIELD_SLOT_LABELS: Record<PassFieldSlot, string> = {
  headerFields: "Header",
  primaryFields: "Primary",
  secondaryFields: "Secondary",
  auxiliaryFields: "Auxiliary",
  additionalInfoFields: "Additional info",
  backFields: "Back",
};

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isJsonPrimitive(
  value: JsonValue | undefined,
): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  );
}

export function parseJsonObject(text: string): JsonObject {
  return jsonObjectSchema.parse(JSON.parse(text));
}

export function prettyJson(value: JsonValue): string {
  return JSON.stringify(value, null, 2);
}

/** A string, number or boolean as text; anything else is empty. */
export function textOf(value: JsonValue | undefined): string {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : "";
}

/**
 * The patch over the composed pass.json.
 *
 * Top-level keys replace wholesale, with two exceptions that keep editing
 * one part from discarding the rest: `eventTicket` merges slot by slot, and
 * `semantics` merges key by key. A null anywhere removes the key it sits on.
 */
export function applyPatch(base: JsonObject, patch: JsonObject): JsonObject {
  const merge = (into: JsonObject, over: JsonObject): JsonObject => {
    const out = { ...into };
    for (const [key, value] of Object.entries(over)) {
      if (value === null) delete out[key];
      else out[key] = value;
    }
    return out;
  };
  const out: JsonObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete out[key];
    } else if (
      (key === "eventTicket" || key === "semantics") &&
      isJsonObject(value)
    ) {
      const current = out[key];
      out[key] = merge(isJsonObject(current) ? current : {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function fieldsOf(
  manifest: JsonObject,
  slot: PassFieldSlot,
): JsonObject[] {
  const ticket = manifest.eventTicket;
  if (!isJsonObject(ticket)) return [];
  const list = ticket[slot];
  return Array.isArray(list) ? list.filter(isJsonObject) : [];
}

export function semanticsOf(manifest: JsonObject): JsonObject {
  return isJsonObject(manifest.semantics) ? manifest.semantics : {};
}

export function barcodesOf(manifest: JsonObject): JsonObject[] {
  return Array.isArray(manifest.barcodes)
    ? manifest.barcodes.filter(isJsonObject)
    : [];
}

/**
 * The design the Look tab edits is a `PassDesign`; the debugger stores it on
 * the draft as-is. Exported for the one place that needs the type by name.
 */
export type WalletPassDebugDesign = PassDesign;
