import { z } from "zod";

import {
  DEFAULT_PASS_THEME,
  HEX_COLOUR_PATTERN,
  PASS_BAND_STYLES,
  isHexColour,
  type PassTheme,
} from "./pass-theme";

/**
 * How a wallet pass looks, in layers.
 *
 * The same shape is stored in three places, and a ticket's pass takes each
 * field from the first of them that sets it:
 *
 *   1. its level at its event   `ticket_event.passDesign.levels[code]`
 *   2. its access level         `access_level.passDesign`
 *   3. its event                `ticket_event.passDesign`
 *   4. Atmos house style        `DEFAULT_PASS_THEME`
 *
 * Fields fall through one at a time, so an AAA level that only sets an accent
 * still gets the event's photo and logo. Client-safe: the admin preview
 * resolves with the very same function the pass builder does.
 */

/** Ceiling on how far a photo band is darkened; past this it is just black. */
export const MAX_STRIP_DIM = 0.8;
export const DEFAULT_STRIP_DIM = 0.3;

const hex = z
  .string()
  .trim()
  .regex(HEX_COLOUR_PATTERN, "Use a hex colour like #470082");

/**
 * One layer. Every field is optional; a missing one means "whatever the layer
 * below says". Colours are validated because they are interpolated straight
 * into the pass SVG.
 */
export const passDesignSchema = z
  .object({
    stripStyle: z.enum(PASS_BAND_STYLES),
    /** `file_upload.id` of the band photo. Only drawn when the style is `PHOTO`. */
    stripImageId: z.string().min(1),
    stripDim: z.number().min(0).max(MAX_STRIP_DIM),
    /** `file_upload.id` of a logo that replaces the Atmos wordmark. */
    logoImageId: z.string().min(1),
    accentHex: hex,
    backgroundHex: hex,
    foregroundHex: hex,
    labelHex: hex,
    /** Off when the band photo already carries the event's name. */
    showTitle: z.boolean(),
    /** The access level's chip on the band. Unset follows the level's rank. */
    showChip: z.boolean(),
  })
  .partial();

export type PassDesign = z.infer<typeof passDesignSchema>;
export type PassDesignKey = keyof PassDesign;

/** An event's own layer, plus its per-level overrides keyed by level code. */
export const eventPassDesignSchema = passDesignSchema.extend({
  levels: z.record(z.string(), passDesignSchema).optional(),
});

export type EventPassDesign = z.infer<typeof eventPassDesignSchema>;

/**
 * A stored design, or an empty one. Read off a JSON column, so anything
 * malformed degrades to "inherit everything" rather than breaking a pass.
 */
export function parsePassDesign(value: unknown): PassDesign {
  const parsed = passDesignSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function parseEventPassDesign(value: unknown): EventPassDesign {
  const parsed = eventPassDesignSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

/**
 * An event design with the noise taken out, so two that mean the same thing
 * compare equal: unset fields dropped, empty level overrides removed, levels in
 * a stable order. What gets stored, and what pass-update checks compare.
 */
export function normaliseEventPassDesign(
  design: EventPassDesign,
): EventPassDesign {
  const { levels, ...base } = design;
  const kept = Object.entries(levels ?? {})
    .map(([code, layer]) => [code, defined(layer)] as const)
    .filter(([, layer]) => Object.keys(layer).length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  return {
    ...defined(base),
    ...(kept.length > 0 ? { levels: Object.fromEntries(kept) } : {}),
  };
}

function defined(layer: PassDesign): PassDesign {
  return Object.fromEntries(
    Object.entries(layer).filter(([, value]) => value !== undefined),
  );
}

/** Highest priority first. The first layer to set a field wins it. */
export function mergePassDesigns(
  layers: readonly (PassDesign | null | undefined)[],
): PassDesign {
  return layers.reduceRight<PassDesign>(
    (merged, layer) => ({ ...merged, ...(layer ? defined(layer) : {}) }),
    {},
  );
}

export type ResolvedPassDesign = PassTheme & {
  stripDim: number;
  /** Set only when the band is a photo. */
  stripImageId: string | null;
  logoImageId: string | null;
  showTitle: boolean;
  /** Null when no layer decided, which leaves it to the level's rank. */
  showChip: boolean | null;
};

/**
 * Layers merged and filled in from house style.
 *
 * A colour that is not a hex (an admin mid-way through typing one) falls back
 * rather than emitting broken SVG, and a photo band with no photo is drawn as
 * the house band instead of a black bar.
 */
export function resolvePassDesign(
  layers: readonly (PassDesign | null | undefined)[],
): ResolvedPassDesign {
  const merged = mergePassDesigns(layers);
  const colour = (value: string | undefined, fallback: string) =>
    value && isHexColour(value) ? value : fallback;

  const photo = merged.stripStyle === "PHOTO" ? merged.stripImageId : null;
  const stripStyle =
    merged.stripStyle === "PHOTO" && !photo
      ? DEFAULT_PASS_THEME.stripStyle
      : (merged.stripStyle ?? DEFAULT_PASS_THEME.stripStyle);

  return {
    stripStyle,
    stripDim: merged.stripDim ?? DEFAULT_STRIP_DIM,
    stripImageId: photo ?? null,
    logoImageId: merged.logoImageId ?? null,
    accentHex: colour(merged.accentHex, DEFAULT_PASS_THEME.accentHex),
    backgroundHex: colour(
      merged.backgroundHex,
      DEFAULT_PASS_THEME.backgroundHex,
    ),
    foregroundHex: colour(
      merged.foregroundHex,
      DEFAULT_PASS_THEME.foregroundHex,
    ),
    labelHex: colour(merged.labelHex, DEFAULT_PASS_THEME.labelHex),
    showTitle: merged.showTitle ?? true,
    showChip: merged.showChip ?? null,
  };
}

/** What a level contributes to one ticket's pass: the chip and how loud it is. */
export type PassLevel = {
  code: string;
  short: string;
  rank: number;
  passDesign: PassDesign;
};

/**
 * One ticket's look: its level at its event, its level, then its event.
 *
 * The chip shows on any level above general admission that brings its own
 * accent, unless a layer says otherwise. It is drawn dark with accent type
 * because it sits on the accent-flooded end of the band, where an accent chip
 * would read only by its edge.
 */
export function resolveTicketPassDesign(
  event: EventPassDesign,
  level: PassLevel,
) {
  const { levels, ...eventLayer } = event;
  const here = levels?.[level.code];
  const design = resolvePassDesign([here, level.passDesign, eventLayer]);
  const levelAccent = here?.accentHex ?? level.passDesign.accentHex;
  const showChip =
    design.showChip ?? (level.rank > 0 && levelAccent !== undefined);

  return {
    design,
    chip: showChip
      ? {
          text: level.short,
          background: design.backgroundHex,
          foreground: design.accentHex,
        }
      : null,
  };
}
