import { z } from "zod";

import {
  DEFAULT_PASS_THEME,
  PASS_STRIP_STYLES,
  toPassRgb,
  type PassStripStyle,
  type PassTheme,
} from "~/lib/ticketing/pass-theme";

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

export const walletPassDebugDraftSchema = z.object({
  manifest: jsonObjectSchema,
  theme: z.object({
    stripStyle: z.enum(PASS_STRIP_STYLES),
    accentHex: z.string().regex(/^#[\dA-Fa-f]{6}$/),
    backgroundHex: z.string().regex(/^#[\dA-Fa-f]{6}$/),
    foregroundHex: z.string().regex(/^#[\dA-Fa-f]{6}$/),
    labelHex: z.string().regex(/^#[\dA-Fa-f]{6}$/),
  }),
  assets: z.array(walletPassAssetSchema).max(30),
  localizations: z.array(walletPassLocalizationSchema).max(20),
  personalization: jsonObjectSchema.nullable(),
});

export type WalletPassDebugDraft = z.infer<typeof walletPassDebugDraftSchema>;

export const walletPassDebugRequestSchema = z
  .object({
    action: z.enum(["download", "send"]),
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

export const walletPassDebugDefaultsResponseSchema = z.object({
  configured: z.boolean(),
  certificateDaysRemaining: z.number().int().nullable(),
  draft: walletPassDebugDraftSchema,
});

export type WalletPassDebugDefaultsResponse = z.infer<
  typeof walletPassDebugDefaultsResponseSchema
>;

export const DEFAULT_DEBUG_PASS_THEME: PassTheme = {
  ...DEFAULT_PASS_THEME,
  stripStyle: "HATCH",
};

/** A fresh, unlinked Event Ticket manifest with safe Atmos defaults. */
export function createStandalonePassDraft({
  passTypeIdentifier,
  teamIdentifier,
  serialNumber,
  now = new Date(),
}: {
  passTypeIdentifier: string;
  teamIdentifier: string;
  serialNumber: string;
  now?: Date;
}): WalletPassDebugDraft {
  const eventDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const expiresAt = new Date(eventDate.getTime() + 24 * 60 * 60 * 1_000);

  return {
    theme: { ...DEFAULT_DEBUG_PASS_THEME },
    assets: [],
    localizations: [],
    personalization: null,
    manifest: {
      formatVersion: 1,
      passTypeIdentifier,
      teamIdentifier,
      serialNumber,
      organizationName: "Atmos Media",
      description: "Standalone Apple Wallet ticket",
      logoText: "ATMOS",
      backgroundColor: toPassRgb(DEFAULT_DEBUG_PASS_THEME.backgroundHex),
      foregroundColor: toPassRgb(DEFAULT_DEBUG_PASS_THEME.foregroundHex),
      labelColor: toPassRgb(DEFAULT_DEBUG_PASS_THEME.labelHex),
      relevantDate: eventDate.toISOString(),
      expirationDate: expiresAt.toISOString(),
      sharingProhibited: false,
      suppressStripShine: false,
      eventTicket: {
        headerFields: [{ key: "doors", label: "DOORS", value: "9:30 pm" }],
        primaryFields: [
          { key: "event", label: "EVENT", value: "Atmos test event" },
        ],
        secondaryFields: [
          { key: "date", label: "DATE", value: "Saturday 12 September" },
          { key: "venue", label: "VENUE", value: "The Boat Shed" },
        ],
        auxiliaryFields: [
          { key: "access", label: "ACCESS", value: "General admission" },
          { key: "name", label: "NAME", value: "Test attendee" },
        ],
        additionalInfoFields: [],
        backFields: [
          {
            key: "details",
            label: "Details",
            value: "This standalone pass is not linked to an Atmos ticket.",
          },
        ],
      },
      barcodes: [
        {
          format: "PKBarcodeFormatQR",
          message: `ATMOS-DEBUG-${serialNumber.slice(-12).toUpperCase()}`,
          messageEncoding: "iso-8859-1",
          altText: "Standalone test pass",
        },
      ],
    },
  };
}

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

export type PassFieldDraft = JsonObject & {
  key: string;
  value: JsonPrimitive;
};

export type PassThemeDraft = PassTheme & { stripStyle: PassStripStyle };

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

export function cloneJsonObject(value: JsonObject): JsonObject {
  return structuredClone(value);
}

export function parseJsonObject(text: string): JsonObject {
  return jsonObjectSchema.parse(JSON.parse(text));
}

export function prettyJson(value: JsonValue): string {
  return JSON.stringify(value, null, 2);
}
