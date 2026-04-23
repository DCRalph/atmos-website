"use client";

import { type ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";
import {
  DEFAULT_THEME_TOKENS,
  themeToCssVars,
  type BlockOverride,
  type BlockOverrides,
  type FontStack,
  type ThemeTokens,
} from "~/lib/creator-theme";
import { type CreatorBlockTypeName } from "~/components/creator/block-types";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import { ImageUploadField } from "~/components/creator/image-upload-field";
import { EditHotspot } from "./edit-hotspot";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ThemeCanvasProps = {
  tokens: ThemeTokens;
  blockOverrides: BlockOverrides;
  /**
   * When true, hover-revealed edit hotspots are rendered on each region.
   * When false, the canvas is purely a visual preview (no mutation hooks).
   */
  editable?: boolean;
  onPatchTokens?: (patch: Partial<ThemeTokens>) => void;
  onPatchOverride?: (
    type: CreatorBlockTypeName,
    patch: Partial<BlockOverride>,
  ) => void;
  onResetOverride?: (type: CreatorBlockTypeName) => void;
  /** Display-only identity so the canvas feels like a real profile. */
  name?: string;
  tagline?: string;
  handle?: string;
};

/**
 * Pixel-for-pixel facsimile of the public `/creator/[handle]` page
 * ([src/app/creator/[handle]/page.tsx]) rendered using the given theme
 * tokens and overrides. When `editable` is true, floating hotspots appear on
 * each region and let the user edit the underlying tokens.
 */
export function ThemeCanvas({
  tokens,
  blockOverrides,
  editable = false,
  onPatchTokens,
  onPatchOverride,
  onResetOverride,
  name = "Your creator name",
  tagline = "DJ · producer · maker",
  handle = "your-handle",
}: ThemeCanvasProps) {
  const pageStyle = themeToCssVars(tokens, blockOverrides);

  const patch = onPatchTokens ?? (() => undefined);
  const patchOverride = onPatchOverride ?? (() => undefined);
  const resetOverride = onResetOverride ?? (() => undefined);

  return (
    <div
      className="creator-page relative overflow-hidden rounded-xl border"
      style={{
        ...pageStyle,
        background:
          "var(--creator-page-bg-image), var(--creator-page-bg)",
        color: "var(--creator-page-fg)",
        fontFamily: "var(--creator-body-font)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Banner + header                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative">
        {/* Banner (no-banner-image fallback, matches the real page) */}
        <div
          className="group relative h-32 md:h-48 w-full overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accent}88)`,
          }}
        >
          {tokens.bannerOverlay && (
            <div
              className="absolute inset-0"
              style={{ background: tokens.bannerOverlay }}
            />
          )}
          {editable && (
            <EditHotspot label="Page background" position="top-right">
              <ColorField
                label="Page background"
                value={tokens.pageBg}
                onChange={(v) => patch({ pageBg: v })}
              />
              <ColorField
                label="Page text"
                value={tokens.pageFg}
                onChange={(v) => patch({ pageFg: v })}
              />
              <ImageUploadField
                label="Background image"
                value={tokens.pageBgImageFileId}
                onChange={(id) => patch({ pageBgImageFileId: id })}
                kind="theme_bg"
                aspect="wide"
              />
              <NullableColorField
                label="Page overlay"
                value={tokens.pageBgOverlay}
                onChange={(v) => patch({ pageBgOverlay: v })}
              />
              <NullableColorField
                label="Banner overlay"
                value={tokens.bannerOverlay}
                onChange={(v) => patch({ bannerOverlay: v })}
              />
            </EditHotspot>
          )}
        </div>

        {/* Header row (same offsets as the real page) */}
        <div className="mx-auto max-w-6xl px-4 -mt-16 md:-mt-20 relative z-10">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
            {/* Avatar */}
            <div className="group relative h-28 w-28 md:h-36 md:w-36">
              <div
                className="relative h-full w-full overflow-hidden rounded-full border-4"
                style={{
                  borderColor: "var(--creator-page-bg)",
                  background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accent}55)`,
                }}
              >
                <div
                  className="grid h-full w-full place-items-center text-3xl font-bold"
                  style={{ color: tokens.accentFg }}
                >
                  {(name || "?").slice(0, 1).toUpperCase()}
                </div>
              </div>
              {editable && (
                <EditHotspot label="Accent color" position="bottom-right">
                  <ColorField
                    label="Accent"
                    value={tokens.accent}
                    onChange={(v) => patch({ accent: v })}
                  />
                  <ColorField
                    label="Accent foreground"
                    value={tokens.accentFg}
                    onChange={(v) => patch({ accentFg: v })}
                  />
                </EditHotspot>
              )}
            </div>

            {/* Name + handle + tagline */}
            <div className="group relative flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-3xl md:text-4xl"
                  style={{
                    fontFamily: "var(--creator-heading-font)",
                    fontWeight: "var(--creator-heading-weight)",
                    letterSpacing: "var(--creator-letter-spacing)",
                  }}
                >
                  {name}
                </h1>
              </div>
              <p
                className="font-mono text-sm"
                style={{ color: "var(--creator-page-fg)", opacity: 0.6 }}
              >
                @{handle}
              </p>
              <p className="text-lg">{tagline}</p>
              {editable && (
                <EditHotspot label="Typography" position="top-right">
                  <FontField
                    label="Heading font"
                    value={tokens.headingFont}
                    onChange={(v) => patch({ headingFont: v })}
                  />
                  <FontField
                    label="Body font"
                    value={tokens.bodyFont}
                    onChange={(v) => patch({ bodyFont: v })}
                  />
                  <RangeField
                    label="Heading weight"
                    min={100}
                    max={900}
                    step={100}
                    value={tokens.headingWeight}
                    onChange={(v) => patch({ headingWeight: v })}
                  />
                  <RangeField
                    label="Letter spacing (px)"
                    min={-2}
                    max={8}
                    step={0.5}
                    value={tokens.letterSpacing}
                    onChange={(v) => patch({ letterSpacing: v })}
                  />
                </EditHotspot>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body: bio + block grid                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="prose prose-invert max-w-none">
          <p style={{ opacity: 0.9 }}>
            A short bio paragraph sits here. Lorem ipsum dolor sit amet,
            consectetur adipiscing elit — tell visitors who you are and what
            you do.
          </p>
        </div>

        <div className="group/grid relative">
          {editable && (
            <EditHotspot
              label="Layout"
              position="top-right"
              className="-top-3 -right-3"
            >
              <SelectField
                label="Density"
                value={tokens.density}
                onChange={(v) =>
                  patch({ density: v as ThemeTokens["density"] })
                }
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "comfortable", label: "Comfortable" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
            </EditHotspot>
          )}

          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gridAutoRows: "60px",
              gap: "var(--creator-density-gap)",
            }}
          >
            {/* HEADING */}
            <CanvasBlock
              type="HEADING"
              colStart={1}
              colSpan={12}
              rowSpan={1}
              tokens={tokens}
              blockOverrides={blockOverrides}
              editable={editable}
              onPatchTokens={patch}
              onPatchOverride={patchOverride}
              onResetOverride={resetOverride}
            >
              <h2
                className="text-3xl md:text-4xl font-bold"
                style={{
                  fontFamily: "var(--creator-heading-font)",
                  fontWeight: "var(--creator-heading-weight)",
                  letterSpacing: "var(--creator-letter-spacing)",
                  color: "var(--creator-heading-color, inherit)",
                }}
              >
                Sample heading
              </h2>
            </CanvasBlock>

            {/* RICH_TEXT */}
            <CanvasBlock
              type="RICH_TEXT"
              colStart={1}
              colSpan={8}
              rowSpan={3}
              tokens={tokens}
              blockOverrides={blockOverrides}
              editable={editable}
              onPatchTokens={patch}
              onPatchOverride={patchOverride}
              onResetOverride={resetOverride}
            >
              <div className="h-full overflow-auto">
                <p className="text-sm leading-relaxed">
                  Rich text block — use this for long-form writing, liner
                  notes, or anything else that needs prose. Lorem ipsum dolor
                  sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua.
                </p>
              </div>
            </CanvasBlock>

            {/* SOCIAL_LINKS */}
            <CanvasBlock
              type="SOCIAL_LINKS"
              colStart={9}
              colSpan={4}
              rowSpan={3}
              tokens={tokens}
              blockOverrides={blockOverrides}
              editable={editable}
              onPatchTokens={patch}
              onPatchOverride={patchOverride}
              onResetOverride={resetOverride}
            >
              <div className="flex h-full flex-wrap content-start gap-2">
                {(["Instagram", "SoundCloud", "YouTube", "TikTok"] as const).map(
                  (l) => {
                    const pill =
                      blockOverrides.SOCIAL_LINKS?.socialPillStyle ??
                      tokens.buttonStyle;
                    return (
                      <span
                        key={l}
                        className="inline-flex h-7 items-center px-3 text-xs font-semibold"
                        style={{
                          background:
                            pill === "solid" ? tokens.accent : "transparent",
                          color:
                            pill === "solid"
                              ? tokens.accentFg
                              : "var(--creator-link, inherit)",
                          border:
                            pill === "outline"
                              ? `1px solid var(--creator-link, currentColor)`
                              : "none",
                          borderRadius: "var(--creator-button-radius, 999px)",
                        }}
                      >
                        {l}
                      </span>
                    );
                  },
                )}
              </div>
            </CanvasBlock>

            {/* IMAGE */}
            <CanvasBlock
              type="IMAGE"
              colStart={1}
              colSpan={6}
              rowSpan={4}
              tokens={tokens}
              blockOverrides={blockOverrides}
              editable={editable}
              onPatchTokens={patch}
              onPatchOverride={patchOverride}
              onResetOverride={resetOverride}
            >
              <div
                className="grid h-full w-full place-items-center overflow-hidden rounded-md text-xs"
                style={{
                  background: `linear-gradient(135deg, ${tokens.accent}33, ${tokens.accent}11)`,
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" /> Image
                </span>
              </div>
            </CanvasBlock>

            {/* LINK_LIST */}
            <CanvasBlock
              type="LINK_LIST"
              colStart={7}
              colSpan={6}
              rowSpan={4}
              tokens={tokens}
              blockOverrides={blockOverrides}
              editable={editable}
              onPatchTokens={patch}
              onPatchOverride={patchOverride}
              onResetOverride={resetOverride}
              extraHotspot={
                editable ? (
                  <EditHotspot
                    label="Links & buttons"
                    position="top-left"
                    align="start"
                  >
                    <ColorField
                      label="Link color"
                      value={tokens.linkColor}
                      onChange={(v) => patch({ linkColor: v })}
                    />
                    <ColorField
                      label="Link hover"
                      value={tokens.linkHoverColor}
                      onChange={(v) => patch({ linkHoverColor: v })}
                    />
                    <SelectField
                      label="Button style"
                      value={tokens.buttonStyle}
                      onChange={(v) =>
                        patch({
                          buttonStyle: v as ThemeTokens["buttonStyle"],
                        })
                      }
                      options={[
                        { value: "solid", label: "Solid" },
                        { value: "outline", label: "Outline" },
                        { value: "ghost", label: "Ghost" },
                      ]}
                    />
                    <RangeField
                      label="Button radius (px)"
                      min={0}
                      max={48}
                      step={1}
                      value={tokens.buttonRadius}
                      onChange={(v) => patch({ buttonRadius: v })}
                    />
                  </EditHotspot>
                ) : null
              }
            >
              <div className="flex h-full flex-col gap-2 overflow-auto">
                {["Latest mix", "Merch", "Bookings"].map((label) => (
                  <div
                    key={label}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{
                      background:
                        tokens.buttonStyle === "solid"
                          ? tokens.accent
                          : "var(--creator-block-bg)",
                      color:
                        tokens.buttonStyle === "solid"
                          ? tokens.accentFg
                          : "var(--creator-link, inherit)",
                      borderColor:
                        tokens.buttonStyle === "outline"
                          ? "var(--creator-link, currentColor)"
                          : "var(--creator-block-border, transparent)",
                      borderRadius: "var(--creator-button-radius)",
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </CanvasBlock>

            {/* PAST_GIGS */}
            <CanvasBlock
              type="PAST_GIGS"
              colStart={1}
              colSpan={12}
              rowSpan={4}
              tokens={tokens}
              blockOverrides={blockOverrides}
              editable={editable}
              onPatchTokens={patch}
              onPatchOverride={patchOverride}
              onResetOverride={resetOverride}
            >
              <div className="flex h-full flex-col gap-3">
                <h3
                  className="text-xl md:text-2xl font-semibold"
                  style={{
                    fontFamily: "var(--creator-heading-font)",
                    fontWeight: "var(--creator-heading-weight)",
                    letterSpacing: "var(--creator-letter-spacing)",
                  }}
                >
                  Past gigs
                </h3>
                <div className="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square"
                      style={{
                        background: `linear-gradient(135deg, ${tokens.accent}44, ${tokens.accent}11)`,
                        borderRadius: `${
                          blockOverrides.PAST_GIGS?.pastGigsCellRadius ??
                          Math.max(4, Math.floor(tokens.blockRadius * 0.5))
                        }px`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </CanvasBlock>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-block wrapper + hotspot
// ---------------------------------------------------------------------------

function CanvasBlock({
  type,
  colStart,
  colSpan,
  rowSpan,
  tokens,
  blockOverrides,
  editable,
  onPatchTokens,
  onPatchOverride,
  onResetOverride,
  extraHotspot,
  children,
}: {
  type: CreatorBlockTypeName;
  colStart: number;
  colSpan: number;
  rowSpan: number;
  tokens: ThemeTokens;
  blockOverrides: BlockOverrides;
  editable: boolean;
  onPatchTokens: (patch: Partial<ThemeTokens>) => void;
  onPatchOverride: (
    type: CreatorBlockTypeName,
    patch: Partial<BlockOverride>,
  ) => void;
  onResetOverride: (type: CreatorBlockTypeName) => void;
  extraHotspot?: ReactNode;
  children: ReactNode;
}) {
  const current: BlockOverride = blockOverrides[type] ?? {};
  const hasOverrides = Object.keys(current).length > 0;

  return (
    <div
      className="creator-block group relative overflow-hidden"
      style={{
        ...themeToCssVars(tokens, blockOverrides, type),
        gridColumn: `${colStart} / span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
      }}
    >
      {children}
      {extraHotspot}
      {editable && (
        <EditHotspot label={`Edit ${humanize(type)}`} position="top-right">
          <Tabs defaultValue="style">
            <TabsList className="w-full">
              <TabsTrigger value="style" className="flex-1">
                Block style
              </TabsTrigger>
              <TabsTrigger value="override" className="flex-1">
                Override {humanize(type)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="style" className="space-y-3 pt-3">
              <ColorField
                label="Block background"
                value={tokens.blockBg}
                onChange={(v) => onPatchTokens({ blockBg: v })}
              />
              <ColorField
                label="Block text"
                value={tokens.blockFg}
                onChange={(v) => onPatchTokens({ blockFg: v })}
              />
              <ColorField
                label="Block border"
                value={tokens.blockBorder}
                onChange={(v) => onPatchTokens({ blockBorder: v })}
              />
              <RangeField
                label="Border width (px)"
                min={0}
                max={8}
                step={1}
                value={tokens.blockBorderWidth}
                onChange={(v) => onPatchTokens({ blockBorderWidth: v })}
              />
              <RangeField
                label="Corner radius (px)"
                min={0}
                max={48}
                step={1}
                value={tokens.blockRadius}
                onChange={(v) => onPatchTokens({ blockRadius: v })}
              />
              <SelectField
                label="Shadow"
                value={tokens.blockShadow}
                onChange={(v) =>
                  onPatchTokens({
                    blockShadow: v as ThemeTokens["blockShadow"],
                  })
                }
                options={[
                  { value: "none", label: "None" },
                  { value: "sm", label: "Small" },
                  { value: "md", label: "Medium" },
                  { value: "lg", label: "Large" },
                ]}
              />
              <RangeField
                label="Padding X (px)"
                min={0}
                max={48}
                step={1}
                value={tokens.blockPaddingX}
                onChange={(v) => onPatchTokens({ blockPaddingX: v })}
              />
              <RangeField
                label="Padding Y (px)"
                min={0}
                max={48}
                step={1}
                value={tokens.blockPaddingY}
                onChange={(v) => onPatchTokens({ blockPaddingY: v })}
              />
              <p className="text-muted-foreground text-[11px]">
                These control every block on the page.
              </p>
            </TabsContent>

            <TabsContent value="override" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-[11px]">
                  Only applied to {humanize(type).toLowerCase()} blocks.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResetOverride(type)}
                  disabled={!hasOverrides}
                >
                  Reset
                </Button>
              </div>

              <OverrideColor
                label="Accent"
                base={tokens.accent}
                value={current.accent}
                onChange={(v) => onPatchOverride(type, { accent: v })}
              />
              <OverrideColor
                label="Block bg"
                base={tokens.blockBg}
                value={current.blockBg}
                onChange={(v) => onPatchOverride(type, { blockBg: v })}
              />
              <OverrideColor
                label="Block text"
                base={tokens.blockFg}
                value={current.blockFg}
                onChange={(v) => onPatchOverride(type, { blockFg: v })}
              />
              <OverrideColor
                label="Block border"
                base={tokens.blockBorder}
                value={current.blockBorder}
                onChange={(v) => onPatchOverride(type, { blockBorder: v })}
              />

              {type === "HEADING" && (
                <OverrideColor
                  label="Heading color"
                  base={tokens.pageFg}
                  value={current.headingColor}
                  onChange={(v) =>
                    onPatchOverride(type, { headingColor: v })
                  }
                />
              )}
              {type === "SOCIAL_LINKS" && (
                <div className="space-y-1">
                  <Label>Social pill style</Label>
                  <Select
                    value={current.socialPillStyle ?? "inherit"}
                    onValueChange={(v) =>
                      onPatchOverride(type, {
                        socialPillStyle:
                          v === "inherit"
                            ? undefined
                            : (v as "solid" | "outline" | "ghost"),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Inherit</SelectItem>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="outline">Outline</SelectItem>
                      <SelectItem value="ghost">Ghost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === "PAST_GIGS" && (
                <RangeField
                  label="Gig cell radius (px)"
                  min={0}
                  max={48}
                  step={1}
                  value={
                    current.pastGigsCellRadius ??
                    Math.max(0, Math.floor(tokens.blockRadius * 0.5))
                  }
                  onChange={(v) =>
                    onPatchOverride(type, { pastGigsCellRadius: v })
                  }
                />
              )}
            </TabsContent>
          </Tabs>
        </EditHotspot>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backwards compatibility: a read-only <ThemePreview />
// ---------------------------------------------------------------------------

export function ThemePreview({
  tokens = DEFAULT_THEME_TOKENS,
  blockOverrides = {},
  name,
  tagline,
}: {
  tokens?: ThemeTokens;
  blockOverrides?: BlockOverrides;
  name?: string;
  tagline?: string;
}) {
  return (
    <ThemeCanvas
      tokens={tokens}
      blockOverrides={blockOverrides}
      editable={false}
      name={name}
      tagline={tagline}
    />
  );
}

// ---------------------------------------------------------------------------
// Field helpers (local copies — self-contained canvas module)
// ---------------------------------------------------------------------------

function humanize(type: CreatorBlockTypeName): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function toHexish(v: string): string {
  if (v.startsWith("#")) return v.slice(0, 7);
  return "#000000";
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={toHexish(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function NullableColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const enabled = value !== null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => onChange(v ? "rgba(0,0,0,0.3)" : null)}
        />
      </div>
      {enabled && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={toHexish(value ?? "#000000")}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 rounded border"
          />
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </div>
      )}
    </div>
  );
}

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-muted-foreground font-mono text-xs">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const FONT_OPTIONS: { value: FontStack; label: string }[] = [
  { value: "sans", label: "Sans-serif" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
  { value: "display", label: "Display" },
  { value: "handwritten", label: "Handwritten" },
  { value: "inherit", label: "Inherit" },
];

function FontField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FontStack;
  onChange: (v: FontStack) => void;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(v) => onChange(v as FontStack)}
      options={FONT_OPTIONS}
    />
  );
}

function OverrideColor({
  label,
  base,
  value,
  onChange,
}: {
  label: string;
  base: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}) {
  const enabled = typeof value === "string";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => onChange(v ? base : undefined)}
        />
      </div>
      {enabled && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={toHexish(value ?? base)}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 rounded border"
          />
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </div>
      )}
    </div>
  );
}
