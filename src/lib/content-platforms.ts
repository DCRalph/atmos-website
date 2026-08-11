/**
 * The platforms a content item can name, and the branding each one gets.
 *
 * One list, because the public cards look their colour and icon up by the exact
 * string stored on the item: a value that is not in here renders with neither.
 * The admin editor reads the same list so it can warn before that happens —
 * which it could not do while these maps lived in two card components.
 */

export type KnownPlatform = {
  /** Stored verbatim on `content_item.platform`. Casing matters. */
  value: string;
  /** Tailwind text colour for the platform name on a card. */
  colorClass: string;
  /** Icon in `public/socials`. */
  iconSrc: string;
};

export const KNOWN_PLATFORMS: KnownPlatform[] = [
  {
    value: "Soundcloud",
    colorClass: "text-[#ff7700]",
    iconSrc: "/socials/soundcloud_color.png",
  },
  {
    value: "Spotify",
    colorClass: "text-[#1DB954]",
    iconSrc: "/socials/spotify.png",
  },
  {
    value: "YouTube",
    colorClass: "text-[#FF0000]",
    iconSrc: "/socials/youtube.png",
  },
];

const byValue = new Map(KNOWN_PLATFORMS.map((p) => [p.value, p]));

export const findPlatform = (platform: string | null | undefined) =>
  platform ? (byValue.get(platform) ?? null) : null;

export const platformColorClass = (platform: string | null | undefined) =>
  findPlatform(platform)?.colorClass;

export const platformIconSrc = (platform: string | null | undefined) =>
  findPlatform(platform)?.iconSrc ?? null;

/**
 * A known platform whose casing differs from `platform` — the whole reason this
 * module exists. "SoundCloud" is stored on live rows and silently matches
 * nothing, so the editor can offer the correct spelling instead.
 */
export const platformCasingMatch = (platform: string): KnownPlatform | null => {
  const needle = platform.trim().toLowerCase();
  if (!needle) return null;
  return (
    KNOWN_PLATFORMS.find(
      (candidate) =>
        candidate.value.toLowerCase() === needle &&
        candidate.value !== platform,
    ) ?? null
  );
};
