"use client";

import { useState } from "react";
import { ImageIcon, X } from "lucide-react";

import {
  PASS_BAND_STYLES,
  PASS_STRIP_STYLE_LABELS,
  isHexColour,
  stripSvg,
  stripTitleBox,
  type StripBadge,
} from "~/lib/ticketing/pass-theme";
import {
  DEFAULT_STRIP_DIM,
  MAX_STRIP_DIM,
  mergePassDesigns,
  resolvePassDesign,
  type PassDesign,
  type PassDesignKey,
  type ResolvedPassDesign,
} from "~/lib/ticketing/pass-design";
import { buildMediaUrl } from "~/lib/media-url";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { ImageUploadField } from "~/components/uploads/image-upload-field";

/**
 * One layer of a wallet pass's look, with a preview.
 *
 * Used for an event, for a level at an event, and for an access level. Every
 * field is optional: unset ones show what they inherit and from where, and
 * anything set on this layer can be cleared to inherit again. The preview draws
 * the band from the very same `stripSvg` the pass renderer rasterises, so what
 * is on screen here is what Apple Wallet gets.
 */

/** A layer under the one being edited, highest priority first. */
export type InheritedLayer = {
  /** How a field inherited from it is labelled — "from AAA level". */
  source: string;
  design: PassDesign;
};

type ColourKey = Extract<
  PassDesignKey,
  "accentHex" | "backgroundHex" | "foregroundHex" | "labelHex"
>;

const SWATCHES: { key: ColourKey; label: string }[] = [
  { key: "accentHex", label: "Accent" },
  { key: "backgroundHex", label: "Background" },
  { key: "foregroundHex", label: "Text" },
  { key: "labelHex", label: "Labels" },
];

