"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import { AdminSection } from "~/components/admin/admin-section";
import { SaveBar, type SaveStatus } from "~/components/admin/save-status";
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
import { DatePicker } from "~/components/ui/date-picker";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import {
  KNOWN_PLATFORMS,
  findPlatform,
  platformCasingMatch,
} from "~/lib/content-platforms";
import { ContentLinkType } from "~Prisma/browser";
import { SoundCloudEmbedParserDialog } from "./soundcloud-embed-dialog";
import type { ContentDraft } from "./types";
import { getYouTubeId, youtubeThumbnail } from "~/lib/youtube";

/**
 * The content item admin form, for both creating and editing.
 *
 * Same shape as the gig editor: everything is a local draft committed by one
 * Save, nothing writes on blur, a failed save says so, and leaving with unsaved
 * work asks first. Creating swaps the URL in place afterwards so you carry on
 * editing the item you just made.
 */

type LoadedContentItem = NonNullable<RouterOutputs["content"]["getById"]>;

const emptyDraft = (): ContentDraft => ({
  imageFileUploadId: null,
  type: "",
  title: "",
  platform: "",
  dj: "",
  description: "",
  date: undefined,
  linkType: ContentLinkType.OTHER,
  link: "",
  embedUrl: "",
});

const draftFromItem = (item: LoadedContentItem): ContentDraft => ({
  imageFileUploadId: item.imageFileUploadId,
  type: item.type,
  title: item.title,
  platform: item.platform ?? "",
  dj: item.dj ?? "",
  description: item.description,
  date: new Date(item.date),
  linkType: item.linkType,
  link: item.link,
  embedUrl: item.embedUrl ?? "",
});

const fingerprint = (draft: ContentDraft): string =>
  JSON.stringify({
    imageFileUploadId: draft.imageFileUploadId,
    type: draft.type.trim(),
    title: draft.title.trim(),
    platform: draft.platform.trim(),
    dj: draft.dj.trim(),
    description: draft.description.trim(),
    date: draft.date?.getTime() ?? null,
    linkType: draft.linkType,
    link: draft.link.trim(),
    embedUrl: draft.embedUrl.trim(),
  });

const isSoundCloud = (linkType: ContentLinkType) =>
  linkType === ContentLinkType.SOUNDCLOUD_TRACK ||
  linkType === ContentLinkType.SOUNDCLOUD_PLAYLIST;

const httpUrlProblem = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? null
      : "The link must start with http:// or https://";
  } catch {
    return "That does not look like a valid URL";
  }
};

type FieldErrors = Partial<
  Record<
    "type" | "title" | "description" | "date" | "link" | "embedUrl",
    string
  >
>;

const validate = (draft: ContentDraft): FieldErrors => {
  const errors: FieldErrors = {};
  if (!draft.type.trim()) errors.type = "A type is required";
  if (!draft.title.trim()) errors.title = "A title is required";
  if (!draft.date) errors.date = "A date is required";

  const link = draft.link.trim();
  if (!link) errors.link = "A link is required";
  else {
    const problem = httpUrlProblem(link);
    if (problem) errors.link = problem;
  }

  const embed = draft.embedUrl.trim();
  if (embed && isSoundCloud(draft.linkType)) {
    const problem = httpUrlProblem(embed);
    if (problem) errors.embedUrl = problem;
  }
  return errors;
};

