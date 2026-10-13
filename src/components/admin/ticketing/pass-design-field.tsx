"use client";

import { Fragment, useState } from "react";
import { ImageIcon, Plus, X } from "lucide-react";

import {
  PASS_BAND_STYLES,
  PASS_GUIDE_LINKS,
  PASS_LAYOUTS,
  PASS_LAYOUT_INFO,
  PASS_STRIP_STYLE_LABELS,
  isHexColour,
  stripSvg,
  stripTitleBox,
  type PassLayout,
  type StripBadge,
} from "~/lib/ticketing/pass-theme";
import {
  DEFAULT_NEAR_VENUE_M,
  DEFAULT_STRIP_DIM,
  MAX_STRIP_DIM,
  guideLinksOf,
  mergePassDesigns,
  resolvePassDesign,
  type PassBackRow,
  type PassDesign,
  type PassDesignKey,
  type ResolvedPassDesign,
} from "~/lib/ticketing/pass-design";
import { buildMediaUrl } from "~/lib/media-url";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ImageUploadField } from "~/components/uploads/image-upload-field";

/**
 * One layer of a wallet pass's look, with a preview.
 *
 * Used for an event, for a level at an event, and for an access level. Every
 * field is optional: unset ones show what they inherit and from where, and
 * anything set on this layer can be cleared to inherit again.
 *
 * Four tabs, because the pass has four sides to it: how it looks, where its
 * links go, what is on the back, and what it does on the phone. The preview
 * follows the tab, so the links tab shows the guide they become and the back
 * tab shows the back. The band is drawn by the very same `stripSvg` the pass
 * renderer rasterises, so what is on screen here is what Apple Wallet gets.
 */

/** A layer under the one being edited, highest priority first. */
export type InheritedLayer = {
  /** How a field inherited from it is labelled — "from AAA level". */
  source: string;
  design: PassDesign;
};

type ColourKey = Extract<
  PassDesignKey,
  "accentHex" | "backgroundHex" | "foregroundHex" | "labelHex" | "chinHex"
>;

/** The chin is poster-only, so it is added beside these rather than listed. */
const SWATCHES: { key: Exclude<ColourKey, "chinHex">; label: string }[] = [
  { key: "accentHex", label: "Accent" },
  { key: "backgroundHex", label: "Background" },
  { key: "foregroundHex", label: "Text" },
  { key: "labelHex", label: "Labels" },
];

