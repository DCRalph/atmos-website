"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { useUpload } from "~/hooks/use-upload";
import { useConfirm } from "~/components/confirm-provider";
import UserAvatar from "~/components/UserAvatar";
import { buildMediaUrl } from "~/lib/media-url";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SOCIAL_PLATFORMS, matchSocialPlatform } from "~/lib/social-pills";
import { SectionListEditor } from "./section-list-editor";
import { type ClientBlock, type CreatorBlockTypeName } from "./block-types";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { ThemePicker } from "~/components/creator-themes/theme-picker";
import { ThemeSwatch } from "~/components/creator-themes/theme-swatch";
import { ProfilePreviewFrame } from "~/components/creator-themes/profile-preview-frame";
import { orderBlocks } from "~/lib/creator-sections";

type Props = {
  /** When provided (admin mode), edits this specific profile. */
  profileId?: string;
  mode: "self" | "admin";
};

type Profile = {
  id: string;
  handle: string;
  displayName: string;
  tagline: string | null;
  bio: string | null;
  avatarFileId: string | null;
  bannerFileId: string | null;
  accentColor: string | null;
  themeId: string | null;
  themeRef: {
    id: string;
    name: string;
    isPublic: boolean;
    isSystem: boolean;
    ownerUserId: string | null;
    tokens: unknown;
  } | null;
  isPublished: boolean;
  claimStatus: string;
  userId: string | null;
  blocks: Array<{
    id: string;
    type: CreatorBlockTypeName;
    x: number;
    y: number;
    w: number;
    h: number;
    data: unknown;
  }>;
  socials: Array<{
    id: string;
    platform: string;
    url: string;
    label: string | null;
    sortOrder: number;
  }>;
};

/**
 * The profile builder: identity, the ordered list of sections below the hero,
 * the theme (which carries the layout) and socials, with the public page
 * previewed beside them. Sections autosave; the preview reloads after every
 * save.
 */
