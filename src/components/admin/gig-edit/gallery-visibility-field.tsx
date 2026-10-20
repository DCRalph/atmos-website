"use client";

import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Switch } from "~/components/ui/switch";

/** Applies immediately, like the media controls alongside it. */
export function GalleryVisibilityField({
  gigId,
  enabled,
}: {
  gigId: string;
  enabled: boolean;
}) {
  const utils = api.useUtils();
  const update = api.gigs.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.gigs.getForEditor.invalidate({ id: gigId }),
        utils.gigs.getById.invalidate(),
      ]);
      toast.success("Gallery visibility saved");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <label className="border-input mb-6 flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <Switch
        checked={enabled}
        disabled={update.isPending}
        aria-busy={update.isPending}
        aria-describedby="gallery-visibility-help"
        onCheckedChange={(showGalleryBeforeGig) =>
          update.mutate({ id: gigId, showGalleryBeforeGig })
        }
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Show gallery before the gig</span>
        <span
          id="gallery-visibility-help"
          className="text-muted-foreground text-xs"
        >
          Show uploaded photos and videos before the gig is over. Turn off to
          show them only afterwards. Applies immediately.
        </span>
      </span>
    </label>
  );
}
