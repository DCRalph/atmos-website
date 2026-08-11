import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { buildMediaUrl } from "~/lib/media-url";

/**
 * Banner + avatar + name header for a public creator profile.
 *
 * Extracted from the page so the UI test harness (`/ui-test/creator`) renders
 * the exact same markup the real page does instead of a drifting copy.
 */
export type CreatorProfileHeroProps = {
  displayName: string;
  handle: string;
  tagline: string | null;
  avatarFileId: string | null;
  bannerFileId: string | null;
  /** Shows the "Unclaimed profile" badge when `"UNCLAIMED"`. */
  claimStatus: string;
  accent: string | null;
  bannerOverlay: string | null;
  /** Where the "Back" button points. Omit to hide it. */
  backHref?: string;
  /** Owner/admin edit buttons, rendered at the end of the name row. */
  actions?: React.ReactNode;
};

export function CreatorProfileHero({
  displayName,
  handle,
  tagline,
  avatarFileId,
  bannerFileId,
  claimStatus,
  accent,
  bannerOverlay,
  backHref,
  actions,
}: CreatorProfileHeroProps) {
  return (
    <div className="relative">
      {backHref && (
        <div className="absolute inset-x-0 top-0 z-20 mx-auto max-w-6xl px-4 pt-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-background/70 backdrop-blur-sm"
          >
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      )}
      {bannerFileId ? (
        <div className="relative h-48 w-full overflow-hidden md:h-64">
          <Image
            src={buildMediaUrl(bannerFileId)}
            alt=""
            fill
            className="object-cover"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--creator-page-bg), transparent)",
            }}
          />
          {bannerOverlay && (
            <div
              className="absolute inset-0"
              style={{ background: bannerOverlay }}
            />
          )}
        </div>
      ) : (
        <div
          className="h-32 w-full md:h-48"
          style={{
            background: accent
              ? `linear-gradient(135deg, ${accent}, ${accent}88)`
              : undefined,
          }}
        />
      )}
      <div className="relative z-10 mx-auto -mt-16 max-w-6xl px-4 md:-mt-20">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
          <div className="border-background bg-muted relative h-28 w-28 overflow-hidden rounded-full border-4 md:h-36 md:w-36">
            {avatarFileId ? (
              <Image
                src={buildMediaUrl(avatarFileId)}
                alt={displayName}
                fill
                className="object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-3xl font-bold">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-3xl md:text-4xl"
                style={{
                  fontFamily: "var(--creator-heading-font)",
                  fontWeight: "var(--creator-heading-weight)",
                  letterSpacing: "var(--creator-letter-spacing)",
                }}
              >
                {displayName}
              </h1>
              {claimStatus === "UNCLAIMED" && (
                <Badge variant="secondary">Unclaimed profile</Badge>
              )}
            </div>
            <p className="text-muted-foreground font-mono text-sm">@{handle}</p>
            {tagline && <p className="text-lg">{tagline}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