export function PassDesignField({
  value,
  onChange,
  inherits,
  fallbackSource = "Atmos default",
  eventName,
  chip,
  intensity = 0,
  showChipControl = false,
  disabled,
}: {
  value: PassDesign;
  onChange: (next: PassDesign) => void;
  inherits: InheritedLayer[];
  /** What a field set on no layer is labelled. */
  fallbackSource?: string;
  eventName: string;
  /** The level chip as the pass would draw it, worked out by the caller. */
  chip: StripBadge | null;
  /** How far the accent floods the band, from the level's rank. */
  intensity?: number;
  /** Levels get a chip switch; the event's own layer has no chip to switch. */
  showChipControl?: boolean;
  disabled?: boolean;
}) {
  const layers = [value, ...inherits.map((layer) => layer.design)];
  const merged = mergePassDesigns(layers);
  const design = resolvePassDesign(layers);

  /** Null when the field is set on this layer. */
  const sourceOf = (key: PassDesignKey): string | null => {
    if (value[key] !== undefined) return null;
    return (
      inherits.find((layer) => layer.design[key] !== undefined)?.source ??
      fallbackSource
    );
  };

  const set = <K extends PassDesignKey>(key: K, next: PassDesign[K]) =>
    onChange({ ...value, [key]: next });
  const clear = (...keys: PassDesignKey[]) => {
    const next = { ...value };
    for (const key of keys) delete next[key];
    onChange(next);
  };

  const inheritedOf = (key: "stripImageId" | "logoImageId") =>
    mergePassDesigns(inherits.map((layer) => layer.design))[key] ?? null;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <div className="space-y-2">
          <FieldLabel
            label="Band"
            source={sourceOf("stripStyle")}
            onClear={() => clear("stripStyle")}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PASS_BAND_STYLES.map((style) => {
              const active = (merged.stripStyle ?? "HATCH") === style;
              return (
                <button
                  key={style}
                  type="button"
                  disabled={disabled}
                  onClick={() => set("stripStyle", style)}
                  aria-pressed={active}
                  className={`rounded-none border-2 p-2 text-left transition-colors ${
                    active
                      ? "border-white bg-white/10"
                      : "border-white/15 hover:border-white/40"
                  }`}
                >
                  {style === "PHOTO" ? (
                    <PhotoSwatch imageId={merged.stripImageId ?? null} />
                  ) : (
                    <span
                      aria-hidden
                      className="block h-8 w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                      dangerouslySetInnerHTML={{
                        __html: stripSvg(
                          { ...design, stripStyle: style },
                          240,
                          40,
                          intensity,
                        ),
                      }}
                    />
                  )}
                  <span className="mt-1.5 block text-xs font-semibold">
                    {PASS_STRIP_STYLE_LABELS[style].label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-white/40">
            {merged.stripStyle === "PHOTO" && !merged.stripImageId
              ? "Upload a photo below. Until then the pass uses the house band."
              : PASS_STRIP_STYLE_LABELS[merged.stripStyle ?? "HATCH"]
                  .description}
          </p>
        </div>

        {merged.stripStyle === "PHOTO" && (
          <div className="space-y-4">
            <ImageSetting
              label="Band photo"
              source={sourceOf("stripImageId")}
              onClear={() => clear("stripImageId")}
              own={value.stripImageId ?? null}
              inherited={inheritedOf("stripImageId")}
              onChange={(id) =>
                id ? set("stripImageId", id) : clear("stripImageId")
              }
              disabled={disabled}
              helperText="Cropped to fill the band. 1125 × 294 or larger."
            />
            <div className="space-y-2">
              <FieldLabel
                label="Darken"
                htmlFor="pass-strip-dim"
                source={sourceOf("stripDim")}
                onClear={() => clear("stripDim")}
              />
              <div className="flex items-center gap-3">
                <input
                  id="pass-strip-dim"
                  type="range"
                  min={0}
                  max={MAX_STRIP_DIM}
                  step={0.05}
                  value={design.stripDim}
                  disabled={disabled}
                  onChange={(e) => set("stripDim", Number(e.target.value))}
                  aria-valuetext={`${Math.round(design.stripDim * 100)}%`}
                  style={{
                    background: `linear-gradient(to right, #ffffff ${(design.stripDim / MAX_STRIP_DIM) * 100}%, rgb(255 255 255 / 0.18) ${(design.stripDim / MAX_STRIP_DIM) * 100}%)`,
                  }}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
                <span className="w-10 shrink-0 text-right font-mono text-xs text-white/60">
                  {Math.round(design.stripDim * 100)}%
                </span>
              </div>
              <p className="text-xs text-white/40">
                Shades the photo so the name and chip on it stay readable.
                Defaults to {Math.round(DEFAULT_STRIP_DIM * 100)}%.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {SWATCHES.map(({ key, label }) => (
            <ColourSetting
              key={key}
              id={`pass-${key}`}
              label={label}
              own={value[key]}
              inherited={design[key]}
              source={sourceOf(key)}
              disabled={disabled}
              onChange={(hex) => (hex ? set(key, hex) : clear(key))}
            />
          ))}
        </div>

        <ImageSetting
          label="Logo"
          source={sourceOf("logoImageId")}
          onClear={() => clear("logoImageId")}
          own={value.logoImageId ?? null}
          inherited={inheritedOf("logoImageId")}
          onChange={(id) =>
            id ? set("logoImageId", id) : clear("logoImageId")
          }
          disabled={disabled}
          helperText="Replaces the Atmos wordmark. A transparent PNG works best."
        />

        <div className="space-y-3">
          <ToggleSetting
            label="Event name on band"
            hint="Turn off when the band photo already shows it. The name moves to the back of the pass."
            checked={design.showTitle}
            source={sourceOf("showTitle")}
            disabled={disabled}
            onChange={(on) => set("showTitle", on)}
            onClear={() => clear("showTitle")}
          />
          {showChipControl && (
            <ToggleSetting
              label="Level chip"
              hint="On by default for levels above general admission with their own accent."
              checked={chip !== null}
              source={sourceOf("showChip")}
              disabled={disabled}
              onChange={(on) => set("showChip", on)}
              onClear={() => clear("showChip")}
            />
          )}
        </div>
      </div>

      <PassPreview
        design={design}
        eventName={eventName}
        chip={chip}
        intensity={intensity}
      />
    </div>
  );
}

/** A field's label, with where its value comes from on the right. */
function FieldLabel({
  label,
  htmlFor,
  source,
  onClear,
}: {
  label: string;
  htmlFor?: string;
  source: string | null;
  onClear: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {source === null ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label.toLowerCase()} and inherit it`}
          className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white"
        >
          Set here
          <X className="size-3" aria-hidden />
        </button>
      ) : (
        <span className="text-xs text-white/40">{source}</span>
      )}
    </div>
  );
}

/**
 * A hex input that only commits valid colours.
 *
 * Half-typed text stays local so the draft never holds a broken colour, and
 * an empty box means "inherit" rather than "black".
 */
function ColourSetting({
  id,
  label,
  own,
  inherited,
  source,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  own: string | undefined;
  inherited: string;
  source: string | null;
  disabled?: boolean;
  onChange: (hex: string | undefined) => void;
}) {
  const [text, setText] = useState(own ?? "");
  const [committed, setCommitted] = useState(own);
  // The layer changed under us (a picker, a clear, a reset): show it.
  if (own !== committed) {
    setCommitted(own);
    setText(own ?? "");
  }

  const valid = text === "" || isHexColour(text);
  const commit = (next: string | undefined) => {
    setCommitted(next);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      <FieldLabel
        label={label}
        htmlFor={id}
        source={source}
        onClear={() => {
          setText("");
          commit(undefined);
        }}
      />
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={isHexColour(own ?? "") ? own : inherited}
          disabled={disabled}
          onChange={(e) => {
            const hex = e.target.value.toUpperCase();
            setText(hex);
            commit(hex);
          }}
          className="h-10 w-10 shrink-0 cursor-pointer border-2 border-white/15 bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value.trim();
            setText(next);
            if (next === "") commit(undefined);
            else if (isHexColour(next)) commit(next);
          }}
          placeholder={inherited}
          spellCheck={false}
          // Dashed while inheriting, so a value set here reads differently
          // from one shown as a placeholder.
          className={`font-mono ${valid ? "" : "border-red-500"} ${own === undefined ? "border-dashed" : ""}`}
        />
      </div>
      {!valid && (
        <p className="text-xs text-red-400">Needs a hex colour like #470082</p>
      )}
    </div>
  );
}

/**
 * An upload that can inherit, shown the way the poster field shows a linked
 * gig's poster: the inherited image beside the uploader, labelled.
 */
function ImageSetting({
  label,
  source,
  onClear,
  own,
  inherited,
  onChange,
  disabled,
  helperText,
}: {
  label: string;
  source: string | null;
  onClear: () => void;
  own: string | null;
  inherited: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  helperText: string;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} source={source} onClear={onClear} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {!own && inherited ? (
          <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildMediaUrl(inherited)}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-center text-[10px] text-white">
              Inherited
            </span>
          </div>
        ) : null}
        <ImageUploadField
          preset="ticketPassImage"
          value={own}
          onChange={(id) => onChange(id)}
          aspect="wide"
          disabled={disabled}
          helperText={
            !own && inherited
              ? `Using the one ${source ?? "inherited"}. Upload to replace it here.`
              : helperText
          }
        />
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  hint,
  checked,
  source,
  disabled,
  onChange,
  onClear,
}: {
  label: string;
  hint: string;
  checked: boolean;
  source: string | null;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-white/40">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {source === null ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label.toLowerCase()} and inherit it`}
            className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white"
          >
            Set here
            <X className="size-3" aria-hidden />
          </button>
        ) : (
          <span className="text-xs text-white/40">{source}</span>
        )}
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
          aria-label={label}
        />
      </div>
    </div>
  );
}

