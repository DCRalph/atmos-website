"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { creatorFontVariables } from "~/lib/creator-fonts";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ACCENT_SWATCHES,
  FACES,
  GROUND_SWATCHES,
  LAYOUTS,
  resolveTheme,
  type CreatorTheme,
  type FaceKey,
  type LayoutKey,
} from "~/lib/creator-theme";
import { ThemeSchematic } from "./theme-swatch";

/**
 * Every choice in a creator theme: layout, colours, display font, corners and
 * photo treatment, as cards. Used by the theme editor and the
 * `/ui-test/creator-profile` board.
 */
export function ThemeControls({
  value: tokens,
  onChange: patch,
}: {
  value: CreatorTheme;
  onChange: (patch: Partial<CreatorTheme>) => void;
}) {
  const resolved = resolveTheme(tokens);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Layout</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Layout" className="grid gap-2">
            {(Object.keys(LAYOUTS) as LayoutKey[]).map((key) => {
              const active = tokens.layout === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => patch({ layout: key })}
                  className={cn(
                    "grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 rounded-md border p-2 text-left transition",
                    active
                      ? "border-primary ring-primary/30 ring-2"
                      : "hover:border-foreground/30",
                  )}
                >
                  <span
                    aria-hidden
                    className="block h-14 overflow-hidden rounded-sm border"
                    style={{ background: resolved.ground }}
                  >
                    <ThemeSchematic layout={key} theme={resolved} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {LAYOUTS[key].label}
                      {active ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {LAYOUTS[key].description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Colours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ColourField
            label="Background"
            value={tokens.ground}
            swatches={GROUND_SWATCHES}
            onChange={(ground) => patch({ ground })}
          />
          <ColourField
            label="Accent"
            value={tokens.accent}
            swatches={ACCENT_SWATCHES}
            onChange={(accent) => patch({ accent })}
          />
          <p className="text-muted-foreground text-xs">
            Text colours follow from these, so everything stays readable.
            {resolved.accentText !== resolved.accent
              ? " This accent is too faint to read as text on this background, so headings and links use the text colour instead."
              : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Type and shape</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OptionGroup label="Display font">
            <div className={cn("flex flex-wrap gap-1.5", creatorFontVariables)}>
              {(Object.keys(FACES) as FaceKey[]).map((key) => (
                <Choice
                  key={key}
                  active={tokens.display === key}
                  onClick={() => patch({ display: key })}
                  style={{
                    fontFamily: FACES[key].family,
                    fontStretch: FACES[key].stretch,
                    fontWeight: FACES[key].weight,
                    textTransform: FACES[key].upper ? "uppercase" : "none",
                  }}
                >
                  {FACES[key].label}
                </Choice>
              ))}
            </div>
          </OptionGroup>
          <OptionGroup label="Corners">
            <div className="flex gap-1.5">
              <Choice
                active={tokens.corners === "hard"}
                onClick={() => patch({ corners: "hard" })}
              >
                Hard
              </Choice>
              <Choice
                active={tokens.corners === "soft"}
                onClick={() => patch({ corners: "soft" })}
              >
                Soft
              </Choice>
            </div>
          </OptionGroup>
          <OptionGroup
            label="Photos"
            hint="Your own photos only. Gig posters always show as made."
          >
            <div className="flex gap-1.5">
              {(["color", "mono", "duotone"] as const).map((p) => (
                <Choice
                  key={p}
                  active={tokens.photo === p}
                  onClick={() => patch({ photo: p })}
                >
                  {p === "color"
                    ? "Colour"
                    : p === "mono"
                      ? "Black and white"
                      : "Duotone"}
                </Choice>
              ))}
            </div>
          </OptionGroup>
        </CardContent>
      </Card>
    </>
  );
}

function OptionGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function Choice({
  active,
  onClick,
  style,
  children,
}: {
  active: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
      style={style}
    >
      {children}
    </Button>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Swatches, a picker and a hex field for one colour. */
function ColourField({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string;
  value: string;
  swatches: readonly string[];
  onChange: (hex: string) => void;
}) {
  // The hex field holds what's typed until it's a valid colour.
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  const id = `colour-${label.toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value.toLowerCase() === c}
            onClick={() => onChange(c)}
            className={cn(
              "size-7 rounded-full border transition-shadow",
              value.toLowerCase() === c
                ? "ring-primary ring-2 ring-offset-2"
                : "hover:ring-foreground/30 hover:ring-2",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border"
        />
        <Input
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (HEX.test(e.target.value))
              onChange(e.target.value.toLowerCase());
          }}
          aria-invalid={!HEX.test(draft)}
          className="w-32 font-mono"
        />
      </div>
    </div>
  );
}
