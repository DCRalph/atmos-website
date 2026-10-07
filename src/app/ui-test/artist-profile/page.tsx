import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { THEME_PRESETS, type ArtistTheme } from "~/lib/artist-theme";
import { ArtistProfilePage } from "~/components/artist-profile/artist-profile-page";
import {
  buildSampleProfile,
  sampleStates,
} from "~/components/artist-profile/sample";
import { ArtistProfileBoard } from "./board";

/**
 * Dev board for artist profiles: the real page with the sample profile, in
 * every state, under any theme. `?view=frame&state=quiet&preset=gold` renders
 * one profile on its own (what the board's preview loads).
 *
 * Open `http://localhost:3000/ui-test/artist-profile` while `next dev` is
 * running. Not reachable in production.
 */
export const metadata: Metadata = {
  title: "Artist profile board",
  robots: { index: false, follow: false },
};

export default async function ArtistProfileBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") return notFound();
  const raw = await searchParams;
  const param = (key: string) => {
    const v = raw[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const state = sampleStates.find((s) => s.id === param("state"))?.id ?? "full";

  if (param("view") === "frame") {
    const preset = param("preset");
    const theme: ArtistTheme =
      preset && preset in THEME_PRESETS
        ? THEME_PRESETS[preset as keyof typeof THEME_PRESETS].theme
        : THEME_PRESETS.atmos.theme;
    return (
      <ArtistProfilePage
        profile={buildSampleProfile(state)}
        theme={theme}
        claim={state === "unclaimed" ? "login" : null}
      />
    );
  }

  return <ArtistProfileBoard initialState={state} />;
}