function PhotoSwatch({ imageId }: { imageId: string | null }) {
  return imageId ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={buildMediaUrl(imageId)}
      alt=""
      className="block h-8 w-full object-cover"
    />
  ) : (
    <span className="grid h-8 w-full place-items-center bg-white/5 text-white/40">
      <ImageIcon className="size-4" aria-hidden />
    </span>
  );
}

/** The top of the pass, as Wallet lays it out: header, band, first fields. */
function PassPreview({
  design,
  eventName,
  chip,
  intensity,
}: {
  design: ResolvedPassDesign;
  eventName: string;
  chip: StripBadge | null;
  intensity: number;
}) {
  const banded = design.stripStyle !== "NONE";
  // With a chip the name is set in the lane beside it, as the server does.
  const lane = stripTitleBox(750, 196, chip);

  return (
    <div className="space-y-2">
      <Label>Preview</Label>
      <div
        className="overflow-hidden rounded-xl border border-white/10"
        style={{ backgroundColor: design.backgroundHex }}
      >
        <div className="flex items-end justify-between px-3 pt-3 pb-2">
          {design.logoImageId ? (
            // Matches the 120x40pt slot an uploaded logo gets on the pass.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={buildMediaUrl(design.logoImageId)}
              alt=""
              className="h-6 max-w-[45%] object-contain object-left"
            />
          ) : (
            // Half-width wordmark, matching the pass's 80x25pt logo slot.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo/atmos-white.png"
              alt=""
              className="h-3.5 w-auto opacity-90"
            />
          )}
          <div className="text-right leading-none">
            <div
              className="text-[8px] tracking-widest"
              style={{ color: design.labelHex }}
            >
              DOORS
            </div>
            <div
              className="text-[11px] font-semibold"
              style={{ color: design.foregroundHex }}
            >
              10:00 pm
            </div>
          </div>
        </div>

        <div className="relative">
          {banded && (
            <div className="relative aspect-375/98 w-full">
              {design.stripImageId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={buildMediaUrl(design.stripImageId)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <span
                aria-hidden
                className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{
                  __html: stripSvg(design, 750, 196, intensity, chip),
                }}
              />
            </div>
          )}
          {design.showTitle && (
            <div
              className={
                banded
                  ? "absolute inset-y-0 left-0 flex flex-col justify-center px-3"
                  : "px-3 py-4"
              }
              style={
                banded && chip
                  ? { width: `${((lane.x + lane.width) / 750) * 100}%` }
                  : banded
                    ? { right: 0 }
                    : undefined
              }
            >
              <div
                className="text-[8px] tracking-widest"
                style={{ color: design.labelHex }}
              >
                EVENT
              </div>
              {/* Beside a chip the server wraps the name rather than cut it. */}
              <div
                className={
                  banded && chip
                    ? "line-clamp-2 text-sm leading-tight font-bold"
                    : "truncate text-base font-bold"
                }
                style={{ color: design.foregroundHex }}
              >
                {eventName || "Event name"}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 py-3">
          {[
            ["DATE", "Fri 14 Aug 2026"],
            ["VENUE", "Boat shed"],
          ].map(([label, val]) => (
            <div key={label}>
              <div
                className="text-[8px] tracking-widest"
                style={{ color: design.labelHex }}
              >
                {label}
              </div>
              <div
                className="text-[11px]"
                style={{ color: design.foregroundHex }}
              >
                {val}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-white/40">
        The band is drawn by the same code that builds the real pass.
      </p>
    </div>
  );
}
