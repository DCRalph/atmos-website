import { z } from "zod";
import type React from "react";
import type { CreatorBlockTypeName } from "~/components/creator/block-types";
import { buildMediaUrl } from "~/lib/media-url";

/**
 * Creator profile theme tokens.
 *
 * This is the curated set of design tokens that a `CreatorProfileTheme` can
 * customize. Every token is rendered to a `--creator-*` CSS variable on the
 * public profile root (and, when overridden per-block, on each
 * `.creator-block` wrapper). Blocks read these variables so they automatically
 * inherit the active theme without needing to know about `CreatorProfileTheme`
 * itself.
 */
export type BlockShadow = "none" | "sm" | "md" | "lg";
export type ButtonStyle = "solid" | "outline" | "ghost";
export type Density = "compact" | "comfortable" | "spacious";
export type FontStack =
  | "inherit"
  | "sans"
  | "serif"
  | "mono"
  | "display"
  | "handwritten";

export type ThemeTokens = {
  // Page
  pageBg: string;
  pageFg: string;
  /**
   * `file_upload.id` of the background image (resolved via `buildMediaUrl`
   * at render time). `null` means no background image.
   */
  pageBgImageFileId: string | null;
  pageBgOverlay: string | null;
  // Accent
  accent: string;
  accentFg: string;
  // Typography
  headingFont: FontStack;
  bodyFont: FontStack;
  headingWeight: number;
  letterSpacing: number; // in px, 0 = normal
  // Block surface
  blockBg: string;
  blockFg: string;
  blockBorder: string;
  blockBorderWidth: number; // px
  blockRadius: number; // px
  blockShadow: BlockShadow;
  blockPaddingX: number; // px
  blockPaddingY: number; // px
  // Links / buttons
  linkColor: string;
  linkHoverColor: string;
  buttonStyle: ButtonStyle;
  buttonRadius: number;
  // Layout
  density: Density;
  bannerOverlay: string | null;
};

/**
 * Block-specific overrides — these are extra fields (beyond `ThemeTokens`)
 * that only make sense for a given block type. Each override entry is a
 * `Partial<ThemeTokens> & BlockSpecificTokens[type]`.
 */
export type BlockSpecificTokens = {
  HEADING: {
    headingColor?: string;
  };
  SOCIAL_LINKS: {
    socialPillStyle?: "solid" | "outline" | "ghost";
  };
  PAST_GIGS: {
    pastGigsCellRadius?: number;
  };
};

/** Flattened union of every block-specific field (all optional). */
export type BlockSpecificAll = {
  headingColor?: string;
  socialPillStyle?: "solid" | "outline" | "ghost";
  pastGigsCellRadius?: number;
};

export type BlockOverride = Partial<ThemeTokens> & BlockSpecificAll;

export type BlockOverrides = Partial<Record<CreatorBlockTypeName, BlockOverride>>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  pageBg: "#0a0a0a",
  pageFg: "#fafafa",
  pageBgImageFileId: null,
  pageBgOverlay: null,

  accent: "#6366f1",
  accentFg: "#ffffff",

  headingFont: "sans",
  bodyFont: "sans",
  headingWeight: 700,
  letterSpacing: 0,

  blockBg: "rgba(255,255,255,0.03)",
  blockFg: "#fafafa",
  blockBorder: "rgba(255,255,255,0.08)",
  blockBorderWidth: 1,
  blockRadius: 8,
  blockShadow: "none",
  blockPaddingX: 12,
  blockPaddingY: 12,

  linkColor: "#6366f1",
  linkHoverColor: "#818cf8",
  buttonStyle: "solid",
  buttonRadius: 6,

  density: "comfortable",
  bannerOverlay: null,
};

export const LIGHT_THEME_TOKENS: ThemeTokens = {
  pageBg: "#ffffff",
  pageFg: "#0a0a0a",
  pageBgImageFileId: null,
  pageBgOverlay: null,

  accent: "#6366f1",
  accentFg: "#ffffff",

  headingFont: "sans",
  bodyFont: "sans",
  headingWeight: 700,
  letterSpacing: 0,

  blockBg: "#ffffff",
  blockFg: "#0a0a0a",
  blockBorder: "rgba(0,0,0,0.08)",
  blockBorderWidth: 1,
  blockRadius: 8,
  blockShadow: "sm",
  blockPaddingX: 12,
  blockPaddingY: 12,

  linkColor: "#6366f1",
  linkHoverColor: "#4f46e5",
  buttonStyle: "solid",
  buttonRadius: 6,

  density: "comfortable",
  bannerOverlay: null,
};

