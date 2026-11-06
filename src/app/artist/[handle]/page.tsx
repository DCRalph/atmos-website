import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { buildMediaUrl } from "~/lib/media-url";
import { NOINDEX, pageMetadata } from "~/lib/seo-constants";
import { parseTheme } from "~/lib/artist-theme";
import { userHasPermission } from "~/server/utils/permissions";
import {
  PUBLIC_PROFILE_INCLUDE,
  toEditableProfile,
  toPublicProfile,
} from "~/server/artist-public-profile";
import { ArtistProfilePage } from "~/components/artist-profile/artist-profile-page";
import type { ClaimState } from "~/components/artist-profile/parts";

export const revalidate = 60;

type Params = { handle: string };

async function loadProfile(handle: string) {
  return db.artistProfile.findUnique({
    where: { handle: handle.toLowerCase() },
    include: PUBLIC_PROFILE_INCLUDE,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  // An unpublished profile is a 404 to everyone but its owner and admins, and
  // metadata is the same for every viewer, so it doesn't name the artist.
  if (!profile?.isPublished) {
    return { title: "Profile not found", robots: NOINDEX };
  }
  const title = `${profile.displayName} (@${profile.handle})`;
  const description =
    profile.tagline ??
    profile.bio?.slice(0, 160) ??
    `${profile.displayName} on Atmos.`;
  const imageId = profile.bannerFileId ?? profile.avatarFileId;
  const metadata = pageMetadata({
    title,
    description,
    path: `/artist/${profile.handle}`,
    image: imageId ? { url: buildMediaUrl(imageId), alt: title } : undefined,
  });
  return { ...metadata, openGraph: { ...metadata.openGraph, type: "profile" } };
}

export default async function PublicArtistProfilePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ handle }, { edit }] = await Promise.all([params, searchParams]);
  const profile = await loadProfile(handle);
  if (!profile) return notFound();

  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const viewer = session?.user
    ? await db.user.findUnique({
        where: { id: session.user.id },
        include: {
          permissions: true,
          artistProfile: { select: { id: true } },
        },
      })
    : null;
  const viewerIsAdmin = viewer ? userHasPermission(viewer, "ADMIN") : false;
  const viewerIsOwner =
    viewer !== null &&
    userHasPermission(viewer, "ARTIST") &&
    viewer.id === profile.userId;

  if (!profile.isPublished && !viewerIsAdmin && !viewerIsOwner) {
    return notFound();
  }

  // The owner and admins can edit the page in place (`?edit` opens it so).
  const editable =
    viewerIsOwner || viewerIsAdmin
      ? toEditableProfile(
          profile,
          viewerIsOwner ? "owner" : "admin",
          profile.themeId
            ? await db.artistProfile.count({
                where: { themeId: profile.themeId },
              })
            : 0,
        )
      : null;

  // Anyone signed in without a profile of their own can ask to claim an
  // unclaimed one; signed-out visitors are pointed at logging in first.
  const claim: ClaimState =
    profile.claimStatus !== "UNCLAIMED"
      ? null
      : !viewer
        ? "login"
        : viewer.artistProfile
          ? null
          : "request";

  return (
    <ArtistProfilePage
      profile={toPublicProfile(profile)}
      theme={parseTheme(profile.themeRef?.tokens)}
      accentOverride={profile.accentColor}
      claim={claim}
      editable={editable}
      startEditing={edit !== undefined}
    />
  );
}
