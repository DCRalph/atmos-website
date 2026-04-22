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
import { api } from "~/trpc/react";
import { useConfirm } from "~/components/confirm-provider";
import UserAvatar from "~/components/UserAvatar";
import { buildMediaUrl } from "~/lib/media-url";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import { SOCIAL_PLATFORMS, type SocialPlatform } from "~/lib/social-pills";
import {
  AddBlockPopover,
  CreatorGridEditor,
} from "./creator-grid-editor";
import { BlockInspector } from "./block-inspector";
import {
  type ClientBlock,
  type CreatorBlockTypeName,
} from "./block-types";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";

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
  theme: string | null;
  isPublished: boolean;
  gridCols: number;
  rowHeightPx: number;
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
    | Profile
    | null
    | undefined;

  const [identity, setIdentity] = useState<
    Pick<
      Profile,
      | "handle"
      | "displayName"
      | "tagline"
      | "bio"
      | "accentColor"
      | "theme"
      | "avatarFileId"
      | "bannerFileId"
    > | null
  >(null);

  const [blocks, setBlocks] = useState<ClientBlock[] | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [socials, setSocials] = useState<Profile["socials"] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (identity === null) {
      setIdentity({
        handle: profile.handle,
        displayName: profile.displayName,
        tagline: profile.tagline,
        bio: profile.bio,
        accentColor: profile.accentColor,
        theme: profile.theme,
        avatarFileId: profile.avatarFileId,
        bannerFileId: profile.bannerFileId,
      });
    }
    if (blocks === null) {
      setBlocks(
        profile.blocks.map((b) => ({
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
  const uploadAvatar = api.creatorProfiles.uploadAvatar.useMutation();
  const clearAvatar = api.creatorProfiles.clearAvatar.useMutation();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [identityOpen, setIdentityOpen] = useState(false);

  async function refetch() {
    if (mode === "admin") {
      await utils.creatorProfiles.getById.invalidate({ id: profileId ?? "" });
    } else {
      await utils.creatorProfiles.getMine.invalidate();
    }
  }

  const targetProfileId = profile?.id;
  const mutationProfileIdArg = mode === "admin" ? targetProfileId : undefined;

  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || !targetProfileId || !blocks) return;
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    debouncedSaveRef.current = setTimeout(async () => {
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
    }, 800);
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
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading profile...
      </div>
    );
  }

  const selectedBlock =
    blocks.find((b) => b.id === selectedBlockId) ?? null;

  async function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await uploadAvatar.mutateAsync({
        profileId: mutationProfileIdArg,
        base64,
        name: file.name,
        mimeType: file.type,
      });
      setIdentity((prev) =>
        prev ? { ...prev, avatarFileId: res.avatarFileId } : prev,
      );
      await refetch();
    } catch {
      // Error is available on uploadAvatar.error
    }
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
    setIdentity((prev) =>
      prev ? { ...prev, avatarFileId: null } : prev,
    );
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
        theme: identity.theme ?? null,
        avatarFileId: identity.avatarFileId ?? null,
        bannerFileId: identity.bannerFileId ?? null,
      },
    });
    await refetch();
  }

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: grid editor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Layout</h2>
            <AddBlockPopover
              blocks={blocks}
              cols={profile.gridCols}
              onAdd={(b) => {
                setBlocks([...blocks, b]);
                setSelectedBlockId(b.id);
                setDirty(true);
              }}
            />
          </div>
          <div className="hidden md:block">
            <CreatorGridEditor
              blocks={blocks}
              cols={profile.gridCols}
              rowHeightPx={profile.rowHeightPx}
              accent={identity.accentColor}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onChange={(next) => {
                setBlocks(next);
                setDirty(true);
              }}
            />
          </div>
          <div className="md:hidden rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            Switch to a desktop browser to edit the layout. You can still
            preview the profile on mobile.
          </div>
        </div>

        {/* Right: inspector + socials */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedBlock
                  ? `Block: ${selectedBlock.type}`
                  : "Block settings"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedBlock ? (
                <BlockInspector
                  block={selectedBlock}
                  onChange={(nb) => {
                    setBlocks(
                      blocks.map((b) => (b.id === nb.id ? nb : b)),
                    );
                    setDirty(true);
                  }}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Click a block on the layout to configure it.
                </p>
              )}
            </CardContent>
          </Card>

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
      </div>

      <Dialog open={identityOpen} onOpenChange={setIdentityOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit identity</DialogTitle>
            <DialogDescription>
              Your display name, handle, bio and profile photo. Changes save
              when you hit the button below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Profile photo</Label>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(ev) => void onAvatarFileChange(ev)}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadAvatar.isPending || clearAvatar.isPending}
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
                    {uploadAvatar.isPending ? (
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
                      disabled={
                        uploadAvatar.isPending || clearAvatar.isPending
                      }
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {uploadAvatar.isPending ? (
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
                        disabled={
                          uploadAvatar.isPending || clearAvatar.isPending
                        }
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
              {(uploadAvatar.error ?? clearAvatar.error) && (
                <p className="text-destructive text-xs">
                  {(uploadAvatar.error ?? clearAvatar.error)?.message}
                </p>
              )}
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
            <div className="space-y-1">
              <Label>Accent color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={identity.accentColor ?? "#6366f1"}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      accentColor: e.target.value,
                    })
                  }
                  className="h-9 w-12 rounded border"
                />
                <Input
                  value={identity.accentColor ?? ""}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      accentColor: e.target.value || null,
                    })
                  }
                  placeholder="#6366f1"
                />
              </div>
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
 * Look up a registered `SocialPlatform` for a stored `platform` string
 * (case-insensitive, matches both the id and the display name). Returns
 * `null` for custom/unknown platforms (e.g. Bluesky) so callers can treat
 * them as free-form.
 */
export function matchSocialPlatform(platform: string): SocialPlatform | null {
  const needle = platform.trim().toLowerCase();
  if (!needle) return null;
  return (
    SOCIAL_PLATFORMS.find(
      (p) => p.id === needle || p.name.toLowerCase() === needle,
    ) ?? null
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
        <Button className="w-full" onClick={() => void onSave()} disabled={saving}>
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
  const platformValue = knownPlatform ? knownPlatform.id : CUSTOM_PLATFORM_VALUE;
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
