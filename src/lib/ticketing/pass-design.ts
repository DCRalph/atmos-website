import { z } from "zod";

import {
  DEFAULT_PASS_THEME,
  HEX_COLOUR_PATTERN,
  PASS_BAND_STYLES,
  PASS_GUIDE_LINKS,
  PASS_LAYOUTS,
  PASS_LAYOUT_INFO,
  isHexColour,
  type PassGuideLinkKey,
  type PassLayout,
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
 *   4. the linked gig           only the poster, see `resolveTicketPassDesign`
 *   5. Atmos house style        `DEFAULT_PASS_THEME`
 *
 * Fields fall through one at a time, so an AAA level that only sets an accent
 * still gets the event's photo and logo. Client-safe: the admin preview
 * resolves with the very same function the pass builder does.
 */

/** Ceiling on how far a photo band is darkened; past this it is just black. */
export const MAX_STRIP_DIM = 0.8;
export const DEFAULT_STRIP_DIM = 0.3;
/** How close to the venue a pass offers itself on the lock screen. */
export const DEFAULT_NEAR_VENUE_M = 500;

const hex = z
  .string()
  .trim()
  .regex(HEX_COLOUR_PATTERN, "Use a hex colour like #470082");

const url = z
  .string()
  .trim()
  .url("Needs a full link, starting https://")
  .max(500);

/** A row the organiser adds to the back of the pass. */
export const passBackRowSchema = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.string().trim().min(1).max(600),
});
export type PassBackRow = z.infer<typeof passBackRowSchema>;

/** One optional URL per event guide button, keyed as the registry names them. */
const guideLinks = {
  parkingUrl: url,
  transitUrl: url,
  foodUrl: url,
  bagPolicyUrl: url,
  accessibilityUrl: url,
  addOnsUrl: url,
  merchUrl: url,
} satisfies Record<PassGuideLinkKey, z.ZodType>;

/**
 * One layer. Every field is optional; a missing one means "whatever the layer
 * below says". Colours are validated because they are interpolated straight
 * into the pass SVG; links because they are handed to Wallet as-is.
 */
