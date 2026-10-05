import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { THEME_PRESETS, type CreatorTheme } from "~/lib/creator-theme";
import { CreatorProfilePage } from "~/components/creator-profile/creator-profile-page";
import {
  buildSampleProfile,
  sampleStates,
} from "~/components/creator-profile/sample";
import { CreatorProfileBoard } from "./board";

/**
 * Dev board for creator profiles: the real page with the sample profile, in
 * every state, under any theme. `?view=frame&state=quiet&preset=gold` renders
 * one profile on its own (what the board's preview loads).
 *
 * Open `http://localhost:3000/ui-test/creator-profile` while `next dev` is
 * running. Not reachable in production.
 */
export const metadata: Metadata = {
  title: "Creator profile board",
  robots: { index: false, follow: false },
};

export default async function CreatorProfileBoardPage({
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
    const theme: CreatorTheme =
      preset && preset in THEME_PRESETS
        ? THEME_PRESETS[preset as keyof typeof THEME_PRESETS].theme
        : THEME_PRESETS.atmos.theme;
    return (
      <CreatorProfilePage
        profile={buildSampleProfile(state)}
        theme={theme}
        claim={state === "unclaimed" ? "login" : null}
      />
    );
  }

  return <CreatorProfileBoard initialState={state} />;
}
