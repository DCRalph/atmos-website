"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SerializedEditorState } from "lexical";
import {
  ArrowLeft,
  ExternalLink,
  Info,
  Loader2,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { GigMediaManager } from "~/components/admin/gig-media-manager";
import { SaveStatusPill } from "~/components/admin/gig-edit/save-status";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { LexicalRichTextEditor } from "~/components/lexical";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { useUpload } from "~/hooks/use-upload";
import { GigMode } from "~Prisma/browser";
import { LineUpField } from "./line-up-field";
import { PosterField } from "./poster-field";
import { TagsField } from "./tags-field";
import type { ClaimStatus, GigDraft } from "./types";

/**
 * The gig admin form, for both creating and editing.
 *
 * Everything on it — core details, date and time, poster, tags and line-up — is
 * held as a local draft and committed by the single Save button, so there is one
 * answer to "has this been saved?". The only exception is the media gallery,
 * which applies immediately and says so.
 *
 * A new gig uses the same form: the poster file is held in the browser and
 * uploaded the moment the gig exists, and the URL is swapped in place afterwards
 * so creating flows straight into editing.
 */

type MediaRow = {
  id: string;
  type: string;
  url: string | null;
  section: string;
  sortOrder: number;
  fileUpload: {
    id: string;
    url: string;
    name: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
    createdAt: Date | string;
    uploadedBy: { id: string; name: string; email: string } | null;
  } | null;
};

/** The admin-visible shape of `gigs.getById`. */
type LoadedGig = {
  id: string;
  title: string;
  subtitle: string;
  shortDescription: string | null;
  descriptionLexical: unknown;
  mode: GigMode | null;
  ticketLink: string | null;
  gigStartTime: Date | null;
  gigEndTime: Date | null;
  updatedAt: Date | string;
  posterFileUpload: { id: string; name: string } | null;
  media: MediaRow[];
  gigTags: { gigTag: { id: string } }[];
  gigCreators: {
    role: string | null;
    creatorProfile: {
      id: string;
      handle: string;
      displayName: string;
      avatarFileId: string | null;
      claimStatus: ClaimStatus;
      isPublished: boolean;
    };
  }[];
};

const emptyDraft = (): GigDraft => ({
  title: "",
  subtitle: "",
  shortDescription: "",
  descriptionLexical: null,
  mode: GigMode.NORMAL,
  ticketLink: "",
  startTime: undefined,
  endTime: undefined,
  tagIds: [],
  creators: [],
  poster: { kind: "keep" },
});

const draftFromGig = (gig: LoadedGig): GigDraft => ({
  title: gig.title,
  subtitle: gig.subtitle,
  shortDescription: gig.shortDescription ?? "",
  descriptionLexical:
    (gig.descriptionLexical as SerializedEditorState | null) ?? null,
  mode: gig.mode ?? GigMode.NORMAL,
  ticketLink: gig.ticketLink ?? "",
  startTime: gig.gigStartTime ? new Date(gig.gigStartTime) : undefined,
  endTime: gig.gigEndTime ? new Date(gig.gigEndTime) : undefined,
  tagIds: gig.gigTags.map((row) => row.gigTag.id),
  creators: gig.gigCreators.map((row) => ({
    creatorProfileId: row.creatorProfile.id,
    handle: row.creatorProfile.handle,
    displayName: row.creatorProfile.displayName,
    avatarFileId: row.creatorProfile.avatarFileId,
    claimStatus: row.creatorProfile.claimStatus,
    isPublished: row.creatorProfile.isPublished,
    role: row.role ?? "",
  })),
  poster: { kind: "keep" },
});

/** Everything that decides whether the draft differs from what is stored. */
const fingerprint = (draft: GigDraft): string =>
  JSON.stringify({
    title: draft.title.trim(),
    subtitle: draft.subtitle.trim(),
    shortDescription: draft.shortDescription.trim(),
    description: draft.descriptionLexical
      ? JSON.stringify(draft.descriptionLexical)
      : null,
    mode: draft.mode,
    ticketLink: draft.ticketLink.trim(),
    startTime: draft.startTime?.getTime() ?? null,
    endTime: draft.endTime?.getTime() ?? null,
    tagIds: [...draft.tagIds].sort(),
    creators: draft.creators.map((row) => [
      row.creatorProfileId,
      row.role.trim(),
    ]),
    poster:
      draft.poster.kind === "replace"
        ? `replace:${draft.poster.file.name}:${draft.poster.file.size}:${draft.poster.file.lastModified}`
        : draft.poster.kind,
  });

type FieldErrors = Partial<
  Record<"title" | "subtitle" | "startTime" | "endTime" | "ticketLink", string>
>;

const validate = (draft: GigDraft): FieldErrors => {
  const errors: FieldErrors = {};
  if (!draft.title.trim()) errors.title = "A title is required";
  if (!draft.subtitle.trim()) errors.subtitle = "A subtitle is required";
  if (!draft.startTime) errors.startTime = "A start time is required";
  if (draft.startTime && draft.endTime && draft.endTime < draft.startTime) {
    errors.endTime = "The end time cannot be before the start time";
  }
  const link = draft.ticketLink.trim();
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.ticketLink =
          "The ticket link must start with http:// or https://";
      }
    } catch {
      errors.ticketLink = "That does not look like a valid URL";
    }
  }
  return errors;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function GigEditor({ gigId: initialGigId }: { gigId: string | null }) {
  const router = useRouter();
  const utils = api.useUtils();

  const [gigId, setGigId] = useState(initialGigId);
  const [draft, setDraft] = useState<GigDraft>(emptyDraft);
  const [baseline, setBaseline] = useState<GigDraft>(emptyDraft);
  const [hydratedVersion, setHydratedVersion] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [posterProgress, setPosterProgress] = useState<number | null>(null);

  const isNew = gigId === null;
  const isSaving = saveState === "saving";

  const query = api.gigs.getById.useQuery(
    { id: gigId ?? "" },
    { enabled: gigId !== null },
  );
  // `getById` redacts its result for non-admins, which widens the inferred type;
  // this page is admin-only, so the full shape is what actually arrives.
  const gig = (query.data ?? null) as unknown as LoadedGig | null;

  const isDirty = useMemo(
    () => fingerprint(draft) !== fingerprint(baseline),
    [draft, baseline],
  );

  /**
   * Adopt server state when it is genuinely newer, but never on top of unsaved
   * edits or mid-save: a background refetch must not eat what is being typed,
   * and the poster file being held for upload must survive until it lands.
   */
  const serverVersion = gig
    ? `${gig.id}:${new Date(gig.updatedAt).getTime()}`
    : null;
  if (gig && serverVersion !== hydratedVersion && !isSaving && !isDirty) {
    const next = draftFromGig(gig);
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
    <K extends keyof GigDraft>(key: K, value: GigDraft[K]) => {
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

  const createGig = api.gigs.create.useMutation();
  const saveGig = api.gigs.saveAll.useMutation();
  const setPoster = api.gigs.setPosterFromUpload.useMutation();
  const clearPoster = api.gigs.clearPoster.useMutation();
  const deleteGig = api.gigs.delete.useMutation({
    onSuccess: () => {
      toast.success("Gig deleted");
      router.push("/admin/gigs");
    },
    onError: (err) => toast.error(err.message || "Failed to delete the gig"),
  });

  const {
    upload: uploadPoster,
    items: posterItems,
    reset: resetPosterUpload,
  } = useUpload("gigPoster", {
    onError: (message) => toast.error(message),
  });
  const transferProgress = posterItems.at(-1)?.progress ?? 0;

  const save = useCallback(async () => {
    if (isSaving) return;

    const found = validate(draft);
    setErrors(found);
    const firstError = Object.values(found).find(Boolean);
    if (firstError) {
      setSaveState("error");
      setErrorMessage(firstError);
      toast.error(firstError);
      return;
    }
    if (!draft.startTime) return; // Narrowing; `validate` already caught this.

    setSaveState("saving");
    setErrorMessage(null);

    const core = {
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      shortDescription: draft.shortDescription.trim(),
      descriptionLexical: draft.descriptionLexical,
      mode: draft.mode,
      ticketLink: draft.ticketLink.trim() || null,
      gigStartTime: draft.startTime,
      gigEndTime: draft.endTime ?? null,
      tagIds: draft.tagIds,
      creators: draft.creators.map((row) => ({
        creatorProfileId: row.creatorProfileId,
        role: row.role.trim() || null,
      })),
    };

    try {
      let id = gigId;
      const creating = id === null;

      if (id === null) {
        const created = await createGig.mutateAsync({
          ...core,
          ticketLink: core.ticketLink ?? undefined,
          gigEndTime: core.gigEndTime ?? undefined,
        });
        id = created.id;
        setGigId(id);
        // Swap the URL without navigating: the form carries on in edit mode
        // rather than remounting and losing its place.
        window.history.replaceState(null, "", `/admin/gigs/${id}`);
      } else {
        await saveGig.mutateAsync({ id, ...core });
      }

      // The poster goes last: its bytes are keyed under the gig, so it needs the
      // gig to exist, and it is the one step that cannot join the transaction.
      if (draft.poster.kind === "replace") {
        // Clear any previous attempt so the progress bar starts from this one.
        resetPosterUpload();
        setPosterProgress(0);
        const [uploaded] = await uploadPoster([draft.poster.file], {
          context: { gigId: id },
        });
        if (!uploaded) {
          throw new Error(
            "The gig was saved, but the poster did not upload. Try saving again.",
          );
        }
        await setPoster.mutateAsync({ gigId: id, fileUploadId: uploaded.id });
      } else if (draft.poster.kind === "remove") {
        await clearPoster.mutateAsync({ gigId: id, deleteFile: true });
      }

      await utils.gigs.getById.invalidate({ id });
      // The baseline is what actually went to the server. The draft keeps
      // anything typed while the save was in flight, minus the poster file just
      // consumed — unless a different one was picked in the meantime.
      const saved: GigDraft = { ...draft, poster: { kind: "keep" } };
      setBaseline(saved);
      setDraft((current) =>
        current.poster === draft.poster
          ? { ...current, poster: { kind: "keep" } }
          : current,
      );
      setSaveState("saved");
      toast.success(creating ? "Gig created" : "Changes saved");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong saving";
      setSaveState("error");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setPosterProgress(null);
    }
  }, [
    clearPoster,
    createGig,
    draft,
    gigId,
    isSaving,
    resetPosterUpload,
    saveGig,
    setPoster,
    uploadPoster,
    utils,
  ]);

  // Ctrl/Cmd+S, because this is a form people live in. The listener is bound
  // once and reads the latest `save` through a ref, rather than being torn down
  // and rebound on every keystroke.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // A fresh edit outranks the lingering "Saved" flash.
  const status: SaveState =
    isDirty && (saveState === "idle" || saveState === "saved")
      ? "dirty"
      : saveState;

  if (!isNew && query.isLoading) {
    return (
      <AdminSection
        title="Manage gig"
        backLink={{ href: "/admin/gigs", label: "← Back to gigs" }}
      >
        <div className="text-muted-foreground flex items-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading gig...</span>
        </div>
      </AdminSection>
    );
  }

  if (!isNew && !query.isLoading && !gig) {
    return (
      <AdminSection
        title="Gig not found"
        backLink={{ href: "/admin/gigs", label: "← Back to gigs" }}
      >
        <p className="text-muted-foreground py-12">
          That gig does not exist, or it has been deleted.
        </p>
      </AdminSection>
    );
  }

  return (
    <AdminSection
      title={isNew ? "Create gig" : "Manage gig"}
      subtitle={isNew ? undefined : (gig?.title ?? undefined)}
      actions={
        <div className="flex items-center gap-2">
          {gigId ? (
            <Button variant="outline" asChild>
              <a href={`/gigs/${gigId}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                View gig
              </a>
            </Button>
          ) : null}
          {gigId ? (
            <Button
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              disabled={deleteGig.isPending || isSaving}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="mb-4">
        {/* A real link, so the unsaved-changes guard can intercept the click —
            it watches anchors, not programmatic router calls. */}
        <Button variant="outline" asChild>
          <Link href="/admin/gigs">
            <ArrowLeft className="h-4 w-4" />
            Back to gigs
          </Link>
        </Button>
      </div>

      {/* The page's one and only Save, kept in reach of every field. */}
      <div className="bg-background/95 sticky top-16 z-20 -mx-2 mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 backdrop-blur">
        <SaveStatusPill status={status} errorMessage={errorMessage} />
        {status === "idle" ? (
          <span className="text-muted-foreground text-sm">
            {isNew
              ? "Fill in the details, then create the gig."
              : "Everything on this page is up to date."}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {isDirty && !isNew ? (
            <Button
              variant="ghost"
              disabled={isSaving}
              onClick={() => {
                setDraft(baseline);
                setErrors({});
                setErrorMessage(null);
                setSaveState("idle");
              }}
            >
              <Undo2 className="h-4 w-4" />
              Discard changes
            </Button>
          ) : null}
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isNew ? "Create gig" : "Save"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Core details</CardTitle>
              <CardDescription>
                Title, description, mode and ticket link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  id="gig-title"
                  label="Title"
                  error={errors.title}
                  required
                >
                  <Input
                    id="gig-title"
                    value={draft.title}
                    onChange={(e) => update("title", e.target.value)}
                    aria-invalid={Boolean(errors.title)}
                  />
                </Field>
                <Field
                  id="gig-subtitle"
                  label="Subtitle"
                  error={errors.subtitle}
                  required
                >
                  <Input
                    id="gig-subtitle"
                    value={draft.subtitle}
                    onChange={(e) => update("subtitle", e.target.value)}
                    aria-invalid={Boolean(errors.subtitle)}
                  />
                </Field>
              </div>

              <Field
                id="gig-short-description"
                label="Short description"
                hint="Used on cards and listings."
              >
                <Textarea
                  id="gig-short-description"
                  rows={3}
                  placeholder="Short summary for cards..."
                  value={draft.shortDescription}
                  onChange={(e) => update("shortDescription", e.target.value)}
                />
              </Field>

              <div className="flex flex-col gap-2">
                <Label>Description</Label>
                <LexicalRichTextEditor
                  value={draft.descriptionLexical}
                  onChange={(value) => update("descriptionLexical", value)}
                  namespace={`gig-description-${gigId ?? "new"}`}
                  placeholder="Describe the gig, line-up, venue info..."
                  ariaLabel="Description"
                  minHeight="14rem"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="gig-mode">Mode</Label>
                  <Select
                    value={draft.mode}
                    onValueChange={(value) => update("mode", value as GigMode)}
                  >
                    <SelectTrigger id="gig-mode" className="w-full">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GigMode.NORMAL}>Normal</SelectItem>
                      <SelectItem value={GigMode.TO_BE_ANNOUNCED}>
                        To be announced
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    To be announced hides the details and blurs the poster.
                  </p>
                </div>
                <Field
                  id="gig-ticket-link"
                  label="Ticket link"
                  hint="Leave empty if tickets are sold on this site."
                  error={errors.ticketLink}
                >
                  <Input
                    id="gig-ticket-link"
                    type="url"
                    placeholder="https://example.com/tickets"
                    value={draft.ticketLink}
                    onChange={(e) => update("ticketLink", e.target.value)}
                    aria-invalid={Boolean(errors.ticketLink)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <LineUpField
            creators={draft.creators}
            onChange={(creators) => update("creators", creators)}
            disabled={isSaving}
          />

          <PosterField
            gigTitle={draft.title}
            current={
              gig?.posterFileUpload
                ? {
                    fileUploadId: gig.posterFileUpload.id,
                    name: gig.posterFileUpload.name,
                  }
                : null
            }
            draft={draft.poster}
            onChange={(poster) => update("poster", poster)}
            uploadProgress={
              posterProgress === null ? null : Math.max(1, transferProgress)
            }
            disabled={isSaving}
          />
        </div>

        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Date & time</CardTitle>
              <CardDescription>When the gig starts and ends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                id="gig-start"
                label="Start"
                error={errors.startTime}
                required
              >
                <DateTimePicker
                  date={draft.startTime}
                  onDateChange={(value) => update("startTime", value)}
                  placeholder="Select start time"
                  showTime
                />
              </Field>
              <Field id="gig-end" label="End" error={errors.endTime}>
                <DateTimePicker
                  date={draft.endTime}
                  onDateChange={(value) => update("endTime", value)}
                  placeholder="Select end time"
                  showTime
                />
              </Field>
            </CardContent>
          </Card>

          <TagsField
            tagIds={draft.tagIds}
            onChange={(tagIds) => update("tagIds", tagIds)}
            disabled={isSaving}
          />
        </div>

        <div className="xl:col-span-12">
          {gigId && gig ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Media gallery</CardTitle>
                    <CardDescription>
                      Photos and video for the featured and gallery sections.
                      Drag to reorder.
                    </CardDescription>
                  </div>
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                    <Info className="h-3.5 w-3.5" />
                    Applies immediately — not part of Save
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <GigMediaManager
                  gigId={gigId}
                  media={gig.media ?? []}
                  onRefetch={() => void query.refetch()}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>Media gallery</CardTitle>
                <CardDescription>
                  Available as soon as the gig is created — you stay on this
                  page, so you can add photos and video straight afterwards.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete gig</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &quot;{gig?.title}&quot;. Media, tags,
              line-up and poster associations go with it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGig.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => gigId && deleteGig.mutate({ id: gigId })}
              disabled={deleteGig.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGig.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete gig"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminSection>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