export const passDesignSchema = z
  .object({
    layout: z.enum(PASS_LAYOUTS),
    stripStyle: z.enum(PASS_BAND_STYLES),
    /** `file_upload.id` of the band photo. Only drawn when the style is `PHOTO`. */
    stripImageId: z.string().min(1),
    stripDim: z.number().min(0).max(MAX_STRIP_DIM),
    /** `file_upload.id` of the portrait artwork a BLUR or POSTER pass is built from. */
    posterImageId: z.string().min(1),
    /** `file_upload.id` of a logo that replaces the Atmos wordmark. */
    logoImageId: z.string().min(1),
    /** A word beside the logo in the header, such as PRESENTS. */
    logoText: z.string().trim().min(1).max(24),
    accentHex: hex,
    backgroundHex: hex,
    foregroundHex: hex,
    labelHex: hex,
    /** Poster only: the chin under the artwork. Unset leaves it to Wallet's blur. */
    chinHex: hex,
    /** Poster only: darken the top of the artwork so the logo stays readable. */
    headerShade: z.boolean(),
    /** Poster only: let Wallet pick text colours from the artwork. */
    autoColours: z.boolean(),
    /** Off when the band photo already carries the event's name. */
    showTitle: z.boolean(),
    /** The access level's chip on the band. Unset follows the level's rank. */
    showChip: z.boolean(),
    ...guideLinks,
    venuePhone: z.string().trim().min(3).max(40),
    venueEmail: z.string().trim().email().max(120),
    venueWebsite: url,
    /** Transfer in the pass menu, opening the holder's ticket page. */
    transfer: z.boolean(),
    /** Off removes Wallet's Share button from the back of the pass. */
    allowSharing: z.boolean(),
    backRows: z.array(passBackRowSchema).max(12),
    venueLat: z.number().min(-90).max(90),
    venueLng: z.number().min(-180).max(180),
    /** Metres from the venue within which the pass offers itself. */
    nearVenueM: z.number().int().min(50).max(5000),
    /** Tell holders when doors, the date or the venue change. */
    notifyChanges: z.boolean(),
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

export type PassVenueLocation = {
  latitude: number;
  longitude: number;
  radiusM: number;
};

export type ResolvedPassDesign = PassTheme & {
  /** What is actually built: a poster layout with no poster is the band. */
  layout: PassLayout;
  stripDim: number;
  /** Set only when the band is a photo. */
  stripImageId: string | null;
  posterImageId: string | null;
  logoImageId: string | null;
  logoText: string | null;
  chinHex: string | null;
  headerShade: boolean;
  autoColours: boolean;
  showTitle: boolean;
  /** Null when no layer decided, which leaves it to the level's rank. */
  showChip: boolean | null;
  guide: Record<PassGuideLinkKey, string | null>;
  venuePhone: string | null;
  venueEmail: string | null;
  venueWebsite: string | null;
  transfer: boolean;
  allowSharing: boolean;
  backRows: PassBackRow[];
  /** Null unless both coordinates are set. */
  venueLocation: PassVenueLocation | null;
  notifyChanges: boolean;
};

/**
 * Layers merged and filled in from house style.
 *
 * A colour that is not a hex (an admin mid-way through typing one) falls back
 * rather than emitting broken SVG, a photo band with no photo is drawn as the
 * house band instead of a black bar, and a layout that needs a poster but has
 * none is built as the band.
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

  const poster = merged.posterImageId ?? null;
  const wanted = merged.layout ?? "BAND";
  const layout =
    PASS_LAYOUT_INFO[wanted].needsPoster && !poster ? "BAND" : wanted;

  const venueLocation =
    merged.venueLat !== undefined && merged.venueLng !== undefined
      ? {
          latitude: merged.venueLat,
          longitude: merged.venueLng,
          radiusM: merged.nearVenueM ?? DEFAULT_NEAR_VENUE_M,
        }
      : null;

  return {
    layout,
    stripStyle,
    stripDim: merged.stripDim ?? DEFAULT_STRIP_DIM,
    stripImageId: photo ?? null,
    posterImageId: poster,
    logoImageId: merged.logoImageId ?? null,
    logoText: merged.logoText ?? null,
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
    chinHex:
      merged.chinHex && isHexColour(merged.chinHex) ? merged.chinHex : null,
    headerShade: merged.headerShade ?? true,
    autoColours: merged.autoColours ?? false,
    showTitle: merged.showTitle ?? true,
    showChip: merged.showChip ?? null,
    guide: Object.fromEntries(
      PASS_GUIDE_LINKS.map((link) => [link.key, merged[link.key] ?? null]),
    ) as Record<PassGuideLinkKey, string | null>,
    venuePhone: merged.venuePhone ?? null,
    venueEmail: merged.venueEmail ?? null,
    venueWebsite: merged.venueWebsite ?? null,
    transfer: merged.transfer ?? true,
    allowSharing: merged.allowSharing ?? true,
    backRows: merged.backRows ?? [],
    venueLocation,
    notifyChanges: merged.notifyChanges ?? true,
  };
}

/** The guide links that are set, in display order. */
export function guideLinksOf(design: ResolvedPassDesign) {
  return PASS_GUIDE_LINKS.flatMap((link) => {
    const value = design.guide[link.key];
    return value ? [{ ...link, url: value }] : [];
  });
}

/** What a level contributes to one ticket's pass: the chip and how loud it is. */
export type PassLevel = {
  code: string;
  short: string;
  rank: number;
  passDesign: PassDesign;
};

/**
 * One ticket's look: its level at its event, its level, then its event, then
 * whatever the linked gig lends it (its poster). The debugger can put one more
 * layer over all of that to try a change without saving it.
 *
 * The chip shows on any level above general admission that brings its own
 * accent, unless a layer says otherwise, and only on the band layout: it is
 * part of the band's artwork, and the other layouts have no band. It is drawn
 * dark with accent type because it sits on the accent-flooded end of the band,
 * where an accent chip would read only by its edge.
 */
export function resolveTicketPassDesign(
  event: EventPassDesign,
  level: PassLevel,
  gig: PassDesign = {},
  /** Above everything: the debugger trying something on a real event. */
  override: PassDesign = {},
) {
  const { levels, ...eventLayer } = event;
  const here = levels?.[level.code];
  const design = resolvePassDesign([
    override,
    here,
    level.passDesign,
    eventLayer,
    gig,
  ]);
  const levelAccent =
    override.accentHex ?? here?.accentHex ?? level.passDesign.accentHex;
  const showChip =
    design.showChip ?? (level.rank > 0 && levelAccent !== undefined);

  return {
    design,
    chip:
      showChip && design.layout === "BAND"
        ? {
            text: level.short,
            background: design.backgroundHex,
            foreground: design.accentHex,
          }
        : null,
  };
}
