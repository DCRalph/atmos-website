import { buildMediaUrl } from "~/lib/media-url";
import {
  resolveSocialPlatform,
  type SocialPlatformId,
} from "~/lib/social-pills";

/**
 * A crew member merged with its optionally-linked artist profile, as returned
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
  artistProfile?: {
    id: string;
    handle: string;
    displayName: string;
    tagline: string | null;
    avatarFileId: string | null;
    isPublished: boolean;
    socials: Array<{ platform: string; url: string }>;
  } | null;
};

/** Final values shown on crew cards. */
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
  /** Where name, photo and socials come from. Never a mix of the two. */
  source: "profile" | "manual";
  /** True when the crew row has no role and the profile tagline stands in. */
  roleFromTagline: boolean;
};

/** A profile's link for one platform, matched the way the profile page reads it. */
export function findProfileSocial(
  socials: Array<{ platform: string; url: string }>,
  platformId: SocialPlatformId,
): string | null {
  return (
    socials.find(
      (social) =>
        resolveSocialPlatform(social.platform, social.url)?.id === platformId,
    )?.url ?? null
  );
}

/**
 * A linked crew row shows its profile's name, photo and socials, so they are
 * edited in one place. A manual row shows its own. Role belongs to the crew
 * row either way, with the profile tagline as a stand-in until one is set.
 */
export function resolveCrewDisplay(
  member: CrewMemberForDisplay,
): ResolvedCrewDisplay {
  const profile = member.artistProfile;
  const role = member.role?.trim() || null;

  if (!profile) {
    return {
      id: member.id,
      name: member.name,
      role,
      instagram: member.instagram,
      soundcloud: member.soundcloud,
      image: member.image?.trim() || null,
      profileHandle: null,
      source: "manual",
      roleFromTagline: false,
    };
  }

  const tagline = profile.tagline?.trim() || null;
  return {
    id: member.id,
    name: profile.displayName,
    role: role ?? tagline,
    instagram: findProfileSocial(profile.socials, "instagram"),
    soundcloud: findProfileSocial(profile.socials, "soundcloud"),
    image: profile.avatarFileId ? buildMediaUrl(profile.avatarFileId) : null,
    profileHandle: profile.isPublished ? profile.handle : null,
    source: "profile",
    roleFromTagline: !role && Boolean(tagline),
  };
}
