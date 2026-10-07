import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { buildMediaUrl } from "~/lib/media-url";
import { parseTheme } from "~/lib/artist-theme";
import { userHasPermission } from "~/server/utils/permissions";
import {
  PUBLIC_PROFILE_INCLUDE,
  toPublicProfile,
} from "~/server/artist-public-profile";
import {
  ArtistProfilePage,
  type OwnerTools,
} from "~/components/artist-profile/artist-profile-page";
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
  if (!profile) return { title: "Profile not found" };
  const title = `${profile.displayName} (@${profile.handle})`;
  const description =
    profile.tagline ?? profile.bio?.slice(0, 160) ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.bannerFileId
        ? [buildMediaUrl(profile.bannerFileId)]
        : profile.avatarFileId
          ? [buildMediaUrl(profile.avatarFileId)]
          : undefined,
      type: "profile",
    },
  };
}

export default async function PublicArtistProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;
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

  const owner: OwnerTools | null =
    viewerIsOwner || viewerIsAdmin
      ? {
          draft: !profile.isPublished,
          links: [
            ...(viewerIsOwner
              ? [{ label: "Edit profile", href: "/dashboard/profile" }]
              : []),
            ...(viewerIsAdmin
              ? [
                  {
                    label: "Edit as admin",
                    href: `/admin/artist-profiles/${profile.id}`,
                  },
                ]
              : []),
          ],
        }
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
      owner={owner}
    />
  );
}