export function ContentEditor({
  itemId: initialItemId,
}: {
  itemId: string | null;
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const [itemId, setItemId] = useState(initialItemId);
  const [draft, setDraft] = useState<ContentDraft>(emptyDraft);
  const [baseline, setBaseline] = useState<ContentDraft>(emptyDraft);
  const [hydratedVersion, setHydratedVersion] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [artworkUploading, setArtworkUploading] = useState(false);

  const isNew = itemId === null;
  const isSaving = saveState === "saving";

  const query = api.content.getById.useQuery(
    { id: itemId ?? "" },
    { enabled: itemId !== null },
  );
  const item = query.data ?? null;
  const facets = api.content.facets.useQuery();
  const youtubeId = getYouTubeId(draft.link);
  const metadata = api.content.youtubeMetadata.useQuery(
    { link: youtubeId ?? "" },
    { enabled: youtubeId !== null, retry: false, staleTime: 60_000 },
  );
  const autoTitle = useRef<string | null>(null);
  useEffect(() => {
    const data = metadata.data;
    if (!data) return;
    const previousAutoTitle = autoTitle.current;
    autoTitle.current = data.title;
    setDraft((current) => {
      if (getYouTubeId(current.link) !== data.videoId) return current;
      if (current.title.trim() && current.title !== previousAutoTitle)
        return current;
      return { ...current, title: data.title };
    });
  }, [metadata.data]);

  const changeLink = (link: string) => {
    setErrors((current) => ({ ...current, link: undefined }));
    setDraft((current) => {
      const videoId = getYouTubeId(link);
      if (videoId)
        return {
          ...current,
          link,
          linkType: ContentLinkType.YOUTUBE_VIDEO,
          embedUrl: videoId,
          platform: "YouTube",
          type: current.type || "VIDEO",
          date: current.date ?? new Date(),
        };
      try {
        const url = new URL(link);
        if (["soundcloud.com", "www.soundcloud.com"].includes(url.hostname)) {
          const playlist = url.pathname.includes("/sets/");
          return {
            ...current,
            link,
            platform: "Soundcloud",
            linkType: playlist
              ? ContentLinkType.SOUNDCLOUD_PLAYLIST
              : ContentLinkType.SOUNDCLOUD_TRACK,
            type: current.type || (playlist ? "PLAYLIST" : "MIX"),
            embedUrl: isSoundCloud(current.linkType) ? current.embedUrl : "",
            date: current.date ?? new Date(),
          };
        }
      } catch {
        /* Keep the draft while a URL is being typed. */
      }
      return {
        ...current,
        link,
        ...(current.linkType === ContentLinkType.YOUTUBE_VIDEO
          ? { linkType: ContentLinkType.OTHER, platform: "", embedUrl: "" }
          : {}),
      };
    });
  };

  const isDirty = useMemo(
    () => fingerprint(draft) !== fingerprint(baseline),
    [draft, baseline],
  );

  // Adopt server state only when it is newer, and never over unsaved edits or
  // mid-save, so a background refetch cannot eat what is being typed.
  const serverVersion = item
    ? `${item.id}:${new Date(item.updatedAt).getTime()}`
    : null;
  if (item && serverVersion !== hydratedVersion && !isSaving && !isDirty) {
    const next = draftFromItem(item);
    setHydratedVersion(serverVersion);
    setDraft(next);
    setBaseline(next);
  }

  useUnsavedChangesWarning({
    enabled: (isDirty || artworkUploading) && !isSaving,
  });

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [saveState]);

  const update = useCallback(
    <K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setErrors((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key as keyof FieldErrors];
        return next;
      });
    },
    [],
  );

  const createItem = api.content.create.useMutation();
  const updateItem = api.content.update.useMutation();
  const deleteItem = api.content.delete.useMutation({
    onSuccess: () => {
      toast.success("Content item deleted");
      router.push("/admin/content");
    },
    onError: (err) => toast.error(err.message || "Failed to delete the item"),
  });

  const save = useCallback(async () => {
    if (isSaving || artworkUploading) return;

    const found = validate(draft);
    setErrors(found);
    const firstError = Object.values(found).find(Boolean);
    if (firstError) {
      setSaveState("error");
      setErrorMessage(firstError);
      toast.error(firstError);
      return;
    }
    if (!draft.date) return; // Narrowing; `validate` already caught this.

    setSaveState("saving");
    setErrorMessage(null);

    const payload = {
      imageFileUploadId: draft.imageFileUploadId,
      type: draft.type.trim(),
      title: draft.title.trim(),
      platform: draft.platform.trim() || null,
      dj: draft.dj.trim() || null,
      description: draft.description.trim(),
      date: draft.date,
      linkType: draft.linkType,
      link: draft.link.trim(),
      embedUrl: draft.embedUrl.trim() || null,
    };

    try {
      let id = itemId;
      const creating = id === null;

      if (id === null) {
        const created = await createItem.mutateAsync(payload);
        id = created.id;
        setItemId(id);
        // Swap the URL without navigating, so the form carries on in edit mode.
        window.history.replaceState(null, "", `/admin/content/${id}`);
      } else {
        await updateItem.mutateAsync({ id, ...payload });
      }

      // The item shows up in the admin table, the reorder picker, the public
      // content page and Home, so refresh the lot rather than guessing.
      await Promise.all([
        utils.content.invalidate(),
        utils.homeContent.getHomeLatest.invalidate(),
      ]);
      // The baseline is what went to the server; the draft keeps anything typed
      // while the save was in flight.
      setBaseline(draft);
      setSaveState("saved");
      toast.success(creating ? "Content item created" : "Changes saved");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong saving";
      setSaveState("error");
      setErrorMessage(message);
      toast.error(message);
    }
  }, [
    artworkUploading,
    createItem,
    draft,
    isSaving,
    itemId,
    updateItem,
    utils,
  ]);

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

  const status: SaveStatus =
    isDirty && (saveState === "idle" || saveState === "saved")
      ? "dirty"
      : saveState;

  const platformValue = draft.platform.trim();
  const platformCasingFix = platformValue
    ? platformCasingMatch(platformValue)
    : null;
  const platformUnknown =
    platformValue.length > 0 && !findPlatform(platformValue);

  const typeSuggestions = (facets.data?.types ?? []).filter(
    (row) => row.value !== draft.type,
  );
  const platformSuggestions = useMemo(() => {
    const known = KNOWN_PLATFORMS.map((entry) => entry.value);
    const used = (facets.data?.platforms ?? [])
      .map((row) => row.value)
      // Existing values that only differ by casing would just re-introduce the
      // bug they represent, so they are not offered.
      .filter((value) => !platformCasingMatch(value));
    return [...new Set([...known, ...used])].filter(
      (value) => value !== platformValue,
    );
  }, [facets.data, platformValue]);

  if (!isNew && query.isLoading) {
    return (
      <AdminSection
        title="Manage content"
        backLink={{ href: "/admin/content", label: "Content" }}
      >
        <div className="text-muted-foreground flex items-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading content item...</span>
        </div>
      </AdminSection>
    );
  }

  if (!isNew && !query.isLoading && !item) {
    return (
      <AdminSection
        title="Content item not found"
        backLink={{ href: "/admin/content", label: "Content" }}
      >
        <p className="text-muted-foreground py-12">
          That content item does not exist, or it has been deleted.
        </p>
      </AdminSection>
    );
  }

  return (
    <AdminSection
      title={isNew ? "Add content" : "Manage content"}
      subtitle={isNew ? undefined : (item?.title ?? undefined)}
      maxWidth="max-w-4xl"
      backLink={{ href: "/admin/content", label: "Content" }}
      actions={
        <div className="flex items-center gap-2">
          {draft.link.trim() && !httpUrlProblem(draft.link.trim()) ? (
            <Button variant="outline" asChild>
              <a href={draft.link.trim()} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open link
              </a>
            </Button>
          ) : null}
          {itemId ? (
            <Button
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              disabled={deleteItem.isPending || isSaving}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      }
    >
      {/* The page's one and only Save. */}
      <SaveBar
        status={status}
        errorMessage={errorMessage}
        message={
          status === "idle"
            ? isNew
              ? "Fill in the details, then add the item."
              : "Everything on this page is up to date."
            : null
        }
        saveLabel={isNew ? "Add content" : "Save"}
        isSaving={isSaving}
        disabled={artworkUploading}
        onSave={() => void save()}
        onDiscard={
          isDirty && !isNew
            ? () => {
                setDraft(baseline);
                setErrors({});
                setErrorMessage(null);
                setSaveState("idle");
              }
            : undefined
        }
      >
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Content link</CardTitle>
              <CardDescription>
                Start with a video, mix or playlist link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                id="content-link"
                label="Link"
                error={errors.link}
                required
              >
                <Input
                  id="content-link"
                  type="url"
                  value={draft.link}
                  onChange={(e) => changeLink(e.target.value)}
                  placeholder="Paste a YouTube, SoundCloud or other link"
                  aria-invalid={Boolean(errors.link)}
                />
              </Field>
              {youtubeId ? (
                <>
                  <p
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                    role="status"
                  >
                    <CheckCircle2 className="text-admin-accent-text size-4 shrink-0" />
                    YouTube detected. Video and thumbnail are ready.
                  </p>
                  <div className="relative aspect-video max-w-lg overflow-hidden rounded-md">
                    <Image
                      src={youtubeThumbnail(youtubeId)}
                      alt="YouTube video thumbnail"
                      fill
                      sizes="(min-width: 640px) 512px, 100vw"
                      className="object-cover"
                    />
                  </div>
                  {metadata.isFetching ? (
                    <p role="status" className="text-muted-foreground text-xs">
                      Loading video details…
                    </p>
                  ) : metadata.isError ? (
                    <p role="status" className="text-muted-foreground text-xs">
                      Couldn&apos;t load the title. Enter it below or{" "}
                      <button
                        type="button"
                        className="text-foreground underline"
                        onClick={() => void metadata.refetch()}
                      >
                        try again
                      </button>
                      .
                    </p>
                  ) : metadata.data ? (
                    <p className="text-muted-foreground text-xs">
                      {metadata.data.author}
                    </p>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Review the title and choose how this item appears.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field
                id="content-title"
                label="Title"
                error={errors.title}
                required
              >
                <Input
                  id="content-title"
                  value={draft.title}
                  onChange={(e) => update("title", e.target.value)}
                  aria-invalid={Boolean(errors.title)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  id="content-type"
                  label="Type"
                  error={errors.type}
                  required
                >
                  <Input
                    id="content-type"
                    value={draft.type}
                    onChange={(e) => update("type", e.target.value)}
                    placeholder="MIX, PLAYLIST, VIDEO"
                    aria-invalid={Boolean(errors.type)}
                  />
                  <Suggestions
                    label="In use"
                    values={typeSuggestions.map((row) => row.value)}
                    onPick={(value) => update("type", value)}
                    disabled={isSaving}
                  />
                </Field>
                <Field
                  id="content-date"
                  label="Date"
                  error={errors.date}
                  required
                  hint="Orders the content list, newest first."
                >
                  <DatePicker
                    date={draft.date}
                    onDateChange={(value) => update("date", value)}
                    placeholder="Select a date"
                  />
                </Field>
              </div>
              <Field id="content-dj" label="Artist / DJ" hint="Optional.">
                <Input
                  id="content-dj"
                  value={draft.dj}
                  onChange={(e) => update("dj", e.target.value)}
                  placeholder="Artist or DJ name"
                />
              </Field>
              <Field
                id="content-description"
                label="Description"
                hint="Optional."
              >
                <Textarea
                  id="content-description"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
          <details className="bg-card text-card-foreground rounded-xl border shadow-sm">
            <summary className="cursor-pointer px-6 py-5 font-semibold">
              Artwork & embed settings
            </summary>
            <div className="space-y-6 border-t p-6">
              <div className="space-y-3">
                <h3 className="font-medium">Artwork</h3>
                <ImageUploadField
                  preset="contentArtwork"
                  value={draft.imageFileUploadId}
                  onChange={(id) => update("imageFileUploadId", id)}
                  onUploadingChange={setArtworkUploading}
                  aspect="square"
                  disabled={isSaving}
                />
                <p className="text-muted-foreground text-xs">
                  {draft.imageFileUploadId
                    ? "Removing artwork keeps the file in your media library."
                    : youtubeId
                      ? "The YouTube thumbnail is used unless you choose custom artwork."
                      : "Choose artwork to show on Home and the content page."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="content-link-type">Link type</Label>
                  <Select
                    value={draft.linkType}
                    onValueChange={(value) => {
                      const parsed = Object.values(ContentLinkType).find(
                        (type) => type === value,
                      );
                      if (parsed) update("linkType", parsed);
                    }}
                  >
                    <SelectTrigger id="content-link-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ContentLinkType.OTHER}>
                        Other
                      </SelectItem>
                      <SelectItem value={ContentLinkType.SOUNDCLOUD_TRACK}>
                        SoundCloud track
                      </SelectItem>
                      <SelectItem value={ContentLinkType.SOUNDCLOUD_PLAYLIST}>
                        SoundCloud playlist
                      </SelectItem>
                      <SelectItem value={ContentLinkType.YOUTUBE_VIDEO}>
                        YouTube video
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field id="content-platform" label="Platform">
                  <Input
                    id="content-platform"
                    value={draft.platform}
                    onChange={(e) => update("platform", e.target.value)}
                    placeholder="Soundcloud, Spotify, YouTube"
                  />
                  <Suggestions
                    label="Known"
                    values={platformSuggestions}
                    onPick={(value) => update("platform", value)}
                    disabled={isSaving}
                  />
                  {platformUnknown ? (
                    <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                      <TriangleAlert className="size-3.5 text-amber-500" />
                      No platform icon is available.
                      {platformCasingFix ? (
                        <button
                          type="button"
                          className="text-foreground underline"
                          onClick={() =>
                            update("platform", platformCasingFix.value)
                          }
                        >
                          Use {platformCasingFix.value}
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                </Field>
              </div>
              {isSoundCloud(draft.linkType) ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="content-embed">SoundCloud embed URL</Label>
                    <SoundCloudEmbedParserDialog
                      onApply={(value) => update("embedUrl", value)}
                      disabled={isSaving}
                    />
                  </div>
                  <Input
                    id="content-embed"
                    value={draft.embedUrl}
                    onChange={(e) => update("embedUrl", e.target.value)}
                    placeholder="Optional. Uses the content link when empty."
                    aria-invalid={Boolean(errors.embedUrl)}
                  />
                  {errors.embedUrl ? (
                    <p className="text-destructive text-xs">
                      {errors.embedUrl}
                    </p>
                  ) : null}
                </div>
              ) : draft.linkType === ContentLinkType.YOUTUBE_VIDEO ? (
                <p className="text-muted-foreground text-sm">
                  {youtubeId
                    ? `Video ID: ${youtubeId}. The player is configured from your link.`
                    : "Paste a valid YouTube link above to configure the player."}
                </p>
              ) : null}
            </div>
          </details>
        </div>
      </SaveBar>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete content item</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &quot;{item?.title}&quot; and removes it
              from any Home placements. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteItem.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemId && deleteItem.mutate({ id: itemId })}
              disabled={deleteItem.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteItem.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete item"
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

/** One-click fills for a free-text field, so values stop drifting apart. */
function Suggestions({
  label,
  values,
  onPick,
  disabled,
}: {
  label: string;
  values: string[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </span>
      {values.map((value) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          onClick={() => onPick(value)}
          className="hover:bg-accent inline-flex min-h-9 items-center rounded border px-2.5 text-xs disabled:opacity-50 lg:min-h-0 lg:px-1.5 lg:py-0.5"
        >
          {value}
        </button>
      ))}
    </div>
  );
}
