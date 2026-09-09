"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  ImageOff,
  Loader2,
  Upload,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { CreatorPicker } from "~/components/admin/gig-edit/creator-picker";
import { CreatorQuickCreateDialog } from "~/components/admin/gig-edit/creator-quick-create-dialog";
import { useUpload } from "~/hooks/use-upload";
import { buildMediaUrl } from "~/lib/media-url";
import { presetConstraints } from "~/lib/uploads/presets";

/** One set on the draft, as the editor query returns it. */
type Slot = {
  id: string;
  role: string | null;
  artists: {
    creatorProfile: { id: string; handle: string; displayName: string };
  }[];
};

/**
 * Step three: who is on, and what the gig looks like.
 *
 * The bill is shown rather than edited. Reordering and timing a run sheet is
 * the gig editor's job and it does it well; what this step exists for is the
 * one thing import cannot do on its own, which is decide what to do about a
 * name the post gave that the site has never heard of.
 *
 * Set times are deliberately empty. The post says who is playing, almost never
 * when, and a spread of invented times reads as fact on a run sheet.
 */
export function StepLineUp({
  gigId,
  importId,
  slots,
  unresolvedHandles,
  posterFileUploadId,
  isSaving,
  onContinue,
}: {
  gigId: string;
  importId: string;
  slots: Slot[];
  /** Handles the post billed that nobody stands behind yet. */
  unresolvedHandles: string[];
  posterFileUploadId: string | null;
  isSaving: boolean;
  onContinue: () => void;
}) {
  const utils = api.useUtils();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const resolveHandle = api.gigImport.resolveHandle.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.gigs.getForEditor.invalidate({ id: gigId }),
        utils.gigImport.get.invalidate({ importId }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const pending = unresolvedHandles.filter(
    (handle) => !skipped.includes(handle),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Line-up</CardTitle>
              <CardDescription>
                {slots.length === 0
                  ? "The post did not name anybody the site knows."
                  : "Read from the caption, in billing order. Times are set on the run sheet."}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/gigs/${gigId}`} target="_blank">
                <ExternalLink className="size-4" aria-hidden />
                Edit the run sheet
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="divide-border divide-y">
          {slots.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">
              Nothing here yet. Create a profile for a handle below, or add the
              bill in the run sheet.
            </p>
          ) : (
            slots.map((slot, index) => (
              <div
                key={slot.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-muted-foreground w-5 font-mono text-xs">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {slot.artists
                      .map((artist) => artist.creatorProfile.displayName)
                      .join(" b2b ")}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {slot.artists
                      .map((artist) => `@${artist.creatorProfile.handle}`)
                      .join(", ")}
                  </p>
                </div>
                {slot.artists.length > 1 ? (
                  <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                    Back to back
                  </span>
                ) : null}
                {slot.role ? (
                  <span className="text-muted-foreground border-border rounded-full border px-2 py-0.5 text-[11px]">
                    {slot.role}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Names with no profile</CardTitle>
            <CardDescription>
              The post billed these and the site has never heard of them. Point
              each one at somebody, or leave them off. Import will not create a
              profile on its own.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-border divide-y">
            {pending.map((handle) => (
              <div
                key={handle}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">@{handle}</p>
                  <p className="text-muted-foreground text-xs">
                    Skipping leaves them off the bill.
                  </p>
                </div>
                {/* An artist the site already has under a different handle is
                    the common case: Instagram names change, profiles do not. */}
                <CreatorPicker
                  label="Use existing"
                  excludeIds={[]}
                  disabled={resolveHandle.isPending}
                  onPick={(creator) =>
                    resolveHandle.mutate({
                      importId,
                      handle,
                      creatorProfileId: creator.creatorProfileId,
                    })
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreatingFor(handle)}
                  disabled={resolveHandle.isPending}
                >
                  <UserPlus className="size-4" aria-hidden />
                  Create profile
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSkipped((all) => [...all, handle])}
                  disabled={resolveHandle.isPending}
                >
                  Skip
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <PosterCard gigId={gigId} posterFileUploadId={posterFileUploadId} />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onContinue} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          Continue to publish
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        {skipped.length > 0 ? (
          <span className="text-muted-foreground text-xs">
            {skipped.length} name{skipped.length === 1 ? "" : "s"} skipped.
          </span>
        ) : null}
      </div>

      {creatingFor ? (
        <CreatorQuickCreateDialog
          open
          onOpenChange={(open) => {
            if (!open) setCreatingFor(null);
          }}
          initialName={creatingFor}
          onCreated={(creator) => {
            const handle = creatingFor;
            setCreatingFor(null);
            // Same operation as picking an existing profile: what the draft
            // records is who is playing, not what Instagram calls them.
            if (handle) {
              resolveHandle.mutate({
                importId,
                handle,
                creatorProfileId: creator.creatorProfileId,
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * The poster.
 *
 * Import already took the post's image and made it the poster, so the common
 * case is a preview and nothing to do. Replacing goes through the same upload
 * preset as the gig editor, which is what keeps the 3:4 resize and the file
 * bookkeeping identical.
 */
function PosterCard({
  gigId,
  posterFileUploadId,
}: {
  gigId: string;
  posterFileUploadId: string | null;
}) {
  const utils = api.useUtils();
  const setPoster = api.gigs.setPosterFromUpload.useMutation({
    onSuccess: async () => {
      await utils.gigs.getForEditor.invalidate({ id: gigId });
      toast.success("Poster updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const { upload, isUploading, accept } = useUpload("gigPoster", {
    context: { gigId },
    onComplete: (files) => {
      const file = files[0];
      if (file) setPoster.mutate({ gigId, fileUploadId: file.id });
    },
    onError: (message) => toast.error(message),
  });

  const constraints = presetConstraints("gigPoster");
  const isBusy = isUploading || setPoster.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Poster</CardTitle>
        <CardDescription>
          {posterFileUploadId
            ? "Taken from the post and resized. Replace it if the crop is wrong."
            : "The post had no usable image. Upload one, or publish without."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-5">
        <div className="border-border bg-background relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-lg border">
          {posterFileUploadId ? (
            <Image
              src={buildMediaUrl(posterFileUploadId)}
              alt="Gig poster"
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="text-muted-foreground grid h-full place-items-center">
              <ImageOff className="size-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-muted-foreground text-xs">
            The public gig page wants a portrait 3:4 image. An Instagram square
            is cropped to fit, so check the edges before publishing.
          </p>
          <label>
            <input
              type="file"
              accept={accept}
              className="sr-only"
              disabled={isBusy}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length > 0) void upload(files);
              }}
            />
            <Button variant="outline" size="sm" asChild disabled={isBusy}>
              <span>
                {isBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-4" aria-hidden />
                )}
                {posterFileUploadId ? "Replace poster" : "Upload a poster"}
              </span>
            </Button>
          </label>
          <p className="text-muted-foreground text-xs">
            Up to {Math.round(constraints.maxFileSize / (1024 * 1024))}MB.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
