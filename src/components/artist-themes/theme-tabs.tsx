"use client";

import "~/styles/site.css";
import "~/styles/artist-profile.css";

import {
  type ComponentProps,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Check, Shuffle, Undo2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { artistFontVariables } from "~/lib/artist-fonts";
import { SITE_ACCENT } from "~/lib/site-constants";
import {
  ACCENT_SWATCHES,
  BODIES,
  FACES,
  GROUND_SWATCHES,
  LAYOUTS,
  MIN_TEXT_CONTRAST,
  STYLES,
  contrast,
  resolveTheme,
  themeVars,
  type ArtistTheme,
  type BodyKey,
  type FaceKey,
  type LayoutKey,
  type StyleKey,
} from "~/lib/artist-theme";
import {
  Field,
  PanelButton,
  PanelSection,
  Segmented,
  TextInput,
} from "~/components/artist-profile/editor/fields";
import { ThemeSchematic } from "./theme-swatch";
import { usePhotoPalettes, type PhotoPalette } from "./use-photo-palettes";

const TABS = [
  { id: "layout", label: "Layout" },
  { id: "colour", label: "Colour" },
  { id: "type", label: "Type" },
  { id: "shape", label: "Shape" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/** Change a theme. `group`: see `recordThemeChange`. */
type Change = (patch: Partial<ArtistTheme>, group?: string) => void;

/**
 * Every choice in an artist theme, in four tabs (Layout, Colour, Type,
 * Shape), in the page editor's look. Used by the page editor's Theme panel
 * and the theme editor pages, so a theme is edited the same way everywhere.
 * Ends with Undo (when `undo` is given; the caller keeps the history, see
 * `recordThemeChange`) and a Shuffle that tries a random face and palette.
 *
 * `starters` goes first on the Layout tab (the page editor's theme list),
 * `photos` are the artist's own images to pick palettes from, `sample` is the
 * text the faces are shown in (their name), and `note` closes every tab.
 * `sticky` keeps the tabs and buttons in view inside a scrolling panel.
 */
export function ThemeTabs({
  value,
  onChange: change,
  undo,
  starters,
  photos = [],
  sample,
  note,
  sticky,
}: {
  value: ArtistTheme;
  onChange: Change;
  undo?: { run: () => void; can: boolean };
  starters?: ReactNode;
  photos?: readonly { src: string; label: string }[];
  sample?: string;
  note?: ReactNode;
  sticky?: boolean;
}) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("layout");
  const palettes = usePhotoPalettes(photos);

  return (
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label="Theme"
        className={cn(
          "grid grid-cols-4 gap-1 pb-4",
          sticky &&
            "sticky -top-5 z-10 -mx-5 -mt-5 border-b border-white/10 bg-[rgb(8_8_8)] px-5 pt-5",
        )}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${id}-${t.id}-tab`}
            aria-selected={tab === t.id}
            aria-controls={`${id}-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "t-label h-9 rounded-full text-[10px] transition-colors",
              tab === t.id
                ? "bg-white text-black"
                : "text-white/65 hover:bg-white/10 hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${id}-${tab}`}
        aria-labelledby={`${id}-${tab}-tab`}
        className="space-y-6 pt-5"
      >
        {tab === "layout" ? (
          <LayoutTab value={value} change={change} starters={starters} />
        ) : tab === "colour" ? (
          <ColourTab value={value} change={change} palettes={palettes} />
        ) : tab === "type" ? (
          <TypeTab value={value} change={change} sample={sample} />
        ) : (
          <ShapeTab value={value} change={change} />
        )}
      </div>

      {note ? (
        <p className="mt-6 border-t border-white/10 pt-5 text-[13px] leading-snug text-white/50">
          {note}
        </p>
      ) : null}

      <div
        className={cn(
          "mt-6 flex gap-2 border-t border-white/10 pt-4",
          // Pinned in the floating panel; on a phone's short sheet they close
          // the tab instead, leaving room for the options.
          sticky &&
            "md:sticky md:-bottom-5 md:-mx-5 md:-mb-5 md:bg-[rgb(8_8_8)] md:px-5 md:pb-4",
        )}
      >
        {undo ? (
          <PanelButton disabled={!undo.can} onClick={undo.run}>
            <Undo2 className="size-3.5" /> Undo
          </PanelButton>
        ) : null}
        <PanelButton
          onClick={() => change(shuffle(value, palettes ?? []))}
          title="A random face and palette"
        >
          <Shuffle className="size-3.5" /> Shuffle
        </PanelButton>
      </div>
    </div>
  );
}

/**
 * `ThemeTabs` away from an artist page (the theme editor pages): on the page
 * editor's black panel, in the site's type, with the theme's colours set so
 * the Style swatches draw in them.
 */
export function ThemeTabsPanel(props: ComponentProps<typeof ThemeTabs>) {
  return (
    <div
      className={cn(
        "site cp rounded-[16px] border border-white/10 bg-[rgb(8_8_8)] p-5 text-white",
        artistFontVariables,
      )}
      style={
        {
          ...themeVars(resolveTheme(props.value)),
          "--ed": SITE_ACCENT,
        } as CSSProperties
      }
    >
      <ThemeTabs {...props} />
    </div>
  );
}

/** A random face and palette (from their photos when there are some). */
function shuffle(
  theme: ArtistTheme,
  palettes: PhotoPalette[],
): Partial<ArtistTheme> {
  const pick = <T,>(list: readonly T[]) =>
    list[Math.floor(Math.random() * list.length)]!;
  const faces = (Object.keys(FACES) as FaceKey[]).filter(
    (f) => f !== theme.display,
  );
  const display = pick(faces);
  const palette = palettes.length
    ? pick(palettes)
    : {
        ground: pick(GROUND_SWATCHES),
        accent: pick(ACCENT_SWATCHES.filter((a) => a !== theme.accent)),
      };
  return {
    display,
    case: FACES[display].upper ? "upper" : "typed",
    ...palette,
  };
}

// ---------------------------------------------------------------------------
// Layout

function LayoutTab({
  value,
  change,
  starters,
}: {
  value: ArtistTheme;
  change: Change;
  starters?: ReactNode;
}) {
  const resolved = resolveTheme(value);
  return (
    <>
      {starters}
      <PanelSection title="Layout">
        <div role="radiogroup" aria-label="Layout" className="grid gap-2">
          {(Object.keys(LAYOUTS) as LayoutKey[]).map((key) => (
            <OptionRow
              key={key}
              active={value.layout === key}
              onClick={() => change({ layout: key })}
              label={LAYOUTS[key].label}
              description={LAYOUTS[key].description}
            >
              <span
                aria-hidden
                className="block h-14 overflow-hidden rounded-[8px]"
                style={{ background: resolved.ground }}
              >
                <ThemeSchematic layout={key} theme={resolved} />
              </span>
            </OptionRow>
          ))}
        </div>
        {value.layout === "reel" ? (
          <Hint>
            While you edit, Reel is laid out like Headliner so you can arrange
            it. Visitors see it sideways, in the same order.
          </Hint>
        ) : null}
      </PanelSection>

      <PanelSection title="Style">
        <div role="radiogroup" aria-label="Style" className="grid gap-2">
          {(Object.keys(STYLES) as StyleKey[]).map((key) => (
            <OptionRow
              key={key}
              active={value.style === key}
              onClick={() => change({ style: key })}
              label={STYLES[key].label}
              description={STYLES[key].description}
            >
              <StyleSwatch style={key} ground={resolved.ground} />
            </OptionRow>
          ))}
        </div>
      </PanelSection>
    </>
  );
}

/** A radio row: a drawing, then a label and a line about it. */
function OptionRow({
  active,
  onClick,
  label,
  description,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 rounded-[14px] border p-2 text-left transition-colors",
        active
          ? "border-white bg-white/[0.06]"
          : "border-white/10 hover:border-white/35",
      )}
    >
      {children}
      <span className="min-w-0">
        <span className="t-label flex items-center gap-1.5 text-[10px] text-white">
          {label}
          {active ? <Check className="size-3.5 text-[var(--ed)]" /> : null}
        </span>
        <span className="mt-1.5 block text-[12px] leading-snug text-white/55">
          {description}
        </span>
      </span>
    </button>
  );
}

