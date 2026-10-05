import { type Metadata } from "next";
import { DEFAULT_THEME, THEME_PRESETS } from "~/lib/creator-theme";
import { CreatorProfilePage } from "~/components/creator-profile/creator-profile-page";
import { buildSampleProfile } from "~/components/creator-profile/sample";

/**
 * The sample profile, for the theme editor's preview when there's no profile
 * of your own to show. The editor pushes the theme in by message;
 * `?preset=gold` picks a starter when opened on its own.
 */
export const metadata: Metadata = {
  title: "Theme preview",
  robots: { index: false, follow: false },
};

export default async function CreatorPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { preset } = await searchParams;
  const theme =
    preset && preset in THEME_PRESETS
      ? THEME_PRESETS[preset as keyof typeof THEME_PRESETS].theme
      : DEFAULT_THEME;
  return <CreatorProfilePage profile={buildSampleProfile()} theme={theme} />;
}
