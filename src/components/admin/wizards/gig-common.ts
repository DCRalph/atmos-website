"use client";

import { useCallback, useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { useUpload } from "~/hooks/use-upload";
import { formatEventDate } from "~/lib/ticketing/dates";
import type { PosterDraft } from "~/components/admin/gig-edit/types";

export type EditorGig = NonNullable<RouterOutputs["gigs"]["getForEditor"]>;

/** "Late Bloom · Fri 19 Dec", the subtitle every gig wizard wears. */
export const gigLabel = (gig: {
  title: string;
  gigStartTime: Date;
  isTba?: boolean;
}) => `${gig.title} · ${formatEventDate(gig.gigStartTime)}`;

/** The full editor for a gig, from a wizard's header. */
export const gigEditorHref = (gigId: string) => `/admin/gigs/${gigId}`;

/**
 * Puts a picked poster on a gig, the way the gig editor's Save does: the
 * bytes go up under the gig, then the gig is pointed at them. `remove` clears
 * the slot without deleting the file, which other places may still show.
 *
 * `progress` is 0-100 while a file is transferring, null otherwise, which is
 * what `PosterField` wants for its bar.
 */
export function usePosterCommit() {
  const setPoster = api.gigs.setPosterFromUpload.useMutation();
  const clearPoster = api.gigs.clearPoster.useMutation();
  const [active, setActive] = useState<"poster" | "wide" | null>(null);

  const portrait = useUpload("gigPoster");
  const wide = useUpload("gigWidePoster");

  const commit = useCallback(
    async (gigId: string, slot: "poster" | "wide", draft: PosterDraft) => {
      if (draft.kind === "keep") return;
      if (draft.kind === "remove") {
        await clearPoster.mutateAsync({ gigId, deleteFile: false, slot });
        return;
      }
      const uploader = slot === "wide" ? wide : portrait;
      setActive(slot);
      try {
        uploader.reset();
        const [uploaded] = await uploader.upload([draft.file], {
          context: { gigId },
        });
        if (!uploaded) {
          throw new Error(
            `The ${slot === "wide" ? "wide poster" : "poster"} did not upload. Try again.`,
          );
        }
        await setPoster.mutateAsync({
          gigId,
          fileUploadId: uploaded.id,
          slot,
        });
      } finally {
        setActive(null);
      }
    },
    [clearPoster, portrait, setPoster, wide],
  );

  const progressOf = (slot: "poster" | "wide") => {
    if (active !== slot) return null;
    const items = slot === "wide" ? wide.items : portrait.items;
    return Math.max(1, items.at(-1)?.progress ?? 0);
  };

  return { commit, progressOf, isBusy: active !== null };
}

/** How a poster draft reads in a review. */
export const posterChange = (
  draft: PosterDraft,
  hasCurrent: boolean,
): { before: string; after: string } | null => {
  if (draft.kind === "keep") return null;
  return {
    before: hasCurrent ? "Current image" : "None",
    after: draft.kind === "remove" ? "Removed" : draft.file.name,
  };
};
