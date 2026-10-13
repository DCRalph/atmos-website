"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LayoutGrid,
  Link2,
  Loader2,
  Plus,
  Unlink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import {
  LinkUserDialog,
  type LinkUserTarget,
} from "~/components/admin/link-user-dialog";
import { useConfirm } from "~/components/confirm-provider";
import { findProfileSocial } from "~/lib/crew-display";
import { getPlatform } from "~/lib/social-pills";

type Profile = NonNullable<RouterOutputs["artistProfiles"]["getById"]>;

const CLAIM_LABELS = {
  ACTIVE: "Claimed",
  UNCLAIMED: "Unclaimed",
  PENDING_CLAIM: "Claim pending",
} as const satisfies Record<Profile["claimStatus"], string>;

/** Shows a stored social URL the way it is typed: the bare handle. */
const socialHandle = (
  profile: Profile,
  platformId: "instagram" | "soundcloud",
) => {
  const url = findProfileSocial(profile.socials, platformId);
  return url ? getPlatform(platformId).extractHandle(url) || url : "";
};

/** Invalidates every admin view that shows a profile's core details. */
function useRefreshProfile() {
  const utils = api.useUtils();
  return async (profileId: string) => {
    await Promise.all([
      utils.artistProfiles.getById.invalidate({ id: profileId }),
      utils.artistProfiles.listAll.invalidate(),
      utils.crew.getAll.invalidate(),
    ]);
  };
}

/**
 * The quick editor for what every list shows about an artist: name, handle,
 * photo, Instagram, SoundCloud, linked user and crew role. Blocks, theme and
 * bio stay in the full editor.
 *
 * Opened from the artist profiles list and from crew rows. `onNavigate` adds
 * previous/next (buttons and arrow keys) for stepping through a list.
 */
