import { matchSocialPlatform } from "./social-pills";

type Social = { platform: string; url: string; label: string | null };

/**
 * A social's link against its platform: a known platform takes a handle or a
 * link and gives back its canonical link. Others pass through trimmed.
 */
export function normalizeSocialUrl(platform: string, url: string): string {
  const trimmed = url.trim();
  return matchSocialPlatform(platform)?.normalizeInput(trimmed) ?? trimmed;
}

/**
 * The socials a page shows and saves: complete rows with canonical links.
 * Half-typed rows in the editor wait until they're finished.
 */
export const completeSocials = <S extends Social>(socials: readonly S[]) =>
  socials.flatMap((s) => {
    const url = normalizeSocialUrl(s.platform, s.url);
    return s.platform.trim() && /^https?:\/\/\S+\.\S+/.test(url)
      ? [{ ...s, platform: s.platform.trim(), url }]
      : [];
  });