export function CreatorProfileEditor({ profileId, mode }: Props) {
  const utils = api.useUtils();
  const confirm = useConfirm();
  const getByIdQ = api.creatorProfiles.getById.useQuery(
    { id: profileId ?? "" },
    { enabled: mode === "admin" && Boolean(profileId) },
  );
  const getMineQ = api.creatorProfiles.getMine.useQuery(undefined, {
    enabled: mode === "self",
  });

  const ensureMine = api.creatorProfiles.ensureMine.useMutation({
    onSuccess: () => {
      void utils.creatorProfiles.getMine.invalidate();
    },
  });

  const profile = (mode === "admin" ? getByIdQ.data : getMineQ.data) as
    Profile | null | undefined;

  const [identity, setIdentity] = useState<Pick<
    Profile,
    | "handle"
    | "displayName"
    | "tagline"
    | "bio"
    | "accentColor"
    | "themeId"
    | "avatarFileId"
    | "bannerFileId"
  > | null>(null);

  const [blocks, setBlocks] = useState<ClientBlock[] | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [socials, setSocials] = useState<Profile["socials"] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // Bumped after anything is saved, to reload the preview.
  const [previewVersion, setPreviewVersion] = useState(0);

  useEffect(() => {
    if (!profile) return;
    if (identity === null) {
      setIdentity({
        handle: profile.handle,
        displayName: profile.displayName,
        tagline: profile.tagline,
        bio: profile.bio,
        accentColor: profile.accentColor,
        themeId: profile.themeId,
        avatarFileId: profile.avatarFileId,
        bannerFileId: profile.bannerFileId,
      });
    }
    if (blocks === null) {
      setBlocks(
        orderBlocks(profile.blocks).map((b) => ({
          id: b.id,
          type: b.type,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          data: (b.data as Record<string, unknown>) ?? {},
        })),
      );
    }
    if (socials === null) setSocials(profile.socials);
  }, [profile, identity, blocks, socials]);

  const updateProfile = api.creatorProfiles.updateProfile.useMutation();
  const saveLayout = api.creatorProfiles.saveLayout.useMutation();
  const setSocialsMut = api.creatorProfiles.setSocials.useMutation();
  const publish = api.creatorProfiles.publish.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const unpublish = api.creatorProfiles.unpublish.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const setAvatar = api.creatorProfiles.setAvatar.useMutation();
  const clearAvatar = api.creatorProfiles.clearAvatar.useMutation();
  const setBanner = api.creatorProfiles.setBanner.useMutation();
  const clearBanner = api.creatorProfiles.clearBanner.useMutation();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [identityOpen, setIdentityOpen] = useState(false);

  async function refetch() {
    if (mode === "admin") {
      await utils.creatorProfiles.getById.invalidate({ id: profileId ?? "" });
    } else {
      await utils.creatorProfiles.getMine.invalidate();
    }
    setPreviewVersion((v) => v + 1);
  }

  const targetProfileId = profile?.id;
  const mutationProfileIdArg = mode === "admin" ? targetProfileId : undefined;

  // Avatar and banner bytes go straight to R2 through the shared upload
  // system; the mutations below only move the profile's FK.
  const avatarUpload = useUpload("creatorAvatar", {
    context: { profileId: mutationProfileIdArg },
    onComplete: async (files) => {
      const file = files[0];
      if (!file) return;
      const res = await setAvatar.mutateAsync({
        profileId: mutationProfileIdArg,
        fileId: file.id,
      });
      setIdentity((prev) =>
        prev ? { ...prev, avatarFileId: res.avatarFileId } : prev,
      );
      await refetch();
    },
    onError: (message) => toast.error(message),
  });

  const bannerUpload = useUpload("creatorBanner", {
    context: { profileId: mutationProfileIdArg },
    onComplete: async (files) => {
      const file = files[0];
      if (!file) return;
      const res = await setBanner.mutateAsync({
        profileId: mutationProfileIdArg,
        fileId: file.id,
      });
      setIdentity((prev) =>
        prev ? { ...prev, bannerFileId: res.bannerFileId } : prev,
      );
      await refetch();
    },
    onError: (message) => toast.error(message),
  });

  const avatarBusy = avatarUpload.isUploading || setAvatar.isPending;
  const bannerBusy = bannerUpload.isUploading || setBanner.isPending;

  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || !targetProfileId || !blocks) return;
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    const save = async () => {
      setSaving(true);
      try {
        await saveLayout.mutateAsync({
          profileId: mutationProfileIdArg,
          blocks: blocks.map((b) => ({
            id: b.isNew ? undefined : b.id,
            type: b.type,
            x: b.x,
            y: b.y,
            w: b.w,
            h: b.h,
            data: b.data,
          })),
        });
        setLastSavedAt(new Date());
        setDirty(false);
        await refetch();
      } finally {
        setSaving(false);
      }
    };
    debouncedSaveRef.current = setTimeout(() => void save(), 800);
    return () => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, blocks, targetProfileId, mutationProfileIdArg]);

  useUnsavedChangesWarning({ enabled: dirty });

  if (mode === "self" && !getMineQ.isLoading && !getMineQ.data) {
    return (
      <CreateProfileCTA
        loading={ensureMine.isPending}
        onCreate={(handle) =>
          ensureMine.mutate({
            handle: handle || undefined,
          })
        }
      />
    );
  }

  if (!profile || !identity || !blocks) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading profile...
      </div>
    );
  }

  function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void avatarUpload.upload([file]);
  }

  async function onRemoveAvatar() {
    const ok = await confirm({
      title: "Remove profile photo?",
      description:
        "This removes the photo from the profile. You can upload a new one anytime.",
      confirmLabel: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    await clearAvatar.mutateAsync({ profileId: mutationProfileIdArg });
    setIdentity((prev) => (prev ? { ...prev, avatarFileId: null } : prev));
    await refetch();
  }

  function onBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void bannerUpload.upload([file]);
  }

  async function onRemoveBanner() {
    const ok = await confirm({
      title: "Remove banner image?",
      description:
        "This removes the banner from the profile. You can upload a new one anytime.",
      confirmLabel: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    await clearBanner.mutateAsync({ profileId: mutationProfileIdArg });
    setIdentity((prev) => (prev ? { ...prev, bannerFileId: null } : prev));
    await refetch();
  }

  /** Theme and accent save as soon as they're picked, so the preview follows. */
  async function saveLook(patch: {
    themeId?: string | null;
    accentColor?: string | null;
  }) {
    setIdentity((prev) => (prev ? { ...prev, ...patch } : prev));
    await updateProfile.mutateAsync({
      profileId: mutationProfileIdArg,
      data: patch,
    });
    await refetch();
  }

  async function saveIdentity() {
    if (!identity) return;
    await updateProfile.mutateAsync({
      profileId: mutationProfileIdArg,
      data: {
        handle: identity.handle,
        displayName: identity.displayName,
        tagline: identity.tagline ?? null,
        bio: identity.bio ?? null,
        accentColor: identity.accentColor ?? null,
        themeId: identity.themeId ?? null,
        avatarFileId: identity.avatarFileId ?? null,
        bannerFileId: identity.bannerFileId ?? null,
      },
    });
    await refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-sm">
          {saving ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          ) : dirty ? (
            <span>Unsaved changes</span>
          ) : lastSavedAt ? (
            <span>Saved {lastSavedAt.toLocaleTimeString()}</span>
          ) : (
            <span>All changes saved</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIdentityOpen(true)}
          >
            <UserAvatar
              className="mr-2 h-5 w-5"
              size={12}
              src={
                identity.avatarFileId
                  ? buildMediaUrl(identity.avatarFileId)
                  : null
              }
              name={identity.displayName}
            />
            <span className="mr-1.5 max-w-48 truncate">
              {identity.displayName || identity.handle}
            </span>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/@${profile.handle}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" /> Preview
            </Link>
          </Button>
          {profile.isPublished ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                unpublish.mutate({ profileId: mutationProfileIdArg })
              }
              disabled={unpublish.isPending}
            >
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                publish.mutate({ profileId: mutationProfileIdArg })
              }
              disabled={publish.isPending}
            >
              Publish
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[440px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sections</CardTitle>
              <p className="text-muted-foreground text-sm">
                Everything below your name and photo, top to bottom.
              </p>
            </CardHeader>
            <CardContent>
              <SectionListEditor
                blocks={blocks}
                socialsCount={(socials ?? []).length}
                selectedId={selectedBlockId}
                onSelect={setSelectedBlockId}
                onChange={(next) => {
                  setBlocks(next);
                  setDirty(true);
                }}
                profileId={mutationProfileIdArg}
              />
            </CardContent>
          </Card>

          <ThemeCard
            mode={mode}
            profile={profile}
            themeId={identity.themeId}
            accentColor={identity.accentColor}
            saving={updateProfile.isPending}
            onSave={saveLook}
          />

          <SocialsCard
            socials={socials ?? []}
            onChange={(next) => setSocials(next)}
            onSave={async () => {
              await setSocialsMut.mutateAsync({
                profileId: mutationProfileIdArg,
                socials: (socials ?? []).map((s, idx) => ({
                  platform: s.platform,
                  url: normalizeSocialUrl(s.platform, s.url),
                  label: s.label,
                  sortOrder: idx,
                })),
              });
              await refetch();
            }}
            saving={setSocialsMut.isPending}
          />
        </div>

        <div className="xl:sticky xl:top-4">
          <ProfilePreviewFrame
            src={`/creator/${profile.handle}`}
            reloadKey={previewVersion}
            label={
              profile.isPublished
                ? `Your page at /@${profile.handle}`
                : `Your page at /@${profile.handle} (draft: only you and admins can see it)`
            }
          />
        </div>
      </div>

      <Dialog open={identityOpen} onOpenChange={setIdentityOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit identity</DialogTitle>
            <DialogDescription>
              Your display name, handle, bio, profile photo and banner image.
              Changes save when you hit the button below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Profile photo</Label>
              <input
                ref={avatarInputRef}
                type="file"
                accept={avatarUpload.accept}
                className="sr-only"
                onChange={onAvatarFileChange}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarBusy || clearAvatar.isPending}
                  className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full disabled:opacity-60"
                  aria-label={
                    identity.avatarFileId
                      ? "Replace profile photo"
                      : "Upload profile photo"
                  }
                >
                  <UserAvatar
                    className="ring-border h-20 w-20 ring-2"
                    size={32}
                    src={
                      identity.avatarFileId
                        ? buildMediaUrl(identity.avatarFileId)
                        : null
                    }
                    name={identity.displayName}
                  />
                  <div className="bg-background/70 absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {avatarBusy ? (
                      <Loader2 className="text-foreground h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="text-foreground h-5 w-5" />
                    )}
                  </div>
                </button>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={avatarBusy || clearAvatar.isPending}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {avatarBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      <span className="ml-1.5">
                        {identity.avatarFileId ? "Replace" : "Upload"}
                      </span>
                    </Button>
                    {identity.avatarFileId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={avatarBusy || clearAvatar.isPending}
                        onClick={() => void onRemoveAvatar()}
                      >
                        {clearAvatar.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="ml-1.5">Remove</span>
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-tight">
                    JPG, PNG, WebP or GIF. Auto-resized.
                  </p>
                </div>
              </div>
              {clearAvatar.error ? (
                <p className="text-destructive text-xs">
                  {clearAvatar.error.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Banner image</Label>
              <input
                ref={bannerInputRef}
                type="file"
                accept={bannerUpload.accept}
                className="sr-only"
                onChange={onBannerFileChange}
              />
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={bannerBusy || clearBanner.isPending}
                  className="group bg-muted relative aspect-video w-40 shrink-0 overflow-hidden rounded-md border disabled:opacity-60"
                  aria-label={
                    identity.bannerFileId
                      ? "Replace banner image"
                      : "Upload banner image"
                  }
                >
                  {identity.bannerFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buildMediaUrl(identity.bannerFileId)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground grid h-full w-full place-items-center">
                      <ImagePlus className="h-5 w-5" />
                    </div>
                  )}
                  <div className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {bannerBusy ? (
                      <Loader2 className="text-foreground h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="text-foreground h-5 w-5" />
                    )}
                  </div>
                </button>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={bannerBusy || clearBanner.isPending}
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      {bannerBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      <span className="ml-1.5">
                        {identity.bannerFileId ? "Replace" : "Upload"}
                      </span>
                    </Button>
                    {identity.bannerFileId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={bannerBusy || clearBanner.isPending}
                        onClick={() => void onRemoveBanner()}
                      >
                        {clearBanner.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="ml-1.5">Remove</span>
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-tight">
                    Shown across the top of your public page. Wide images (about
                    3:1) work best. JPG, PNG, WebP or GIF.
                  </p>
                </div>
              </div>
              {clearBanner.error ? (
                <p className="text-destructive text-xs">
                  {clearBanner.error.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Handle</Label>
                <Input
                  value={identity.handle}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      handle: e.target.value.toLowerCase(),
                    })
                  }
                />
                <p className="text-muted-foreground text-xs">
                  URL: <span className="font-mono">/@{identity.handle}</span>
                </p>
              </div>
              <div className="space-y-1">
                <Label>Display name</Label>
                <Input
                  value={identity.displayName}
                  onChange={(e) =>
                    setIdentity({ ...identity, displayName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tagline</Label>
              <Input
                value={identity.tagline ?? ""}
                onChange={(e) =>
                  setIdentity({ ...identity, tagline: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Bio</Label>
              <Textarea
                rows={4}
                value={identity.bio ?? ""}
                onChange={(e) =>
                  setIdentity({ ...identity, bio: e.target.value })
                }
              />
            </div>
            {updateProfile.error && (
              <p className="text-destructive text-xs">
                {updateProfile.error.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIdentityOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await saveIdentity();
                setIdentityOpen(false);
              }}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save identity"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Normalize a social's URL against its platform. For known platforms this
 * runs through `normalizeInput`, which accepts either a handle or a URL and
 * always returns a canonical full URL (e.g. `atmos` → `https://instagram.com/atmos`).
 * For unknown platforms the URL is returned unchanged.
 */
export function normalizeSocialUrl(platform: string, url: string): string {
  const trimmed = url.trim();
  const known = matchSocialPlatform(platform);
  if (!known) return trimmed;
  const normalized = known.normalizeInput(trimmed);
  return normalized ?? trimmed;
}

/**
 * The profile's theme (layout, colours and type) and its optional accent
 * override. Both save as soon as they're picked.
 */
function ThemeCard({
  mode,
  profile,
  themeId,
  accentColor,
  saving,
  onSave,
}: {
  mode: "self" | "admin";
  profile: Profile;
  themeId: string | null;
  accentColor: string | null;
  saving: boolean;
  onSave: (patch: {
    themeId?: string | null;
    accentColor?: string | null;
  }) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const [accent, setAccent] = useState(accentColor ?? "");
  const theme = profile.themeRef;
  const owned = theme !== null && theme.ownerUserId === profile.userId;
  const editHref = theme
    ? mode === "admin"
      ? `/admin/creator-themes/${theme.id}`
      : `/dashboard/themes/${theme.id}`
    : null;
  const accentValid = /^#[0-9a-fA-F]{6}$/.test(accent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <p className="text-muted-foreground text-sm">
          Your layout, colours and type. Pick a starter, or make your own and
          change everything.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {theme ? (
          <div className="flex items-center gap-3">
            <ThemeSwatch tokens={theme.tokens} className="w-32 shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{theme.name}</div>
              <div className="text-muted-foreground text-xs">
                {theme.isSystem
                  ? "Starter theme"
                  : theme.isPublic
                    ? "Public theme"
                    : "Private theme"}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No theme picked, so your page uses the Atmos look.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPicking((p) => !p)}
            aria-expanded={picking}
          >
            {picking ? "Done" : "Change theme"}
          </Button>
          {owned && editHref ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={editHref}>Customise this theme</Link>
            </Button>
          ) : mode === "self" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/themes/new">Make your own</Link>
            </Button>
          ) : null}
          {saving ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin self-center" />
          ) : null}
        </div>
        {picking ? (
          <div className="rounded-md border p-2">
            <ThemePicker
              selectedThemeId={themeId}
              onSelect={(id) => void onSave({ themeId: id })}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="accent-override">Accent override (optional)</Label>
          <p className="text-muted-foreground text-xs">
            Your own accent on top of the theme&apos;s. Leave it empty to use
            the theme&apos;s.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Accent override picker"
              value={accentValid ? accent : "#c6ff33"}
              onChange={(e) => setAccent(e.target.value)}
              className="h-9 w-12 shrink-0 cursor-pointer rounded border"
            />
            <Input
              id="accent-override"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#c6ff33"
              aria-invalid={accent !== "" && !accentValid}
              className="font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={
                saving ||
                (accent !== "" && !accentValid) ||
                (accent || null) === accentColor
              }
              onClick={() => void onSave({ accentColor: accent || null })}
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CUSTOM_PLATFORM_VALUE = "__custom__";

function SocialsCard({
  socials,
  onChange,
  onSave,
  saving,
}: {
  socials: Profile["socials"];
  onChange: (next: Profile["socials"]) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Socials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {socials.map((s, i) => (
          <SocialRow
            key={s.id ?? i}
            social={s}
            onChange={(next) => {
              const copy = [...socials];
              copy[i] = next;
              onChange(copy);
            }}
            onRemove={() => {
              const copy = [...socials];
              copy.splice(i, 1);
              onChange(copy);
            }}
          />
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...socials,
              {
                id: `tmp_${Math.random().toString(36).slice(2, 8)}`,
                platform: "",
                url: "",
                label: null,
                sortOrder: socials.length,
              },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add social
        </Button>
        <Button
          className="w-full"
          onClick={() => void onSave()}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            "Save socials"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function SocialRow({
  social,
  onChange,
  onRemove,
}: {
  social: Profile["socials"][number];
  onChange: (next: Profile["socials"][number]) => void;
  onRemove: () => void;
}) {
  const knownPlatform = matchSocialPlatform(social.platform);
  const platformValue = knownPlatform
    ? knownPlatform.id
    : CUSTOM_PLATFORM_VALUE;
  const [urlError, setUrlError] = useState<string | null>(null);

  const handlePlatformChange = (value: string) => {
    if (value === CUSTOM_PLATFORM_VALUE) {
      onChange({ ...social, platform: "" });
      setUrlError(null);
      return;
    }
    const next = SOCIAL_PLATFORMS.find((p) => p.id === value);
    if (!next) return;
    const trimmed = social.url.trim();
    const normalized = trimmed ? next.normalizeInput(trimmed) : null;
    onChange({
      ...social,
      platform: next.id,
      url: normalized ?? trimmed,
    });
    setUrlError(null);
  };

  const handleUrlBlur = (raw: string) => {
    const trimmed = raw.trim();
    if (!knownPlatform) {
      setUrlError(null);
      onChange({ ...social, url: trimmed });
      return;
    }
    if (!trimmed) {
      setUrlError(null);
      onChange({ ...social, url: "" });
      return;
    }
    const normalized = knownPlatform.normalizeInput(trimmed);
    if (normalized) {
      setUrlError(null);
      onChange({ ...social, url: normalized });
    } else {
      setUrlError(
        knownPlatform.supportsHandleInput
          ? `Enter a ${knownPlatform.name} handle or a valid ${knownPlatform.hosts[0]} URL.`
          : `Enter a valid ${knownPlatform.name} URL.`,
      );
      onChange({ ...social, url: trimmed });
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-2">
      <Select value={platformValue} onValueChange={handlePlatformChange}>
        <SelectTrigger>
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          {SOCIAL_PLATFORMS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_PLATFORM_VALUE}>Other (custom)</SelectItem>
        </SelectContent>
      </Select>
      {platformValue === CUSTOM_PLATFORM_VALUE && (
        <Input
          placeholder="Custom platform name (e.g. bluesky)"
          value={social.platform}
          onChange={(e) => onChange({ ...social, platform: e.target.value })}
        />
      )}
      <div className="space-y-1">
        <Input
          placeholder={knownPlatform?.inputPlaceholder ?? "https://..."}
          value={social.url}
          onChange={(e) => onChange({ ...social, url: e.target.value })}
          onBlur={(e) => handleUrlBlur(e.target.value)}
          aria-invalid={urlError ? true : undefined}
        />
        {urlError ? (
          <p className="text-destructive text-xs">{urlError}</p>
        ) : knownPlatform?.inputHelp ? (
          <p className="text-muted-foreground text-xs">
            {knownPlatform.inputHelp}
          </p>
        ) : null}
      </div>
      <Input
        placeholder="Label (optional)"
        value={social.label ?? ""}
        onChange={(e) => onChange({ ...social, label: e.target.value || null })}
      />
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="mr-1 h-4 w-4" /> Remove
      </Button>
    </div>
  );
}

function CreateProfileCTA({
  loading,
  onCreate,
}: {
  loading: boolean;
  onCreate: (handle: string) => void;
}) {
  const [handle, setHandle] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your creator profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Pick a handle for your profile URL. You can change this later.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">/@</span>
          <Input
            value={handle}
            onChange={(e) =>
              setHandle(e.target.value.toLowerCase().replace(/\s/g, "-"))
            }
            placeholder="your-handle"
          />
        </div>
        <Button onClick={() => onCreate(handle)} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
            </>
          ) : (
            "Create profile"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
