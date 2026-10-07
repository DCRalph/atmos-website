"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { THEME_PRESETS, type ArtistTheme } from "~/lib/artist-theme";
import {
  sampleStates,
  type SampleState,
} from "~/components/artist-profile/sample";
import { ThemeControls } from "~/components/artist-themes/theme-controls";
import { ThemeSwatch } from "~/components/artist-themes/theme-swatch";
import { ProfilePreviewFrame } from "~/components/artist-themes/profile-preview-frame";

type PresetKey = keyof typeof THEME_PRESETS;

/** Pick a sample state and a theme; the preview updates without reloading. */
export function ArtistProfileBoard({
  initialState,
}: {
  initialState: SampleState;
}) {
  const [state, setState] = useState<SampleState>(initialState);
  const [theme, setTheme] = useState<ArtistTheme>(THEME_PRESETS.atmos.theme);
  const hint = sampleStates.find((s) => s.id === state)?.hint;

  return (
    <div className="bg-background text-foreground min-h-dvh px-4 py-6 sm:px-6">
      <div className="grid items-start gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Artist profile board</CardTitle>
              <p className="text-muted-foreground text-sm">
                The real profile page with the sample profile. Photos and
                posters are real Atmos images; names and copy are placeholders.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Profile</p>
                <div className="flex flex-wrap gap-1.5">
                  {sampleStates.map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant={state === s.id ? "default" : "outline"}
                      aria-pressed={state === s.id}
                      onClick={() => setState(s.id)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                {hint ? (
                  <p className="text-muted-foreground text-xs">{hint}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Starter themes</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(THEME_PRESETS) as PresetKey[]).map((key) => {
                    const preset = THEME_PRESETS[key];
                    const active =
                      JSON.stringify(preset.theme) === JSON.stringify(theme);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTheme(preset.theme)}
                        className={cn(
                          "rounded-md border p-1.5 text-left text-xs transition",
                          active
                            ? "border-primary ring-primary/30 ring-2"
                            : "hover:border-foreground/30",
                        )}
                      >
                        <ThemeSwatch tokens={preset.theme} compact />
                        <span className="mt-1 block font-medium">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
          <ThemeControls
            value={theme}
            onChange={(patch) => setTheme((t) => ({ ...t, ...patch }))}
          />
        </div>
        <div className="xl:sticky xl:top-4">
          <ProfilePreviewFrame
            src={`/ui-test/artist-profile?view=frame&state=${state}`}
            theme={theme}
            label={`Sample profile, ${sampleStates.find((s) => s.id === state)?.label}`}
          />
        </div>
      </div>
    </div>
  );
}
