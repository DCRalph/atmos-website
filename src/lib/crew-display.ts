import { buildMediaUrl } from "~/lib/media-url";

/**
 * A crew member merged with its optionally-linked creator profile, as returned
 * by the crew tRPC router. Kept intentionally structural so both server- and
 * client-side callers can pass whatever subset they have.
 */
export type CrewMemberForDisplay = {
  id: string;
  name: string;
  role: string | null;
  instagram: string | null;
  soundcloud: string | null;
  image: string | null;
  creatorProfile?: {
    id: string;
    handle: string;
    displayName: string;
    tagline: string | null;
    avatarFileId: string | null;
    isPublished: boolean;
    socials: Array<{ platform: string; url: string }>;
  } | null;
};

/** Final values shown on crew cards & pulled from the linked profile when available. */
export type ResolvedCrewDisplay = {
  id: string;
  name: string;
  role: string | null;
  instagram: string | null;
  soundcloud: string | null;
  /** Final image URL to render, or null if none is available. */
  image: string | null;
  /** Handle to link to (only set when the linked profile is published). */
  profileHandle: string | null;
  /** Provenance for each field: "profile" when inherited, "member" when the crew row's own value is used, "none" when unavailable. */
  source: {
    name: "profile" | "member";
    role: "profile" | "member" | "none";
    instagram: "profile" | "member" | "none";
    soundcloud: "profile" | "member" | "none";
    image: "profile" | "member" | "none";
  };
  /** True if any field is being sourced from the linked profile. */
  isLinked: boolean;
};

function findSocialUrl(
  socials: Array<{ platform: string; url: string }> | undefined,
  platformId: string,
): string | null {
  if (!socials?.length) return null;
  const needle = platformId.toLowerCase();
  const match = socials.find((s) => s.platform.toLowerCase() === needle);
  return match?.url ?? null;
}

/**
 * Merge a crew member with its optionally-linked creator profile. Profile
 * values take precedence; crew row values act as fallback so we still render
 * something sensible when a profile is missing a field.
 */
export function resolveCrewDisplay(
  member: CrewMemberForDisplay,
): ResolvedCrewDisplay {
  const profile = member.creatorProfile;

  const profileName = profile?.displayName?.trim() || null;
  const profileTagline = profile?.tagline?.trim() || null;
  const profileInstagram = findSocialUrl(profile?.socials, "instagram");
  const profileSoundcloud = findSocialUrl(profile?.socials, "soundcloud");
  const profileAvatar = profile?.avatarFileId
    ? buildMediaUrl(profile.avatarFileId)
    : null;

  const memberRole = member.role?.trim() || null;
  const memberImage = member.image?.trim() || null;

  const name = profileName ?? member.name;
  const role = profileTagline ?? memberRole;
  const instagram = profileInstagram ?? member.instagram ?? null;
  const soundcloud = profileSoundcloud ?? member.soundcloud ?? null;
  const image = profileAvatar ?? memberImage;

  return {
    id: member.id,
    name,
    role,
    instagram,
    soundcloud,
    image,
    profileHandle:
      profile && profile.isPublished ? profile.handle : null,
    source: {
      name: profileName ? "profile" : "member",
      role: profileTagline ? "profile" : memberRole ? "member" : "none",
      instagram: profileInstagram
        ? "profile"
        : member.instagram
          ? "member"
          : "none",
      soundcloud: profileSoundcloud
        ? "profile"
        : member.soundcloud
          ? "member"
          : "none",
      image: profileAvatar ? "profile" : memberImage ? "member" : "none",
    },
    isLinked: Boolean(profile),
  };
}