/**
 * A tiny tile drawn in a style: the swatch for each Style option. Sets its
 * own `data-style`, so it shows that style whatever the page is using. On a
 * themed page it picks up the page's colours; elsewhere, the theme's ground.
 */
function StyleSwatch({ style, ground }: { style: StyleKey; ground: string }) {
  return (
    <span
      aria-hidden
      data-style={style}
      className="block h-14 overflow-hidden rounded-[8px] p-2.5 pr-3.5 pb-3.5"
      style={
        {
          background: `var(--cp-ground, ${ground})`,
          "--tile-pad": "8px",
        } as CSSProperties
      }
    >
      <span className="cp-tile flex h-full flex-col justify-center gap-1.5 !rounded-[6px]">
        <span className="t-label cp-tag w-fit !gap-1 text-[6px]">Listen</span>
        <span className="block h-1 w-3/4 rounded-full bg-[var(--cp-muted,rgb(255_255_255/0.6))] opacity-60" />
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Colour

function ColourTab({
  value,
  change,
  palettes,
}: {
  value: ArtistTheme;
  change: Change;
  palettes: PhotoPalette[] | null;
}) {
  const resolved = resolveTheme(value);
  const autoInk = value.ink === null;
  const inkContrast = value.ink ? contrast(value.ink, value.ground) : null;
  return (
    <>
      {palettes?.length ? (
        <PanelSection title="From your photos">
          <div className="grid grid-cols-2 gap-2">
            {palettes.map((p) => {
              const active =
                value.accent === p.accent && value.ground === p.ground;
              return (
                <button
                  key={p.src}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    change({
                      ground: p.ground,
                      groundTop: p.groundTop,
                      accent: p.accent,
                    })
                  }
                  className={cn(
                    "rounded-[12px] border p-2 text-left transition-colors",
                    active
                      ? "border-white bg-white/[0.06]"
                      : "border-white/10 hover:border-white/35",
                  )}
                >
                  <span className="flex h-6 overflow-hidden rounded-[6px]">
                    {[p.ground, p.groundTop, p.accent].map((c, i) => (
                      <span
                        key={i}
                        className="flex-1"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="mt-1.5 block truncate text-[11.5px] text-white/65">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
          <Hint>Picked from your banner, portrait, covers and photos.</Hint>
        </PanelSection>
      ) : null}

      <PanelSection title="Background">
        <Segmented
          label="Background"
          value={value.background}
          options={[
            { value: "solid", label: "Solid" },
            { value: "gradient", label: "Gradient" },
            { value: "photo", label: "Photo" },
          ]}
          onChange={(background) =>
            change(
              // A gradient between two of the same colour shows nothing, so
              // it starts from a glow of the accent.
              background === "gradient" && value.groundTop === value.ground
                ? {
                    background,
                    groundTop: mixHex(value.ground, value.accent, 0.22),
                  }
                : { background },
            )
          }
        />
        <ColourField
          label={value.background === "gradient" ? "Bottom" : "Colour"}
          value={value.ground}
          swatches={GROUND_SWATCHES}
          onChange={(ground, group) => change({ ground }, group)}
        />
        {value.background === "gradient" ? (
          <ColourField
            label="Top"
            value={value.groundTop}
            swatches={[]}
            onChange={(groundTop, group) => change({ groundTop }, group)}
          />
        ) : value.background === "photo" ? (
          <Hint>
            Your banner (or portrait), under a veil of this colour so everything
            stays readable.
          </Hint>
        ) : null}
        <Field label="Texture">
          {() => (
            <Segmented
              label="Texture"
              value={value.texture}
              options={[
                { value: "none", label: "None" },
                { value: "grain", label: "Grain" },
                { value: "halftone", label: "Halftone" },
              ]}
              onChange={(texture) => change({ texture })}
            />
          )}
        </Field>
      </PanelSection>

      <PanelSection title="Accent">
        <ColourField
          label="Accent"
          hideLabel
          value={value.accent}
          swatches={ACCENT_SWATCHES}
          onChange={(accent, group) => change({ accent }, group)}
        />
        {resolved.accentText !== resolved.accent ? (
          <Hint>
            This accent is too faint on this background to use for text, so
            links and labels use the text colour.
          </Hint>
        ) : null}
      </PanelSection>

      <PanelSection title="Text">
        <Segmented
          label="Text colour"
          value={autoInk ? "auto" : "custom"}
          options={[
            { value: "auto", label: "Auto" },
            { value: "custom", label: "Custom" },
          ]}
          onChange={(v) =>
            change({
              ink:
                v === "auto"
                  ? null
                  : resolved.tone === "light"
                    ? "#1a1714"
                    : "#f4ede4",
            })
          }
        />
        {value.ink ? (
          <>
            <ColourField
              label="Text colour"
              hideLabel
              value={value.ink}
              swatches={[]}
              onChange={(ink, group) => change({ ink }, group)}
              aside={
                <span
                  className={cn(
                    "t-label rounded-full px-2.5 py-1.5 text-[9px]",
                    inkContrast !== null && inkContrast >= MIN_TEXT_CONTRAST
                      ? "bg-[var(--ed)] text-black"
                      : "bg-[var(--site-danger,#e5484d)] text-white",
                  )}
                >
                  {inkContrast?.toFixed(1)} : 1
                </span>
              }
            />
            <Hint>
              {inkContrast !== null && inkContrast >= MIN_TEXT_CONTRAST
                ? "Readable on this background."
                : `Too faint on this background (it needs ${MIN_TEXT_CONTRAST} : 1), so the page uses Auto until it reads.`}
            </Hint>
          </>
        ) : (
          <Hint>Black or white, whichever reads on the background.</Hint>
        )}
      </PanelSection>

      <PanelSection title="Tiles">
        <Range
          label="Tint from the accent"
          min={0}
          max={20}
          value={value.tint}
          unit="%"
          onChange={(tint) => change({ tint }, "tint")}
        />
        <Hint>How much of the accent the tiles take on.</Hint>
      </PanelSection>

      <PanelSection title="Your photos">
        <Segmented
          label="Photo treatment"
          value={value.photo}
          options={[
            { value: "color", label: "Colour" },
            { value: "mono", label: "B&W" },
            { value: "duotone", label: "Duotone" },
          ]}
          onChange={(photo) => change({ photo })}
        />
        <Hint>Gig posters always show as made.</Hint>
      </PanelSection>
    </>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** `a` with `amount` (0 to 1) of `b` mixed in, as `#rrggbb`. */
function mixHex(a: string, b: string, amount: number) {
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(channel(a, i) * (1 - amount) + channel(b, i) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * Swatches, a picker and a hex field for one colour. Reports picker drags
 * and typing with a group, so each undoes as one change.
 */
function ColourField({
  label,
  hideLabel,
  value,
  swatches,
  onChange,
  aside,
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  swatches: readonly string[];
  onChange: (hex: string, group?: string) => void;
  aside?: ReactNode;
}) {
  // The hex field holds what's typed until it's a valid colour.
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  const body = (id: string) => (
    <div className="space-y-3">
      {swatches.length ? (
        <div className="flex flex-wrap gap-2">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`${label} ${c}`}
              aria-pressed={value.toLowerCase() === c}
              onClick={() => onChange(c)}
              className={cn(
                "size-8 rounded-full border border-white/20 transition-shadow",
                value.toLowerCase() === c
                  ? "shadow-[0_0_0_2px_#000,0_0_0_4px_var(--ed)]"
                  : "hover:shadow-[0_0_0_2px_#000,0_0_0_4px_rgb(255_255_255/0.4)]",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-white/20">
          <span className="sr-only">{label} picker</span>
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value, `${label}-picker`)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <TextInput
          id={id}
          aria-label={hideLabel ? label : undefined}
          value={draft}
          spellCheck={false}
          aria-invalid={!HEX.test(draft)}
          onChange={(e) => {
            setDraft(e.target.value);
            if (HEX.test(e.target.value))
              onChange(e.target.value.toLowerCase(), `${label}-hex`);
          }}
          className="w-32 font-mono uppercase"
        />
        {aside}
      </div>
    </div>
  );
  return hideLabel ? body(`${label}-hex`) : <Field label={label}>{body}</Field>;
}

// ---------------------------------------------------------------------------
// Type

const FACE_GROUPS = [...new Set(Object.values(FACES).map((f) => f.group))];

function TypeTab({
  value,
  change,
  sample,
}: {
  value: ArtistTheme;
  change: Change;
  sample?: string;
}) {
  return (
    <>
      <PanelSection title="Name and headings">
        <div className={cn("space-y-4", artistFontVariables)}>
          {FACE_GROUPS.map((group) => (
            <div key={group} className="space-y-2">
              <p className="t-label text-[9px] text-white/45">{group}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(FACES) as FaceKey[])
                  .filter((key) => FACES[key].group === group)
                  .map((key) => {
                    const face = FACES[key];
                    const active = value.display === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          change({
                            display: key,
                            case: face.upper ? "upper" : "typed",
                          })
                        }
                        className={cn(
                          "flex min-w-0 flex-col items-start gap-1 rounded-[10px] border px-3 py-2.5 text-left transition-colors",
                          active
                            ? "border-[var(--ed)] shadow-[0_0_0_1px_var(--ed)]"
                            : "border-white/12 hover:border-white/40",
                        )}
                      >
                        <span
                          className="block w-full truncate text-[19px] leading-[1.15] text-white"
                          style={{
                            fontFamily: face.family,
                            fontStretch: face.stretch,
                            fontWeight: face.weight,
                            textTransform:
                              value.case === "upper" ? "uppercase" : "none",
                          }}
                        >
                          {sample ?? face.label}
                        </span>
                        <span className="text-[10.5px] text-white/50">
                          {face.label}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Case">
        <Segmented
          label="Case"
          value={value.case}
          options={[
            { value: "upper", label: "Upper" },
            { value: "typed", label: "As typed" },
          ]}
          onChange={(c) => change({ case: c })}
        />
      </PanelSection>

      <PanelSection title="Name size">
        <Segmented
          label="Name size"
          value={value.nameSize}
          options={[
            { value: "fill", label: "Fill" },
            { value: "large", label: "Large" },
            { value: "medium", label: "Medium" },
          ]}
          onChange={(nameSize) => change({ nameSize })}
        />
        <Hint>
          {value.nameSize === "fill"
            ? "Your name fills the width it has."
            : "Your name stops at this size, even with room to spare."}
        </Hint>
      </PanelSection>

      <PanelSection title="Body text">
        <div
          role="radiogroup"
          aria-label="Body text"
          className={cn("grid gap-1.5", artistFontVariables)}
        >
          {(Object.keys(BODIES) as BodyKey[]).map((key) => {
            const body = BODIES[key];
            const active = value.body === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => change({ body: key })}
                className={cn(
                  "rounded-[12px] border px-3.5 py-2.5 text-left transition-colors",
                  active
                    ? "border-white bg-white/[0.06]"
                    : "border-white/10 hover:border-white/35",
                )}
              >
                <span
                  className="block text-[15px] text-white"
                  style={{ fontFamily: body.family }}
                >
                  {body.label}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-white/50">
                  {body.note}
                </span>
              </button>
            );
          })}
        </div>
      </PanelSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shape

const RADII = [0, 8, 16, 32] as const;

function ShapeTab({ value, change }: { value: ArtistTheme; change: Change }) {
  return (
    <>
      <PanelSection title="Corners">
        <Range
          label="Corner radius"
          min={0}
          max={32}
          step={2}
          value={value.radius}
          unit="px"
          onChange={(radius) => change({ radius }, "radius")}
        />
        <div className="grid grid-cols-4 gap-2">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              aria-label={`${r}px corners`}
              aria-pressed={value.radius === r}
              onClick={() => change({ radius: r })}
              className={cn(
                "h-11 border bg-gradient-to-br from-white/14 to-white/4 transition-colors",
                value.radius === r
                  ? "border-white"
                  : "border-white/15 hover:border-white/40",
              )}
              style={{ borderRadius: r }}
            />
          ))}
        </div>
        <Hint>Tiles, photos and the header frame follow it.</Hint>
      </PanelSection>

      <PanelSection title="Buttons">
        <div
          role="radiogroup"
          aria-label="Buttons"
          className="grid grid-cols-3 gap-2"
        >
          {(
            [
              ["pill", "Pill", 999],
              ["rounded", "Rounded", 10],
              ["square", "Square", 0],
            ] as const
          ).map(([key, label, r]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value.buttons === key}
              onClick={() => change({ buttons: key })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-[12px] border px-2 py-3 transition-colors",
                value.buttons === key
                  ? "border-white bg-white/[0.06]"
                  : "border-white/10 hover:border-white/35",
              )}
            >
              <span
                className="t-label inline-flex h-8 items-center px-3.5 text-[9px]"
                style={{
                  borderRadius: r,
                  background: value.accent,
                  color: resolveTheme(value).accentInk,
                }}
              >
                Listen
              </span>
              <span className="text-[11.5px] text-white/65">{label}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Spacing">
        <Segmented
          label="Spacing"
          value={value.density}
          options={[
            { value: "compact", label: "Compact" },
            { value: "regular", label: "Regular" },
            { value: "airy", label: "Airy" },
          ]}
          onChange={(density) => change({ density })}
        />
        <Hint>Between tiles and inside them, together, so it stays even.</Hint>
      </PanelSection>

      {value.style === "print" ? (
        <PanelSection title="Outline">
          <Segmented
            label="Outline"
            value={value.outline}
            options={[1, 2, 3].map((w) => ({ value: w, label: `${w}px` }))}
            onChange={(outline) => change({ outline })}
          />
          <Hint>The weight of Print&apos;s ink lines.</Hint>
        </PanelSection>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-snug text-white/50">{children}</p>;
}

/** A slider with its value beside it, named by the section it's in. */
function Range({
  label,
  min,
  max,
  step = 1,
  value,
  unit,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--ed)]"
      />
      <span className="w-12 text-right font-mono text-[12px] text-white/80 tabular-nums">
        {value}
        {unit}
      </span>
    </div>
  );
}