export const DEFAULT_BLOCK_OVERRIDES: BlockOverrides = {};

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const zFontStack = z.enum([
  "inherit",
  "sans",
  "serif",
  "mono",
  "display",
  "handwritten",
]);
const zBlockShadow = z.enum(["none", "sm", "md", "lg"]);
const zButtonStyle = z.enum(["solid", "outline", "ghost"]);
const zDensity = z.enum(["compact", "comfortable", "spacious"]);

/** Color string — we don't validate format strictly (allow hex, rgb/rgba, css color). */
const zColor = z.string().min(1).max(64);
const zNullableColor = zColor.nullable();
const zNullableString = z.string().max(512).nullable();

export const zThemeTokens = z.object({
  pageBg: zColor,
  pageFg: zColor,
  pageBgImageFileId: zNullableString,
  pageBgOverlay: zNullableColor,

  accent: zColor,
  accentFg: zColor,

  headingFont: zFontStack,
  bodyFont: zFontStack,
  headingWeight: z.number().int().min(100).max(900),
  letterSpacing: z.number().min(-4).max(16),

  blockBg: zColor,
  blockFg: zColor,
  blockBorder: zColor,
  blockBorderWidth: z.number().int().min(0).max(16),
  blockRadius: z.number().int().min(0).max(64),
  blockShadow: zBlockShadow,
  blockPaddingX: z.number().int().min(0).max(64),
  blockPaddingY: z.number().int().min(0).max(64),

  linkColor: zColor,
  linkHoverColor: zColor,
  buttonStyle: zButtonStyle,
  buttonRadius: z.number().int().min(0).max(64),

  density: zDensity,
  bannerOverlay: zNullableColor,
});

const zBlockSpecific = z.object({
  headingColor: zColor.optional(),
  socialPillStyle: z.enum(["solid", "outline", "ghost"]).optional(),
  pastGigsCellRadius: z.number().int().min(0).max(64).optional(),
});

export const zBlockOverride = zThemeTokens
  .partial()
  .and(zBlockSpecific);

const BLOCK_TYPE_NAMES = [
  "HEADING",
  "RICH_TEXT",
  "IMAGE",
  "GALLERY",
  "SOUNDCLOUD_TRACK",
  "SOUNDCLOUD_PLAYLIST",
  "YOUTUBE_VIDEO",
  "SPOTIFY_EMBED",
  "SOCIAL_LINKS",
  "LINK_LIST",
  "GIG_LIST",
  "PAST_GIGS",
  "CONTENT_LIST",
  "DIVIDER",
  "SPACER",
  "CUSTOM_EMBED",
] as const;

export const zBlockOverrides: z.ZodType<BlockOverrides> = z.partialRecord(
  z.enum(BLOCK_TYPE_NAMES),
  zBlockOverride,
);

// ---------------------------------------------------------------------------
// Merging / parsing
// ---------------------------------------------------------------------------

/** Merge partial tokens on top of a base, preserving null handling. */
export function mergeTokens(
  base: ThemeTokens,
  patch: Partial<ThemeTokens> | null | undefined,
): ThemeTokens {
  if (!patch) return base;
  return { ...base, ...patch };
}

/** Parse an unknown value into `ThemeTokens`, filling any missing fields with defaults. */
export function parseTokens(raw: unknown, base: ThemeTokens = DEFAULT_THEME_TOKENS): ThemeTokens {
  if (!raw || typeof raw !== "object") return base;
  const patched = mergeTokens(base, raw as Partial<ThemeTokens>);
  const result = zThemeTokens.safeParse(patched);
  return result.success ? result.data : base;
}

/** Parse an unknown value into `BlockOverrides`. Invalid entries are dropped. */
export function parseBlockOverrides(raw: unknown): BlockOverrides {
  if (!raw || typeof raw !== "object") return {};
  const result = zBlockOverrides.safeParse(raw);
  return result.success ? result.data : {};
}

// ---------------------------------------------------------------------------
// CSS variable serialization
// ---------------------------------------------------------------------------

