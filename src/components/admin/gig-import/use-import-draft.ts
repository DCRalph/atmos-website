"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { SerializedEditorState } from "lexical";

import { api } from "~/trpc/react";
import { GigMode } from "~Prisma/browser";

/**
 * The draft the wizard is editing.
 *
 * Deliberately not a second way to save a gig: the fields are held locally
 * while they are being reviewed and then committed through `gigs.saveAll`, the
 * same mutation the gig editor uses. The run sheet and the recipients ride
 * along untouched, because the wizard has no controls for them and dropping
 * them from the payload would delete them.
 */

export type ImportDraft = {
  title: string;
  subtitle: string;
  shortDescription: string;
  mode: GigMode;
  ticketLink: string;
  startTime: Date | undefined;
  endTime: Date | undefined;
  tagIds: string[];
};

export function useImportDraft(gigId: string | null) {
  const utils = api.useUtils();
  const query = api.gigs.getForEditor.useQuery(
    { id: gigId ?? "" },
    { enabled: Boolean(gigId) },
  );
  const gig = query.data ?? null;

  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [baseline, setBaseline] = useState<ImportDraft | null>(null);

  useEffect(() => {
    if (!gig) return;
    const loaded: ImportDraft = {
      title: gig.title,
      subtitle: gig.subtitle,
      shortDescription: gig.shortDescription ?? "",
      mode: gig.mode ?? GigMode.NORMAL,
      ticketLink: gig.ticketLink ?? "",
      startTime: gig.gigStartTime ?? undefined,
      endTime: gig.gigEndTime ?? undefined,
      tagIds: gig.gigTags.map((row) => row.gigTag.id),
    };
    setDraft(loaded);
    setBaseline(loaded);
    // Reloading mid-edit would throw away typing, so this only runs when the
    // gig being edited changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gig?.id]);

  const update = useCallback(
    <K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) =>
      setDraft((current) => (current ? { ...current, [key]: value } : current)),
    [],
  );

  const isDirty = useMemo(
    () =>
      Boolean(draft && baseline) &&
      JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  const saveAll = api.gigs.saveAll.useMutation();

  /** Commits the draft. Returns false when it could not be saved. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!gigId || !gig || !draft) return false;
    if (!draft.title.trim() || !draft.subtitle.trim() || !draft.startTime) {
      toast.error("A gig needs a title, a venue and a start time.");
      return false;
    }

    try {
      await saveAll.mutateAsync({
        id: gigId,
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        shortDescription: draft.shortDescription.trim() || null,
        descriptionLexical:
          (gig.descriptionLexical as SerializedEditorState | null) ?? null,
        mode: draft.mode,
        ticketLink: draft.ticketLink.trim() || null,
        gigStartTime: draft.startTime,
        gigEndTime: draft.endTime ?? null,
        tagIds: draft.tagIds,
        // Passed through as loaded. The wizard does not edit the run sheet, and
        // `saveAll` treats an absent row as a deletion.
        scheduleItems: gig.scheduleItems.map((item) => ({
          id: item.id,
          kind: item.kind,
          creatorProfileIds: item.artists.map(
            (artist) => artist.creatorProfile.id,
          ),
          label: item.label,
          role: item.role,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          notes: item.notes,
          leadMinutes: item.leadMinutes,
          recipientUserIds: item.recipients.map((row) => row.userId),
        })),
        notifyUserIds: gig.notifyRecipients.map((row) => row.userId),
      });
      setBaseline(draft);
      await utils.gigs.getForEditor.invalidate({ id: gigId });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the draft",
      );
      return false;
    }
  }, [draft, gig, gigId, saveAll, utils]);

  return {
    gig,
    draft,
    setDraft,
    update,
    isDirty,
    isLoading: query.isLoading,
    isSaving: saveAll.isPending,
    save,
  };
}