/** The tabs, and which fields each owns, so a tab can show that it sets something. */
const TABS = [
  {
    id: "look",
    label: "Look",
    keys: [
      "layout",
      "stripStyle",
      "stripImageId",
      "stripDim",
      "posterImageId",
      "logoImageId",
      "logoText",
      "accentHex",
      "backgroundHex",
      "foregroundHex",
      "labelHex",
      "chinHex",
      "headerShade",
      "autoColours",
      "showTitle",
      "showChip",
    ],
  },
  {
    id: "links",
    label: "Links",
    keys: [
      ...PASS_GUIDE_LINKS.map((link) => link.key),
      "venuePhone",
      "venueEmail",
      "venueWebsite",
      "transfer",
      "allowSharing",
    ],
  },
  { id: "back", label: "Back", keys: ["backRows"] },
  {
    id: "phone",
    label: "Phone",
    keys: ["venueLat", "venueLng", "nearVenueM", "notifyChanges"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  keys: readonly PassDesignKey[];
}[];

type TabId = (typeof TABS)[number]["id"];

const isUrl = (value: string) => {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function PassDesignField({
  value,
  onChange,
  inherits,
  fallbackSource = "Atmos default",
  eventName,
  venueAddress = null,
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
  /** The event's address, which becomes the directions link. */
  venueAddress?: string | null;
  /** The level chip as the pass would draw it, worked out by the caller. */
  chip: StripBadge | null;
  /** How far the accent floods the band, from the level's rank. */
  intensity?: number;
  /** Levels get a chip switch; the event's own layer has no chip to switch. */
  showChipControl?: boolean;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("look");
  const layers = [value, ...inherits.map((layer) => layer.design)];
  const merged = mergePassDesigns(layers);
  const design = resolvePassDesign(layers);
  // What was asked for, which the preview's layout picker highlights even
  // while the poster it needs is still to be uploaded.
  const wantedLayout: PassLayout = merged.layout ?? "BAND";
  const needsPoster = PASS_LAYOUT_INFO[wantedLayout].needsPoster;
  const poster = wantedLayout === "POSTER";
  const banded = wantedLayout !== "BLUR";

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

  const below = mergePassDesigns(inherits.map((layer) => layer.design));
  const setsSomething = (keys: readonly PassDesignKey[]) =>
    keys.some((key) => value[key] !== undefined);

  const text = (
    key: Extract<
      PassDesignKey,
      | "logoText"
      | "venuePhone"
      | "venueEmail"
      | "venueWebsite"
      | (typeof PASS_GUIDE_LINKS)[number]["key"]
    >,
    props: Omit<
      Parameters<typeof TextSetting>[0],
      "id" | "own" | "inherited" | "source" | "disabled" | "onChange"
    >,
  ) => (
    <TextSetting
      id={`pass-${key}`}
      own={value[key]}
      inherited={below[key] ?? ""}
      source={sourceOf(key)}
      disabled={disabled}
      onChange={(next) => (next === undefined ? clear(key) : set(key, next))}
      {...props}
    />
  );

  // The preview follows the tab: links are shown as the guide they become,
  // and the back tab shows the back.
  const side = tab === "links" ? "guide" : tab === "back" ? "back" : "front";

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <Tabs value={tab} onValueChange={(next) => setTab(next as TabId)}>
          <TabsList>
            {TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
                {setsSomething(item.keys) && <SetDot />}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "look" && (
          <>
            <div className="space-y-2">
              <FieldLabel
                label="Layout"
                source={sourceOf("layout")}
                onClear={() => clear("layout")}
              />
              <div className="grid grid-cols-3 gap-2">
                {PASS_LAYOUTS.map((layout) => {
                  const active = wantedLayout === layout;
                  return (
                    <button
                      key={layout}
                      type="button"
                      disabled={disabled}
                      onClick={() => set("layout", layout)}
                      aria-pressed={active}
                      className={`rounded-none border-2 p-2 text-left transition-colors ${
                        active
                          ? "border-white bg-white/10"
                          : "border-white/15 hover:border-white/40"
                      }`}
                    >
                      <LayoutSwatch
                        layout={layout}
                        design={design}
                        posterId={merged.posterImageId ?? null}
                        intensity={intensity}
                      />
                      <span className="mt-1.5 block text-xs font-semibold">
                        {PASS_LAYOUT_INFO[layout].label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-white/40">
                {needsPoster && !merged.posterImageId
                  ? "Upload a poster below. Until then the pass is built as the band."
                  : PASS_LAYOUT_INFO[wantedLayout].description}
              </p>
            </div>

            {needsPoster && (
              <ImageSetting
                label="Poster"
                source={sourceOf("posterImageId")}
                onClear={() => clear("posterImageId")}
                own={value.posterImageId ?? null}
                inherited={below.posterImageId ?? null}
                onChange={(id) =>
                  id ? set("posterImageId", id) : clear("posterImageId")
                }
                disabled={disabled}
                aspect="portrait"
                helperText="Portrait. Cropped to fill 358 × 448 points, so 1074 × 1344 or larger."
              />
            )}

            {banded && (
              <div className="space-y-2">
                <FieldLabel
                  label={poster ? "Band, for phones before iOS 18" : "Band"}
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
            )}

            {banded && merged.stripStyle === "PHOTO" && (
              <div className="space-y-4">
                <ImageSetting
                  label="Band photo"
                  source={sourceOf("stripImageId")}
                  onClear={() => clear("stripImageId")}
                  own={value.stripImageId ?? null}
                  inherited={below.stripImageId ?? null}
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
              {poster && (
                <ColourSetting
                  id="pass-chinHex"
                  label="Chin"
                  own={value.chinHex}
                  inherited={design.chinHex ?? design.backgroundHex}
                  source={sourceOf("chinHex")}
                  disabled={disabled}
                  onChange={(hex) =>
                    hex ? set("chinHex", hex) : clear("chinHex")
                  }
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <ImageSetting
                label="Logo"
                source={sourceOf("logoImageId")}
                onClear={() => clear("logoImageId")}
                own={value.logoImageId ?? null}
                inherited={below.logoImageId ?? null}
                onChange={(id) =>
                  id ? set("logoImageId", id) : clear("logoImageId")
                }
                disabled={disabled}
                helperText="Replaces the Atmos wordmark. A transparent PNG works best."
              />
              {text("logoText", {
                label: "Logo text",
                placeholder: "PRESENTS",
                hint: "A word beside the logo. Keep it short.",
                maxLength: 24,
              })}
            </div>

            <div className="space-y-3">
              {banded && (
                <ToggleSetting
                  label="Event name on band"
                  hint="Turn off when the band photo already shows it. The name moves to the back of the pass."
                  checked={design.showTitle}
                  source={sourceOf("showTitle")}
                  disabled={disabled}
                  onChange={(on) => set("showTitle", on)}
                  onClear={() => clear("showTitle")}
                />
              )}
              {banded && showChipControl && (
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
              {poster && (
                <>
                  <ToggleSetting
                    label="Shade the top of the artwork"
                    hint="Keeps the logo readable on a bright poster."
                    checked={design.headerShade}
                    source={sourceOf("headerShade")}
                    disabled={disabled}
                    onChange={(on) => set("headerShade", on)}
                    onClear={() => clear("headerShade")}
                  />
                  <ToggleSetting
                    label="Let Wallet pick text colours from the artwork"
                    hint="Ignores the text and label colours above."
                    checked={design.autoColours}
                    source={sourceOf("autoColours")}
                    disabled={disabled}
                    onChange={(on) => set("autoColours", on)}
                    onClear={() => clear("autoColours")}
                  />
                </>
              )}
            </div>
          </>
        )}

        {tab === "links" && (
          <>
            <div className="space-y-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Event guide</p>
                <p className="text-xs text-white/40">
                  On the poster layout Wallet draws these as buttons on the
                  pass, once two are set. On the band and blur layouts they go
                  on the back.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel
                    label="Directions"
                    source={
                      venueAddress ? "from the address" : "needs an address"
                    }
                    onClear={() => undefined}
                  />
                  <p className="truncate rounded-md border border-dashed border-white/15 px-3 py-2 text-xs text-white/50">
                    {venueAddress ?? "Set the venue address on Details."}
                  </p>
                </div>
                {PASS_GUIDE_LINKS.map((link) => (
                  <Fragment key={link.key}>
                    {text(link.key, {
                      label: link.label,
                      placeholder: "https://",
                      validate: isUrl,
                      invalid: "Needs a full link, starting https://",
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Venue contact</p>
                <p className="text-xs text-white/40">
                  A Contact venue button on a poster pass; a row on the back of
                  the others.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {text("venuePhone", {
                  label: "Phone",
                  placeholder: "09 000 0000",
                  validate: (v) => v.length >= 3,
                  invalid: "Too short to be a phone number",
                })}
                {text("venueEmail", {
                  label: "Email",
                  placeholder: "hello@venue.co.nz",
                  validate: isEmail,
                  invalid: "Needs an email address",
                })}
                {text("venueWebsite", {
                  label: "Website",
                  placeholder: "https://",
                  validate: isUrl,
                  invalid: "Needs a full link, starting https://",
                })}
              </div>
            </div>

            <div className="space-y-3">
              <ToggleSetting
                label="Transfer from Wallet"
                hint="Adds Transfer to a poster pass's menu, opening the holder's ticket page."
                checked={design.transfer}
                source={sourceOf("transfer")}
                disabled={disabled}
                onChange={(on) => set("transfer", on)}
                onClear={() => clear("transfer")}
              />
              <ToggleSetting
                label="Allow sharing from Wallet"
                hint="Off removes Wallet's Share button. The first scan wins either way."
                checked={design.allowSharing}
                source={sourceOf("allowSharing")}
                disabled={disabled}
                onChange={(on) => set("allowSharing", on)}
                onClear={() => clear("allowSharing")}
              />
            </div>
          </>
        )}

        {tab === "back" && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Always there</p>
              <ul className="space-y-1 text-xs text-white/50">
                <li>The event name, when the front does not carry it.</li>
                <li>
                  Line-up and set times, from the linked gig&apos;s run sheet.
                </li>
                <li>The venue address, which opens Maps.</li>
                <li>
                  Guide links and venue contact, on the band and blur layouts.
                </li>
                <li>Ticket number, order and a link to manage the ticket.</li>
                <li>The R18 notice and the ticket terms.</li>
              </ul>
            </div>
            <BackRowsSetting
              own={value.backRows}
              inherited={below.backRows ?? []}
              source={sourceOf("backRows")}
              disabled={disabled}
              onChange={(rows) =>
                rows === undefined ? clear("backRows") : set("backRows", rows)
              }
            />
          </>
        )}

        {tab === "phone" && (
          <>
            <div className="space-y-3">
              <div className="space-y-0.5">
                <FieldLabel
                  label="Show on the lock screen near the venue"
                  source={sourceOf("venueLat")}
                  onClear={() => clear("venueLat", "venueLng", "nearVenueM")}
                />
                <p className="text-xs text-white/40">
                  Paste the venue&apos;s coordinates from Maps. Within this
                  distance the pass offers itself on the lock screen, not only
                  at doors.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberSetting
                  id="pass-venueLat"
                  label="Latitude"
                  own={value.venueLat}
                  inherited={below.venueLat}
                  placeholder="-36.8485"
                  min={-90}
                  max={90}
                  disabled={disabled}
                  onChange={(n) =>
                    n === undefined ? clear("venueLat") : set("venueLat", n)
                  }
                />
                <NumberSetting
                  id="pass-venueLng"
                  label="Longitude"
                  own={value.venueLng}
                  inherited={below.venueLng}
                  placeholder="174.7633"
                  min={-180}
                  max={180}
                  disabled={disabled}
                  onChange={(n) =>
                    n === undefined ? clear("venueLng") : set("venueLng", n)
                  }
                />
                <NumberSetting
                  id="pass-nearVenueM"
                  label="Within, metres"
                  own={value.nearVenueM}
                  inherited={below.nearVenueM ?? DEFAULT_NEAR_VENUE_M}
                  placeholder={String(DEFAULT_NEAR_VENUE_M)}
                  min={50}
                  max={5000}
                  step={50}
                  disabled={disabled}
                  onChange={(n) =>
                    n === undefined
                      ? clear("nearVenueM")
                      : set("nearVenueM", Math.round(n))
                  }
                />
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-sm font-medium">Live activity</p>
              <p className="text-xs text-white/40">
                A poster pass runs on the lock screen from doors until the
                event&apos;s end time, with nothing to set here. Give the event
                an end time on Details to turn it on.
              </p>
            </div>

            <ToggleSetting
              label="Tell holders when something changes"
              hint="A notification when doors, the date or the venue move. Off, the pass still updates, quietly."
              checked={design.notifyChanges}
              source={sourceOf("notifyChanges")}
              disabled={disabled}
              onChange={(on) => set("notifyChanges", on)}
              onClear={() => clear("notifyChanges")}
            />
          </>
        )}
      </div>

      <PassPreview
        design={design}
        eventName={eventName}
        venueAddress={venueAddress}
        chip={chip}
        intensity={intensity}
        side={side}
      />
    </div>
  );
}

/** Marks a tab that sets something of its own. */
function SetDot() {
  return (
    <span
      className="size-1.5 rounded-full bg-current"
      aria-label="Customised"
      role="img"
    />
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
 * A text input that only commits values that pass its check, and an empty
 * one means "inherit". Same shape as the colour input, for links, an email
 * and the logo text.
 */
function TextSetting({
  id,
  label,
  own,
  inherited,
  source,
  placeholder,
  hint,
  invalid = "Not valid",
  maxLength,
  validate,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  own: string | undefined;
  inherited: string;
  source: string | null;
  placeholder?: string;
  hint?: string;
  /** Shown under the box while the text fails `validate`. */
  invalid?: string;
  maxLength?: number;
  validate?: (value: string) => boolean;
  disabled?: boolean;
  onChange: (value: string | undefined) => void;
}) {
  const [text, setText] = useState(own ?? "");
  const [committed, setCommitted] = useState(own);
  if (own !== committed) {
    setCommitted(own);
    setText(own ?? "");
  }

  const valid = text === "" || !validate || validate(text);
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
      <Input
        id={id}
        value={text}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const trimmed = next.trim();
          if (trimmed === "") commit(undefined);
          else if (!validate || validate(trimmed)) commit(trimmed);
        }}
        placeholder={inherited || placeholder}
        spellCheck={false}
        className={`${valid ? "" : "border-red-500"} ${own === undefined ? "border-dashed" : ""}`}
      />
      {!valid ? (
        <p className="text-xs text-red-400">{invalid}</p>
      ) : hint ? (
        <p className="text-xs text-white/40">{hint}</p>
      ) : null}
    </div>
  );
}

/** A number that only commits inside its range; empty means "inherit". */
function NumberSetting({
  id,
  label,
  own,
  inherited,
  placeholder,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  own: number | undefined;
  inherited: number | undefined;
  placeholder?: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(own === undefined ? "" : String(own));
  const [committed, setCommitted] = useState(own);
  if (own !== committed) {
    setCommitted(own);
    setText(own === undefined ? "" : String(own));
  }

  const parsed = text.trim() === "" ? undefined : Number(text);
  const valid =
    parsed === undefined ||
    (Number.isFinite(parsed) && parsed >= min && parsed <= max);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step ?? "any"}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const value = next.trim() === "" ? undefined : Number(next);
          if (value === undefined) {
            setCommitted(undefined);
            onChange(undefined);
          } else if (Number.isFinite(value) && value >= min && value <= max) {
            setCommitted(value);
            onChange(value);
          }
        }}
        placeholder={inherited === undefined ? placeholder : String(inherited)}
        className={`font-mono ${valid ? "" : "border-red-500"} ${own === undefined ? "border-dashed" : ""}`}
      />
      {!valid && (
        <p className="text-xs text-red-400">
          Between {min} and {max}
        </p>
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
  aspect = "wide",
}: {
  label: string;
  source: string | null;
  onClear: () => void;
  own: string | null;
  inherited: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  helperText: string;
  aspect?: "wide" | "portrait";
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} source={source} onClear={onClear} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {!own && inherited ? (
          <div
            className={`relative shrink-0 overflow-hidden rounded-md border ${
              aspect === "portrait" ? "aspect-3/4 w-24" : "aspect-video w-32"
            }`}
          >
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
          aspect={aspect}
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

const MAX_BACK_ROWS = 12;

/**
 * The organiser's own rows on the back: a label and some text each, in order.
 *
 * Edited locally and committed without the blank ones, so a row that has just
 * been added does not put an empty label into the draft. Set here, the list
 * replaces whatever a lower layer has rather than adding to it, which is what
 * lets an AAA level say something different from general admission.
 */
function BackRowsSetting({
  own,
  inherited,
  source,
  disabled,
  onChange,
}: {
  own: PassBackRow[] | undefined;
  inherited: PassBackRow[];
  source: string | null;
  disabled?: boolean;
  onChange: (rows: PassBackRow[] | undefined) => void;
}) {
  const [rows, setRows] = useState<PassBackRow[]>(own ?? []);
  const [committed, setCommitted] = useState(own);
  if (own !== committed) {
    setCommitted(own);
    setRows(own ?? []);
  }

  const commit = (next: PassBackRow[]) => {
    setRows(next);
    const kept = next
      .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
      .filter((row) => row.label && row.value);
    setCommitted(kept);
    onChange(kept);
  };

  const shown = own === undefined ? inherited : rows;
  const editable = own !== undefined;

  return (
    <div className="space-y-2">
      <FieldLabel
        label="Your rows"
        source={source}
        onClear={() => {
          setRows([]);
          setCommitted(undefined);
          onChange(undefined);
        }}
      />
      {shown.length === 0 && (
        <p className="text-xs text-white/40">
          {editable
            ? "No rows. Add one for lockers, the afterparty, a dress code."
            : "None yet. Add one for lockers, the afterparty, a dress code."}
        </p>
      )}
      <div className="space-y-2">
        {shown.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-white/15 p-2 sm:grid-cols-[140px_1fr_auto]"
          >
            <Input
              aria-label="Row label"
              value={row.label}
              placeholder="Lockers"
              maxLength={40}
              disabled={!editable || disabled}
              onChange={(e) =>
                commit(
                  rows.map((item, i) =>
                    i === index ? { ...item, label: e.target.value } : item,
                  ),
                )
              }
            />
            <Textarea
              aria-label="Row text"
              value={row.value}
              placeholder="$5 at the door, cash or card."
              maxLength={600}
              rows={2}
              disabled={!editable || disabled}
              onChange={(e) =>
                commit(
                  rows.map((item, i) =>
                    i === index ? { ...item, value: e.target.value } : item,
                  ),
                )
              }
            />
            {editable && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => commit(rows.filter((_, i) => i !== index))}
                aria-label="Remove row"
                className="text-white/50 hover:text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
        ))}
      </div>
      {shown.length < MAX_BACK_ROWS && (
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            // The first add on an inheriting layer starts from what it
            // inherits, so adding a row is not also deleting the others.
            commit([...(editable ? rows : inherited), { label: "", value: "" }])
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-white/25 px-3 py-1.5 text-xs text-white hover:border-white/50"
        >
          <Plus className="size-3.5" aria-hidden />
          Add a row
        </button>
      )}
      <p className="text-xs text-white/40">
        Links, addresses and phone numbers in a row become tappable on their
        own.
      </p>
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

/** A thumbnail of each layout, in the design's own colours and poster. */
function LayoutSwatch({
  layout,
  design,
  posterId,
  intensity,
}: {
  layout: PassLayout;
  design: ResolvedPassDesign;
  posterId: string | null;
  intensity: number;
}) {
  const photo = posterId ? buildMediaUrl(posterId) : null;
  return (
    <span
      aria-hidden
      className="relative block h-12 w-full overflow-hidden rounded-sm"
      style={{ backgroundColor: design.backgroundHex }}
    >
      {layout === "BAND" && (
        <span
          className="absolute inset-x-0 top-2.5 h-4 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{
            __html: stripSvg(design, 240, 40, intensity),
          }}
        />
      )}
      {layout === "BLUR" && photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-xs"
        />
      )}
      {layout === "POSTER" && photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {layout !== "BAND" && !photo && (
        <ImageIcon className="absolute top-1/2 left-1/2 size-4 -translate-1/2 text-white/40" />
      )}
      <span className="absolute top-1.5 left-1.5 h-0.5 w-4 bg-white/80" />
      <span
        className={`absolute left-1.5 h-0.5 w-8 bg-white/60 ${layout === "BAND" ? "bottom-2" : "bottom-1.5"}`}
      />
    </span>
  );
}

const SAMPLE_FIELDS = [
  ["DATE", "Fri 14 Aug 2026"],
  ["VENUE", "Boat shed"],
] as const;

/**
 * The pass as Wallet lays it out, one side at a time: the front in whichever
 * layout is chosen, the back, or the event guide. A poster pass can also be
 * previewed as the band it becomes on a phone before iOS 18.
 */
function PassPreview({
  design,
  eventName,
  venueAddress,
  chip,
  intensity,
  side,
}: {
  design: ResolvedPassDesign;
  eventName: string;
  venueAddress: string | null;
  chip: StripBadge | null;
  intensity: number;
  side: "front" | "back" | "guide";
}) {
  const [legacy, setLegacy] = useState(false);
  const layout: PassLayout =
    legacy && design.layout === "POSTER" ? "BAND" : design.layout;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Preview</Label>
        {design.layout === "POSTER" && side === "front" && (
          <div className="flex rounded-md border border-white/15 p-0.5 text-[11px]">
            {[false, true].map((old) => (
              <button
                key={String(old)}
                type="button"
                onClick={() => setLegacy(old)}
                aria-pressed={legacy === old}
                className={`rounded px-2 py-0.5 ${legacy === old ? "bg-white/15 text-white" : "text-white/50"}`}
              >
                {old ? "iOS 17" : "iOS 18"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className="relative overflow-hidden rounded-xl border border-white/10"
        style={{ backgroundColor: design.backgroundHex }}
      >
        {side === "front" ? (
          <PassFront
            design={design}
            layout={layout}
            eventName={eventName}
            chip={chip}
            intensity={intensity}
          />
        ) : side === "back" ? (
          <PassBack
            design={design}
            eventName={eventName}
            venueAddress={venueAddress}
          />
        ) : (
          <PassGuide design={design} venueAddress={venueAddress} />
        )}
      </div>
      <p className="text-xs text-white/40">
        {side === "front"
          ? "The band is drawn by the same code that builds the real pass. Type scales with the holder's text size."
          : side === "back"
            ? "Line-up and set times come from the linked gig's run sheet."
            : "Wallet draws the guide itself, so the buttons may differ a little."}
      </p>
    </div>
  );
}

function PassLogo({ design }: { design: ResolvedPassDesign }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
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
      {design.logoText && (
        <span
          className="truncate text-[8px] font-bold tracking-widest"
          style={{ color: design.foregroundHex }}
        >
          {design.logoText}
        </span>
      )}
    </div>
  );
}

function PassFields({
  design,
  className = "",
}: {
  design: ResolvedPassDesign;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-2 px-3 py-3 ${className}`}>
      {SAMPLE_FIELDS.map(([label, val]) => (
        <div key={label}>
          <div
            className="text-[8px] tracking-widest"
            style={{ color: design.labelHex }}
          >
            {label}
          </div>
          <div className="text-[11px]" style={{ color: design.foregroundHex }}>
            {val}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The top of the pass, as Wallet lays it out: header, artwork, first fields. */
function PassFront({
  design,
  layout,
  eventName,
  chip,
  intensity,
}: {
  design: ResolvedPassDesign;
  layout: PassLayout;
  eventName: string;
  chip: StripBadge | null;
  intensity: number;
}) {
  const name = eventName || "Event name";
  const poster = design.posterImageId
    ? buildMediaUrl(design.posterImageId)
    : null;

  if (layout === "POSTER" && poster) {
    return (
      <>
        <div className="relative aspect-358/448 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {design.headerShade && (
            <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-black/60 to-transparent" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/85 via-black/50 to-transparent" />
          <div className="absolute inset-x-3 top-3">
            <PassLogo design={design} />
          </div>
          <div className="absolute inset-x-3 bottom-3">
            <div className="text-[8px] font-semibold tracking-widest text-white/75">
              {SAMPLE_FIELDS[0][1].toUpperCase()} · DOORS 10:00 PM
            </div>
            <div className="line-clamp-2 text-lg leading-tight font-extrabold text-white">
              {name}
            </div>
          </div>
        </div>
        <div
          style={{ backgroundColor: design.chinHex ?? design.backgroundHex }}
        >
          <PassFields design={design} />
        </div>
      </>
    );
  }

  if (layout === "BLUR" && poster) {
    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-md"
        />
        <div className="relative">
          <div className="flex items-end justify-between px-3 pt-3 pb-2">
            <PassLogo design={design} />
            <PassDoors design={design} />
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <div
                className="text-[8px] tracking-widest"
                style={{ color: design.labelHex }}
              >
                EVENT
              </div>
              <div
                className="line-clamp-2 text-base leading-tight font-bold"
                style={{ color: design.foregroundHex }}
              >
                {name}
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt=""
              className="size-14 shrink-0 rounded-md object-cover shadow-lg"
            />
          </div>
          <PassFields design={design} />
        </div>
      </div>
    );
  }

  const banded = design.stripStyle !== "NONE";
  // With a chip the name is set in the lane beside it, as the server does.
  const lane = stripTitleBox(750, 196, chip);

  return (
    <>
      <div className="flex items-end justify-between px-3 pt-3 pb-2">
        <PassLogo design={design} />
        <PassDoors design={design} />
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
              {name}
            </div>
          </div>
        )}
      </div>

      <PassFields design={design} />
    </>
  );
}

function PassDoors({ design }: { design: ResolvedPassDesign }) {
  return (
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
  );
}

/** The back, with sample values where the pass fills in the ticket's own. */
function PassBack({
  design,
  eventName,
  venueAddress,
}: {
  design: ResolvedPassDesign;
  eventName: string;
  venueAddress: string | null;
}) {
  const guide = guideLinksOf(design);
  const contact = [design.venuePhone, design.venueEmail, design.venueWebsite]
    .filter(Boolean)
    .join(" · ");
  const rows: {
    label: string;
    value: string;
    link?: boolean;
    muted?: boolean;
  }[] = [
    { label: "Event", value: eventName || "Event name" },
    { label: "Line-up", value: "From the gig's run sheet", muted: true },
    {
      label: "Address",
      value: venueAddress ?? "The venue address",
      link: true,
      muted: !venueAddress,
    },
    ...design.backRows.map((row) => ({ label: row.label, value: row.value })),
    ...(design.layout === "POSTER"
      ? []
      : guide.map((link) => ({
          label: link.label,
          value: link.url,
          link: true,
        }))),
    ...(design.layout !== "POSTER" && contact
      ? [{ label: "Venue", value: contact, link: true }]
      : []),
    { label: "Ticket number", value: "ATN-20471" },
    { label: "Order", value: "ATM-8812" },
    { label: "Manage", value: "Manage this ticket", link: true },
    {
      label: "Terms",
      value: "One entry per ticket. The first scan is the one that gets in.",
    },
  ];

  return (
    <div className="divide-y divide-white/10">
      <div className="flex items-center justify-between px-3 py-2 text-[9px] text-white/50">
        <span>
          Automatic Updates <b className="text-white">On</b>
        </span>
        {design.allowSharing ? <span>Share</span> : null}
      </div>
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="px-3 py-2">
          <div
            className="text-[8px] tracking-widest uppercase"
            style={{ color: design.labelHex }}
          >
            {row.label}
          </div>
          <div
            className={`text-[10px] leading-snug break-words ${row.link ? "underline underline-offset-2" : ""} ${row.muted ? "italic opacity-60" : ""}`}
            style={{ color: row.link ? "#9d84ff" : design.foregroundHex }}
          >
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The event guide Wallet draws on a poster pass from the links. */
function PassGuide({
  design,
  venueAddress,
}: {
  design: ResolvedPassDesign;
  venueAddress: string | null;
}) {
  const buttons = [
    ...(venueAddress ? ["Directions"] : []),
    ...guideLinksOf(design).map((link) => link.label),
    ...(design.venuePhone || design.venueEmail || design.venueWebsite
      ? ["Contact venue"]
      : []),
  ];

  return (
    <div className="space-y-3 px-3 py-3">
      <div
        className="text-[11px] font-bold"
        style={{ color: design.foregroundHex }}
      >
        Event Guide
      </div>
      {design.layout !== "POSTER" ? (
        <p className="text-[10px] text-white/50">
          Only a poster pass has a guide. On the{" "}
          {PASS_LAYOUT_INFO[design.layout].label.toLowerCase()} layout these
          links go on the back.
        </p>
      ) : buttons.length < 2 ? (
        <p className="text-[10px] text-white/50">
          Wallet shows the guide once two links are set.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {buttons.map((label) => (
          <span
            key={label}
            className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold"
            style={{ color: design.foregroundHex }}
          >
            {label}
          </span>
        ))}
        {design.transfer && design.layout === "POSTER" && (
          <span className="rounded-full border border-dashed border-white/20 px-2.5 py-1 text-[10px] text-white/50">
            Transfer, in the menu
          </span>
        )}
      </div>
    </div>
  );
}
