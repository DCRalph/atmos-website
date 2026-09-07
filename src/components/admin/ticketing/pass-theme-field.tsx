"use client";

import {
  DEFAULT_PASS_THEME,
  PASS_STRIP_STYLES,
  PASS_STRIP_STYLE_LABELS,
  isHexColour,
  stripSvg,
  type PassStripStyle,
  type PassTheme,
} from "~/lib/ticketing/pass-theme";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";

/**
 * Wallet pass styling, with a preview.
 *
 * The preview draws the band from the very same `stripSvg` the pass renderer
 * rasterises, so what is on screen here is what Apple Wallet gets — the only
 * differences are the system font and the QR.
 */

export type PassThemeDraft = {
  stripStyle: PassStripStyle;
  accentHex: string;
  backgroundHex: string;
  foregroundHex: string;
  labelHex: string;
};

const SWATCHES: {
  key: keyof Omit<PassThemeDraft, "stripStyle">;
  label: string;
  hint: string;
}[] = [
  { key: "accentHex", label: "Accent", hint: "What the band builds toward" },
  { key: "backgroundHex", label: "Background", hint: "The pass ground" },
  { key: "foregroundHex", label: "Text", hint: "Field values" },
  { key: "labelHex", label: "Labels", hint: "The small caps above each value" },
];

export function PassThemeField({
  value,
  onChange,
  eventName,
}: {
  value: PassThemeDraft;
  onChange: (next: PassThemeDraft) => void;
  eventName: string;
}) {
  const theme: PassTheme = {
    stripStyle: value.stripStyle,
    accentHex: isHexColour(value.accentHex)
      ? value.accentHex
      : DEFAULT_PASS_THEME.accentHex,
    backgroundHex: isHexColour(value.backgroundHex)
      ? value.backgroundHex
      : DEFAULT_PASS_THEME.backgroundHex,
    foregroundHex: isHexColour(value.foregroundHex)
      ? value.foregroundHex
      : DEFAULT_PASS_THEME.foregroundHex,
    labelHex: isHexColour(value.labelHex)
      ? value.labelHex
      : DEFAULT_PASS_THEME.labelHex,
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Band style</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PASS_STRIP_STYLES.map((style) => {
              const active = value.stripStyle === style;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChange({ ...value, stripStyle: style })}
                  aria-pressed={active}
                  className={`rounded-none border-2 p-2 text-left transition-colors ${
                    active
                      ? "border-white bg-white/10"
                      : "border-white/15 hover:border-white/40"
                  }`}
                >
                  <span
                    aria-hidden
                    className="block h-8 w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{
                      __html: stripSvg(
                        { ...theme, stripStyle: style },
                        240,
                        40,
                      ),
                    }}
                  />
                  <span className="mt-1.5 block text-xs font-semibold">
                    {PASS_STRIP_STYLE_LABELS[style].label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-white/40">
            {PASS_STRIP_STYLE_LABELS[value.stripStyle].description}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SWATCHES.map(({ key, label, hint }) => {
            const raw = value[key];
            const valid = isHexColour(raw);
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`pass-${key}`}>{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`${label} colour picker`}
                    value={valid ? raw : DEFAULT_PASS_THEME[key]}
                    onChange={(e) =>
                      onChange({ ...value, [key]: e.target.value })
                    }
                    className="h-10 w-10 shrink-0 cursor-pointer border-2 border-white/15 bg-transparent p-0.5"
                  />
                  <Input
                    id={`pass-${key}`}
                    value={raw}
                    onChange={(e) =>
                      onChange({ ...value, [key]: e.target.value })
                    }
                    placeholder={DEFAULT_PASS_THEME[key]}
                    spellCheck={false}
                    className={`font-mono ${valid ? "" : "border-red-500"}`}
                  />
                </div>
                <p className="text-xs text-white/40">
                  {valid ? hint : "Needs a hex colour like #470082"}
                </p>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_PASS_THEME })}
          className="inline-flex min-h-9 items-center self-start text-xs text-white/50 underline underline-offset-4 hover:text-white lg:min-h-0"
        >
          Reset to Atmos house style
        </button>
      </div>

      <PassPreview theme={theme} eventName={eventName} />
    </div>
  );
}

/** The top of the pass, as Wallet lays it out: header, band, first fields. */
function PassPreview({
  theme,
  eventName,
}: {
  theme: PassTheme;
  eventName: string;
}) {
  return (
    <div className="space-y-2">
      <Label>Preview</Label>
      <div
        className="overflow-hidden rounded-xl border border-white/10"
        style={{ backgroundColor: theme.backgroundHex }}
      >
        <div className="flex items-end justify-between px-3 pt-3 pb-2">
          {/* Half-width wordmark, matching the pass's 80x25pt logo slot. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/atmos-white.png"
            alt=""
            className="h-3.5 w-auto opacity-90"
          />
          <div className="text-right leading-none">
            <div
              className="text-[8px] tracking-widest"
              style={{ color: theme.labelHex }}
            >
              DOORS
            </div>
            <div
              className="text-[11px] font-semibold"
              style={{ color: theme.foregroundHex }}
            >
              10:00 pm
            </div>
          </div>
        </div>

        <div className="relative">
          {theme.stripStyle !== "NONE" && (
            <span
              aria-hidden
              className="block w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: stripSvg(theme, 750, 196) }}
            />
          )}
          <div
            className={
              theme.stripStyle === "NONE"
                ? "px-3 py-4"
                : "absolute inset-0 flex flex-col justify-center px-3"
            }
          >
            <div
              className="text-[8px] tracking-widest"
              style={{ color: theme.labelHex }}
            >
              EVENT
            </div>
            <div
              className="truncate text-base font-bold"
              style={{ color: theme.foregroundHex }}
            >
              {eventName || "Event name"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 py-3">
          {[
            ["DATE", "Fri 14 Aug 2026"],
            ["VENUE", "Boat shed"],
          ].map(([label, val]) => (
            <div key={label}>
              <div
                className="text-[8px] tracking-widest"
                style={{ color: theme.labelHex }}
              >
                {label}
              </div>
              <div
                className="text-[11px]"
                style={{ color: theme.foregroundHex }}
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
