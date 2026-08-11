"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import {
  SaveStatusPill,
  type SaveStatus,
} from "~/components/admin/save-status";
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

/**
 * The content item admin form, for both creating and editing.
 *
 * Same shape as the gig editor: everything is a local draft committed by one
 * Save, nothing writes on blur, a failed save says so, and leaving with unsaved
 * work asks first. Creating swaps the URL in place afterwards so you carry on
 * editing the item you just made.
 */

type LoadedContentItem = {
  id: string;
  type: string;
  title: string;
  platform: string | null;
  dj: string | null;
  description: string;
  date: Date;
  linkType: ContentLinkType;
  link: string;
  embedUrl: string | null;
  updatedAt: Date | string;
};

const emptyDraft = (): ContentDraft => ({
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

/**
 * A YouTube id out of a pasted watch/share URL. Pasting the whole URL into a
 * field that wants the bare id is the easy mistake to make, and it fails
 * silently — the embed just never renders.
 */
export const extractYouTubeId = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || !/[/.]/.test(trimmed)) return null;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return url.pathname.split("/").find(Boolean) ?? null;
    }
    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) =>
        ["embed", "shorts", "live", "v"].includes(part),
      );
      if (marker >= 0) return parts[marker + 1] ?? null;
    }
    return null;
  } catch {
    return null;
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
  if (!draft.description.trim()) {
    errors.description = "A description is required";
  }
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

  const isNew = itemId === null;
  const isSaving = saveState === "saving";

  const query = api.content.getById.useQuery(
    { id: itemId ?? "" },
    { enabled: itemId !== null },
  );
  const item = (query.data ?? null) as LoadedContentItem | null;
  const facets = api.content.facets.useQuery();

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

  useUnsavedChangesWarning({ enabled: isDirty && !isSaving });

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
    if (!draft.date) return; // Narrowing; `validate` already caught this.

    setSaveState("saving");
    setErrorMessage(null);

    const payload = {
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
  }, [createItem, draft, isSaving, itemId, updateItem, utils]);

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
  const youtubeIdFromUrl =
    draft.linkType === ContentLinkType.YOUTUBE_VIDEO
      ? extractYouTubeId(draft.embedUrl)
      : null;

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
        backLink={{ href: "/admin/content", label: "← Back to content" }}
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
        backLink={{ href: "/admin/content", label: "← Back to content" }}
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
      <div className="mb-4">
        {/* A real link, so the unsaved-changes guard can intercept the click. */}
        <Button variant="outline" asChild>
          <Link href="/admin/content">
            <ArrowLeft className="h-4 w-4" />
            Back to content
          </Link>
        </Button>
      </div>

      {/* The page's one and only Save. */}
      <div className="bg-background/95 sticky top-20 z-20 -mx-2 mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 backdrop-blur">
        <SaveStatusPill status={status} errorMessage={errorMessage} />
        {status === "idle" ? (
          <span className="text-muted-foreground text-sm">
            {isNew
              ? "Fill in the details, then add the item."
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
                {isNew ? "Add content" : "Save"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              What this item is, and who it is by
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <Field
                id="content-type"
                label="Type"
                error={errors.type}
                required
                hint="Free text — reuse an existing value to keep the list tidy."
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
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                id="content-platform"
                label="Platform"
                hint="Optional. Decides the badge colour and icon on the public card."
              >
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
                    <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      &quot;{platformValue}&quot; has no icon or colour on the
                      public card.
                    </span>
                    {platformCasingFix ? (
                      <button
                        type="button"
                        className="text-foreground underline"
                        onClick={() =>
                          update("platform", platformCasingFix.value)
                        }
                      >
                        Use &quot;{platformCasingFix.value}&quot; instead
                      </button>
                    ) : null}
                  </p>
                ) : null}
              </Field>
              <Field id="content-dj" label="DJ" hint="Optional.">
                <Input
                  id="content-dj"
                  value={draft.dj}
                  onChange={(e) => update("dj", e.target.value)}
                  placeholder="DJ name"
                />
              </Field>
            </div>

            <Field
              id="content-description"
              label="Description"
              error={errors.description}
              required
            >
              <Textarea
                id="content-description"
                rows={4}
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                aria-invalid={Boolean(errors.description)}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Link & embed</CardTitle>
            <CardDescription>
              Where the item points, and what plays inline when it is featured
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="content-link-type">Link type</Label>
                <Select
                  value={draft.linkType}
                  onValueChange={(value) =>
                    update("linkType", value as ContentLinkType)
                  }
                >
                  <SelectTrigger id="content-link-type" className="w-full">
                    <SelectValue placeholder="Select link type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ContentLinkType.OTHER}>Other</SelectItem>
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
                <p className="text-muted-foreground text-xs">
                  Decides whether a player can be embedded.
                </p>
              </div>
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
                  onChange={(e) => update("link", e.target.value)}
                  placeholder={
                    isSoundCloud(draft.linkType)
                      ? "SoundCloud track/playlist URL"
                      : draft.linkType === ContentLinkType.YOUTUBE_VIDEO
                        ? "YouTube video URL"
                        : "Content URL"
                  }
                  aria-invalid={Boolean(errors.link)}
                />
              </Field>
            </div>

            {draft.linkType === ContentLinkType.OTHER ? (
              <p className="text-muted-foreground text-sm">
                Link type <span className="font-medium">Other</span> has no
                inline player — the card links straight out. Pick a SoundCloud
                or YouTube type to embed one.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="content-embed">
                    {draft.linkType === ContentLinkType.YOUTUBE_VIDEO
                      ? "YouTube video ID"
                      : "Embed URL"}
                  </Label>
                  {isSoundCloud(draft.linkType) ? (
                    <SoundCloudEmbedParserDialog
                      onApply={(value) => update("embedUrl", value)}
                      disabled={isSaving}
                    />
                  ) : null}
                </div>
                <Input
                  id="content-embed"
                  value={draft.embedUrl}
                  onChange={(e) => update("embedUrl", e.target.value)}
                  placeholder={
                    draft.linkType === ContentLinkType.YOUTUBE_VIDEO
                      ? "e.g. dQw4w9WgXcQ"
                      : "SoundCloud embed URL for the player"
                  }
                  aria-invalid={Boolean(errors.embedUrl)}
                />
                {errors.embedUrl ? (
                  <p className="text-destructive text-xs">{errors.embedUrl}</p>
                ) : youtubeIdFromUrl ? (
                  <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                    <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      This field wants the bare video ID, not a URL — the embed
                      will not render.
                    </span>
                    <button
                      type="button"
                      className="text-foreground underline"
                      onClick={() => update("embedUrl", youtubeIdFromUrl)}
                    >
                      Use &quot;{youtubeIdFromUrl}&quot;
                    </button>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Optional.{" "}
                    {draft.linkType === ContentLinkType.YOUTUBE_VIDEO
                      ? "Without it, no YouTube player is embedded."
                      : "Without it, the link above is used for the player."}{" "}
                    The player only appears on the featured item.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
          className="hover:bg-accent rounded border px-1.5 py-0.5 text-xs disabled:opacity-50"
        >
          {value}
        </button>
      ))}
    </div>
  );
}