export function ArtistCoreSheet({
  profileId,
  onClose,
  onNavigate,
}: {
  profileId: string | null;
  onClose: () => void;
  onNavigate?: (direction: -1 | 1) => void;
}) {
  const { data: profile, isLoading } = api.artistProfiles.getById.useQuery(
    { id: profileId ?? "" },
    { enabled: Boolean(profileId) },
  );

  return (
    <Sheet open={Boolean(profileId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
        onKeyDown={(event) => {
          if (!onNavigate) return;
          const target = event.target as HTMLElement;
          if (target.closest("input, textarea, [contenteditable]")) return;
          if (event.key === "ArrowUp") onNavigate(-1);
          if (event.key === "ArrowDown") onNavigate(1);
        }}
      >
        {profile ? (
          <CoreDetails
            // Remounts after every save, so the form restarts from the stored
            // (normalised) values rather than what was typed.
            key={`${profile.id}:${profile.updatedAt.getTime()}`}
            profile={profile}
            onNavigate={onNavigate}
          />
        ) : (
          <SheetHeader>
            <SheetTitle>
              {isLoading ? "Loading…" : "Profile not found"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Artist profile core details
            </SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CoreDetails({
  profile,
  onNavigate,
}: {
  profile: Profile;
  onNavigate?: (direction: -1 | 1) => void;
}) {
  const refresh = useRefreshProfile();
  const confirm = useConfirm();
  const [linkTarget, setLinkTarget] = useState<LinkUserTarget | null>(null);

  const saved = {
    displayName: profile.displayName,
    handle: profile.handle,
    instagram: socialHandle(profile, "instagram"),
    soundcloud: socialHandle(profile, "soundcloud"),
  };
  const [form, setForm] = useState(saved);
  const isDirty = (Object.keys(saved) as (keyof typeof saved)[]).some(
    (key) => form[key].trim() !== saved[key],
  );

  const updateCore = api.artistProfiles.updateCore.useMutation({
    onSuccess: async () => {
      toast.success("Saved");
      await refresh(profile.id);
    },
    onError: (error) => toast.error(error.message),
  });
  const setAvatar = api.artistProfiles.setAvatar.useMutation({
    onSuccess: () => refresh(profile.id),
    onError: (error) => toast.error(error.message),
  });
  const clearAvatar = api.artistProfiles.clearAvatar.useMutation({
    onSuccess: () => refresh(profile.id),
    onError: (error) => toast.error(error.message),
  });
  const unlinkUser = api.artistProfiles.unlinkUser.useMutation({
    onSuccess: async () => {
      toast.success("User unlinked");
      await refresh(profile.id);
    },
    onError: (error) => toast.error(error.message),
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value })),
  });

  return (
    <>
      <SheetHeader className="flex-row items-start gap-2 pr-12">
        <div className="min-w-0 flex-1">
          <SheetTitle className="truncate">{profile.displayName}</SheetTitle>
          <SheetDescription>
            {CLAIM_LABELS[profile.claimStatus]} ·{" "}
            {profile.isPublished ? "Published" : "Draft"}
          </SheetDescription>
        </div>
        {onNavigate ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onNavigate(-1)}
              aria-label="Previous profile"
              title="Previous (↑)"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onNavigate(1)}
              aria-label="Next profile"
              title="Next (↓)"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </SheetHeader>

      <div className="space-y-5 px-4 pb-6">
        <ImageUploadField
          preset="artistAvatar"
          context={{ profileId: profile.id }}
          value={profile.avatarFileId}
          aspect="square"
          label="Photo"
          disabled={setAvatar.isPending || clearAvatar.isPending}
          onChange={(fileId) =>
            fileId
              ? setAvatar.mutate({ profileId: profile.id, fileId })
              : clearAvatar.mutate({ profileId: profile.id })
          }
        />

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateCore.mutate({ profileId: profile.id, ...form });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="core-name">Display name</Label>
            <Input id="core-name" required {...field("displayName")} />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="core-handle">Handle</Label>
              <span className="text-muted-foreground truncate text-xs">
                /@{form.handle || "handle"}
              </span>
            </div>
            <Input
              id="core-handle"
              className="font-mono"
              required
              value={form.handle}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  handle: event.target.value.toLowerCase().replace(/\s/g, "-"),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="core-instagram">Instagram</Label>
            <Input
              id="core-instagram"
              placeholder="handle or link"
              {...field("instagram")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="core-soundcloud">SoundCloud</Label>
            <Input
              id="core-soundcloud"
              placeholder="handle or link"
              {...field("soundcloud")}
            />
          </div>
          <div className="flex justify-end gap-2">
            {isDirty ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setForm(saved)}
                disabled={updateCore.isPending}
              >
                Reset
              </Button>
            ) : null}
            <Button type="submit" disabled={!isDirty || updateCore.isPending}>
              {updateCore.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </form>

        <Separator />

        <div className="space-y-2">
          <Label>Linked user</Label>
          <div className="flex items-center gap-2">
            {profile.user ? (
              <Link
                href={`/admin/users/${profile.user.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <div className="truncate text-sm font-medium">
                  {profile.user.name}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {profile.user.email}
                </div>
              </Link>
            ) : (
              <span className="text-muted-foreground flex-1 text-sm">
                No user linked
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLinkTarget({
                  profileId: profile.id,
                  handle: profile.handle,
                  currentUserId: profile.user?.id ?? null,
                  currentUserName: profile.user?.name ?? null,
                })
              }
            >
              <Link2 className="h-4 w-4" />
              {profile.user ? "Change" : "Link user"}
            </Button>
            {profile.user ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Unlink user"
                title="Unlink user"
                disabled={unlinkUser.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Unlink ${profile.user?.name ?? "user"}?`,
                    description:
                      "The profile becomes unclaimed. Blocks, socials and gig attributions are kept, but they lose edit access.",
                    confirmLabel: "Unlink",
                    variant: "destructive",
                  });
                  if (ok) unlinkUser.mutate({ profileId: profile.id });
                }}
              >
                <Unlink className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <CrewSection profile={profile} />

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/artist-profiles/${profile.id}`}>
              <LayoutGrid className="h-4 w-4" />
              Block editor
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/@${profile.handle}`} target="_blank">
              <ExternalLink className="h-4 w-4" />
              Public page
            </Link>
          </Button>
        </div>
      </div>

      <LinkUserDialog
        target={linkTarget}
        onClose={() => setLinkTarget(null)}
        onLinked={async () => {
          setLinkTarget(null);
          await refresh(profile.id);
        }}
      />
    </>
  );
}

/** The profile's crew rows, with the role editable in place. */
function CrewSection({ profile }: { profile: Profile }) {
  const refresh = useRefreshProfile();
  const confirm = useConfirm();
  const options = {
    onSuccess: () => refresh(profile.id),
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const create = api.crew.create.useMutation(options);
  const update = api.crew.update.useMutation(options);
  const remove = api.crew.delete.useMutation(options);

  return (
    <div className="space-y-2">
      <Label>Crew</Label>
      {profile.crewMembers.map((member) => (
        <div key={member.id} className="flex items-center gap-2">
          <Input
            aria-label="Crew role"
            placeholder={profile.tagline ?? "Role on the crew page"}
            defaultValue={member.role ?? ""}
            onBlur={(event) => {
              const role = event.target.value.trim();
              if (role === (member.role ?? "")) return;
              update.mutate({
                id: member.id,
                details: {
                  source: "profile",
                  artistProfileId: profile.id,
                  role: role || null,
                },
              });
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove from crew"
            title="Remove from crew"
            disabled={remove.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Remove ${profile.displayName} from the crew?`,
                description:
                  "They come off the public crew page. The profile is kept.",
                confirmLabel: "Remove",
                variant: "destructive",
              });
              if (ok) remove.mutate({ id: member.id });
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {profile.crewMembers.length === 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-sm">Not on the crew</span>
          <Button
            variant="outline"
            size="sm"
            disabled={create.isPending}
            onClick={() =>
              create.mutate({
                source: "profile",
                artistProfileId: profile.id,
                role: null,
              })
            }
          >
            <Plus className="h-4 w-4" />
            Add to crew
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Leave the role empty to show the tagline.
        </p>
      )}
    </div>
  );
}