const FONT_STACKS: Record<FontStack, string> = {
  inherit: "inherit",
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  display: '"Bebas Neue", "Oswald", Impact, "Helvetica Neue", sans-serif',
  handwritten: '"Caveat", "Dancing Script", cursive',
};

const SHADOWS: Record<BlockShadow, string> = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,0.12)",
  md: "0 4px 10px rgba(0,0,0,0.18)",
  lg: "0 12px 30px rgba(0,0,0,0.28)",
};

const DENSITY_GAP: Record<Density, string> = {
  compact: "6px",
  comfortable: "12px",
  spacious: "20px",
};

function tokensToVarRecord(tokens: ThemeTokens): Record<string, string> {
  return {
    "--creator-page-bg": tokens.pageBg,
    "--creator-page-fg": tokens.pageFg,
    "--creator-page-bg-image": tokens.pageBgImageFileId
      ? `url("${buildMediaUrl(tokens.pageBgImageFileId)}")`
      : "none",
    "--creator-page-bg-overlay": tokens.pageBgOverlay ?? "transparent",

    "--creator-accent": tokens.accent,
    "--creator-accent-fg": tokens.accentFg,

    "--creator-heading-font": FONT_STACKS[tokens.headingFont],
    "--creator-body-font": FONT_STACKS[tokens.bodyFont],
    "--creator-heading-weight": String(tokens.headingWeight),
    "--creator-letter-spacing": `${tokens.letterSpacing}px`,

    "--creator-block-bg": tokens.blockBg,
    "--creator-block-fg": tokens.blockFg,
    "--creator-block-border": tokens.blockBorder,
    "--creator-block-border-width": `${tokens.blockBorderWidth}px`,
    "--creator-block-radius": `${tokens.blockRadius}px`,
    "--creator-block-shadow": SHADOWS[tokens.blockShadow],
    "--creator-block-padding-x": `${tokens.blockPaddingX}px`,
    "--creator-block-padding-y": `${tokens.blockPaddingY}px`,

    "--creator-link": tokens.linkColor,
    "--creator-link-hover": tokens.linkHoverColor,
    "--creator-button-style": tokens.buttonStyle,
    "--creator-button-radius": `${tokens.buttonRadius}px`,

    "--creator-density": tokens.density,
    "--creator-density-gap": DENSITY_GAP[tokens.density],
    "--creator-banner-overlay": tokens.bannerOverlay ?? "transparent",
  };
}

/**
 * Produce a `React.CSSProperties` object containing every `--creator-*`
 * variable for these tokens. When `blockType` is provided, the matching
 * entry in `overrides` (if any) is merged on top of `tokens` before
 * serialization — use this on the per-block wrapper.
 */
export function themeToCssVars(
  tokens: ThemeTokens,
  overrides?: BlockOverrides | null,
  blockType?: CreatorBlockTypeName,
): React.CSSProperties {
  let finalTokens = tokens;
  const extras: Record<string, string> = {};

  if (blockType && overrides) {
    const override = overrides[blockType];
    if (override) {
      finalTokens = mergeTokens(tokens, override);
      if (blockType === "HEADING" && "headingColor" in override && override.headingColor) {
        extras["--creator-heading-color"] = override.headingColor;
      }
      if (
        blockType === "SOCIAL_LINKS" &&
        "socialPillStyle" in override &&
        override.socialPillStyle
      ) {
        extras["--creator-social-pill-style"] = override.socialPillStyle;
      }
      if (
        blockType === "PAST_GIGS" &&
        "pastGigsCellRadius" in override &&
        typeof override.pastGigsCellRadius === "number"
      ) {
        extras["--creator-past-gigs-cell-radius"] = `${override.pastGigsCellRadius}px`;
      }
    }
  }

  return { ...tokensToVarRecord(finalTokens), ...extras } as React.CSSProperties;
}

/** Convenience: return a `ThemeTokens` ready for rendering, with the
 *  profile's `accentColor` override applied on top of the theme's accent. */
export function resolveProfileTokens(
  themeTokens: unknown,
  accentColorOverride: string | null | undefined,
): ThemeTokens {
  const base = parseTokens(themeTokens);
  if (accentColorOverride) {
    return { ...base, accent: accentColorOverride };
  }
  return base;
}
