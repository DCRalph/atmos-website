import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { db } from "~/server/db";
import {
  APPEARANCE_ORDER,
  APPEARANCE_SELECT,
  toGigAttributions,
} from "~/server/creator-appearances";
import { auth } from "~/server/auth";
import { buildMediaUrl } from "~/lib/media-url";
import { PublicProfileGrid } from "~/components/creator/public-profile-grid";
import { CreatorProfileHero } from "~/components/creator/creator-profile-hero";
import {
  type CreatorBlockTypeName,
  type ClientBlock,
} from "~/components/creator/block-types";
import { Button } from "~/components/ui/button";
import { ClaimProfileCTA } from "~/components/creator/claim-profile-cta";
import { userHasPermission } from "~/server/utils/permissions";
import {
  parseBlockOverrides,
  resolveProfileTokens,
  themeToCssVars,
} from "~/lib/creator-theme";

export const revalidate = 60;

type Params = { handle: string };

async function loadProfile(handle: string) {
  return db.creatorProfile.findUnique({
    where: { handle: handle.toLowerCase() },
    include: {
      blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
      socials: { orderBy: { sortOrder: "asc" } },
      themeRef: true,
      setAppearances: {
        orderBy: APPEARANCE_ORDER,
        select: APPEARANCE_SELECT,
      },
    },
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

export default async function PublicCreatorProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  if (!profile) return notFound();

  const headersList = await headers();
  const session = await auth.api
    .getSession({ headers: headersList })
    .catch(() => null);
  const viewerUser = session?.user
    ? await db.user.findUnique({
        where: { id: session.user.id },
        include: { permissions: true },
      })
    : null;
  const viewerIsAdmin = viewerUser
    ? userHasPermission(viewerUser, "ADMIN")
    : false;
  const viewerIsCreator = viewerUser
    ? userHasPermission(viewerUser, "CREATOR")
    : false;
  const viewerIsOwner =
    viewerUser !== null && viewerIsCreator && viewerUser.id === profile.userId;
  const viewerHasProfile = Boolean(
    viewerUser &&
    (await db.creatorProfile.findUnique({
      where: { userId: viewerUser.id },
      select: { id: true },
    })),
  );

  if (!profile.isPublished && !viewerIsAdmin && !viewerIsOwner) {
    return notFound();
  }

  const tokens = resolveProfileTokens(
    profile.themeRef?.tokens,
    profile.accentColor,
  );
  const blockOverrides = parseBlockOverrides(profile.themeRef?.blockOverrides);
  const pageStyle = themeToCssVars(tokens, blockOverrides);
  const accent = tokens.accent;

  const blocks: (ClientBlock & { type: CreatorBlockTypeName })[] =
    profile.blocks.map((b) => ({
      id: b.id,
      type: b.type as CreatorBlockTypeName,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      data: (b.data as Record<string, unknown>) ?? {},
    }));

  const socials = profile.socials.map((s) => ({
    platform: s.platform,
    url: s.url,
    label: s.label,
  }));

  const gigAttributions = toGigAttributions(profile.setAppearances);

  return (
    <div
      className="creator-page min-h-dvh"
      style={{
        ...pageStyle,
        background: "var(--creator-page-bg-image), var(--creator-page-bg)",
        color: "var(--creator-page-fg)",
        fontFamily: "var(--creator-body-font)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!profile.isPublished && (
        <div className="bg-amber-500 py-1 text-center text-xs text-black">
          DRAFT — only visible to you and admins
        </div>
      )}

      {/* Banner + header */}
      <CreatorProfileHero
        displayName={profile.displayName}
        handle={profile.handle}
        tagline={profile.tagline}
        avatarFileId={profile.avatarFileId}
        bannerFileId={profile.bannerFileId}
        claimStatus={profile.claimStatus}
        accent={accent}
        bannerOverlay={tokens.bannerOverlay}
        backHref="/"
        actions={
          viewerIsOwner || viewerIsAdmin ? (
            <>
              {viewerIsOwner && (
                <Button asChild variant="outline">
                  <Link href="/dashboard/profile">Edit profile</Link>
                </Button>
              )}
              {viewerIsAdmin && (
                <Button asChild variant="outline">
                  <Link href={`/admin/creator-profiles/${profile.id}`}>
                    Edit as admin
                  </Link>
                </Button>
              )}
            </>
          ) : null
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {profile.bio && (
          <div className="prose prose-invert max-w-none">
            <p>{profile.bio}</p>
          </div>
        )}

        <PublicProfileGrid
          blocks={blocks}
          socials={socials}
          gigAttributions={gigAttributions}
          cols={profile.gridCols}
          rowHeightPx={profile.rowHeightPx}
          accent={accent}
          tokens={tokens}
          blockOverrides={blockOverrides}
        />

        {profile.claimStatus === "UNCLAIMED" &&
          viewerUser &&
          !viewerHasProfile &&
          !viewerIsOwner && (
            <ClaimProfileCTA profileId={profile.id} handle={profile.handle} />
          )}
      </div>
    </div>
  );
}
