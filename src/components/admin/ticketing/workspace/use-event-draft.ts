"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import type { SaveStatus } from "~/components/admin/save-status";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import {
  dirtySections,
  draftFromEvent,
  emptyDraft,
  errorSection,
  toPayload,
  validate,
  type AdminEvent,
  type EventDraft,
  type FieldErrors,
  type Section,
} from "./draft";

/**
 * The event draft and its one Save, shared by every section of the page.
 *
 * Mirrors the gig editor: edits go into a local draft, `save` sends the whole
 * thing, Cmd/Ctrl+S works anywhere, and leaving with unsaved edits warns.
 * Server state is adopted when it is newer, but never over unsaved edits or
 * mid-save, so a background refetch can't eat what is being typed.
 */
export function useEventDraft(event: AdminEvent | undefined) {
  const router = useRouter();
  const utils = api.useUtils();

  const serverVersion = event
    ? `${event.id}:${event.updatedAt.getTime()}`
    : null;
  const [draft, setDraft] = useState<EventDraft>(() =>
    event ? draftFromEvent(event) : emptyDraft(),
  );
  const [baseline, setBaseline] = useState<EventDraft>(draft);
  const [hydratedVersion, setHydratedVersion] = useState(serverVersion);
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const isSaving = saveState === "saving";
  const dirty = useMemo(
    () => dirtySections(draft, baseline),
    [draft, baseline],
  );
  const isDirty = dirty.length > 0;

  if (event && serverVersion !== hydratedVersion && !isSaving && !isDirty) {
    const next = draftFromEvent(event);
    setHydratedVersion(serverVersion);
    setDraft(next);
    setBaseline(next);
  }

  useUnsavedChangesWarning({ enabled: isDirty && !isSaving });

  // "Saved" is a flash of confirmation, not a resting state.
  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [saveState]);

  const update = useCallback(
    <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      // Editing a field clears its complaint rather than leaving it stale.
      setErrors((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key as keyof FieldErrors];
        return next;
      });
    },
    [],
  );

  const createEvent = api.ticketEvents.create.useMutation();
  const updateEvent = api.ticketEvents.update.useMutation();

  const save = useCallback(async () => {
    if (isSaving) return;

    const found = validate(draft);
    setErrors(found);
    const firstField = (Object.keys(found) as (keyof FieldErrors)[]).find(
      (key) => found[key],
    );
    if (firstField) {
      setSaveState("error");
      setErrorMessage(found[firstField] ?? null);
      toast.error(found[firstField]);
      return errorSection(firstField);
    }
    if (!draft.startsAt) return null; // Narrowing; `validate` already caught this.

    setSaveState("saving");
    setErrorMessage(null);
    const payload = toPayload(draft, draft.startsAt);

    try {
      if (!event) {
        const created = await createEvent.mutateAsync(payload);
        // The draft is now the stored event, so leaving isn't losing anything.
        setBaseline(draft);
        toast.success("Event created");
        void utils.ticketEvents.list.invalidate();
        router.replace(`/admin/events/${created.id}`);
        return null;
      }

      const saved = await updateEvent.mutateAsync({ id: event.id, ...payload });
      // A cap that no longer covers the tiers saves, but never quietly.
      if (saved.capacityWarning) {
        toast.warning(saved.capacityWarning, { duration: 10_000 });
      }
      // New tier rows now have ids. Written into the draft and the baseline
      // by position, so a second save updates them rather than creating
      // duplicates, even if something was typed while this one was in flight.
      const withIds = (tiers: EventDraft["tiers"]) =>
        tiers.map((tier, index) => ({
          ...tier,
          id: tier.id ?? saved.tiers[index]?.id,
        }));
      const savedDraft = { ...draft, tiers: withIds(draft.tiers) };
      setBaseline(savedDraft);
      setDraft((current) =>
        current.tiers.length === draft.tiers.length
          ? { ...current, tiers: withIds(current.tiers) }
          : current,
      );
      await utils.ticketEvents.byId.invalidate({ id: event.id });
      void utils.ticketEvents.list.invalidate();
      setSaveState("saved");
      toast.success("Changes saved");
      return null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong saving";
      setSaveState("error");
      setErrorMessage(message);
      toast.error(message);
      return null;
    }
  }, [createEvent, draft, event, isSaving, router, updateEvent, utils]);

  // Ctrl/Cmd+S, read through a ref so the listener is bound once.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const discard = useCallback(() => {
    setDraft(baseline);
    setErrors({});
    setErrorMessage(null);
    setSaveState("idle");
  }, [baseline]);

  // A fresh edit outranks the lingering "Saved" flash.
  const status: SaveStatus =
    isDirty && (saveState === "idle" || saveState === "saved")
      ? "dirty"
      : saveState;

  return {
    draft,
    setDraft,
    update,
    dirty,
    isDirty,
    isSaving,
    status,
    errorMessage,
    errors,
    /** Saves, and returns the section to open when a field there failed. */
    save: save as () => Promise<Section | null>,
    discard,
  };
}

export type EventDraftState = ReturnType<typeof useEventDraft>;
