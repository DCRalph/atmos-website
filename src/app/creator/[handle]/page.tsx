import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { buildMediaUrl } from "~/lib/media-url";
import { PublicProfileGrid } from "~/components/creator/public-profile-grid";
import {
  type CreatorBlockTypeName,
  type ClientBlock,
} from "~/components/creator/block-types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ClaimProfileCTA } from "~/components/creator/claim-profile-cta";

export const revalidate = 60;

type Params = { handle: string };

async function loadProfile(handle: string) {
  return db.creatorProfile.findUnique({
    where: { handle: handle.toLowerCase() },
    include: {
      blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
      socials: { orderBy: { sortOrder: "asc" } },
      gigCreators: {
        orderBy: { sortOrder: "asc" },
        include: {
          gig: {
            select: {
              id: true,
              title: true,
              subtitle: true,
              gigStartTime: true,
              gigEndTime: true,
              posterFileUploadId: true,
              mode: true,
            },
          },
        },
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
  const description = profile.tagline ?? profile.bio?.slice(0, 160) ?? undefined;
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
  const session = await auth.api.getSession({ headers: headersList }).catch(() => null);
  const viewerUser = session?.user
    ? await db.user.findUnique({
        where: { id: session.user.id },
        include: { roles: true },
      })
    : null;
  const viewerIsAdmin =
    viewerUser?.roles?.some((r) => r.role === "ADMIN") ?? false;
  const viewerIsOwner =
    Boolean(viewerUser) && viewerUser!.id === profile.userId;
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

  const accent = profile.accentColor ?? null;
  const accentVars: React.CSSProperties = accent
    ? ({ ["--creator-accent" as string]: accent } as React.CSSProperties)
    : {};

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

  const gigAttributions = profile.gigCreators.map((g) => ({
    id: g.id,
    role: g.role,
    gig: g.gig,
  }));

  return (
    <div
      className={`min-h-dvh ${
        profile.theme === "light" ? "bg-white text-black" : ""
      }`}
      style={accentVars}
    >
      {!profile.isPublished && (
        <div className="bg-amber-500 text-black text-center text-xs py-1">
          DRAFT — only visible to you and admins
        </div>
      )}

      {/* Banner + header */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 z-20 mx-auto max-w-6xl px-4 pt-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-background/70 backdrop-blur-sm"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
        {profile.bannerFileId ? (
          <div className="relative h-48 md:h-64 w-full overflow-hidden">
            <Image
              src={buildMediaUrl(profile.bannerFileId)}
              alt=""
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-linear-to-t from-background to-transparent" />
          </div>
        ) : (
          <div
            className="h-32 md:h-48 w-full"
            style={{
              background: accent
                ? `linear-gradient(135deg, ${accent}, ${accent}88)`
                : undefined,
            }}
          />
        )}
        <div className="mx-auto max-w-6xl px-4 -mt-16 md:-mt-20 relative z-10">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
            <div className="relative h-28 w-28 md:h-36 md:w-36 overflow-hidden rounded-full border-4 border-background bg-muted">
              {profile.avatarFileId ? (
                <Image
                  src={buildMediaUrl(profile.avatarFileId)}
                  alt={profile.displayName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-3xl font-bold">
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl md:text-4xl font-bold">
                  {profile.displayName}
                </h1>
                {profile.claimStatus === "UNCLAIMED" && (
                  <Badge variant="secondary">Unclaimed profile</Badge>
                )}
              </div>
              <p className="text-muted-foreground font-mono text-sm">
                @{profile.handle}
              </p>
              {profile.tagline && (
                <p className="text-lg">{profile.tagline}</p>
              )}
            </div>
            <div className="flex gap-2">
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
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
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
