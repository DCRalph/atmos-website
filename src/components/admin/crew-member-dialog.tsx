"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import { ProfileAvatar } from "~/components/admin/profile-avatar";
import type { CrewRow } from "~/components/admin/crew-manager";
import { findProfileSocial } from "~/lib/crew-display";
import { buildMediaUrl, mediaFileIdFromUrl } from "~/lib/media-url";
import { useDebouncedValue } from "~/hooks/use-debounced-value";

/** The profile fields this dialog shows; both crew rows and the profile list carry them. */
type PickedProfile = {
  id: string;
  handle: string;
  displayName: string;
  tagline: string | null;
  avatarFileId: string | null;
  socials: Array<{ platform: string; url: string }>;
};

type Mode = "profile" | "manual";

const avatarUrl = (profile: PickedProfile) =>
  profile.avatarFileId ? buildMediaUrl(profile.avatarFileId) : null;

/**
 * Adds or edits one crew member.
 *
 * Profile first: adding opens on a profile search, with "Create profile" and
 * "Enter manually" as the way out. A linked member only sets their crew role
 * here; everything else is the profile's, edited through `onEditProfile`.
 */
export function CrewMemberDialog({
  open,
  member,
  onClose,
  onSaved,
  onEditProfile,
}: {
  open: boolean;
  /** The row being edited, or null to add one. */
  member: CrewRow | null;
  onClose: () => void;
  onSaved: () => void;
  onEditProfile: (profileId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(
    member && !member.artistProfile ? "manual" : "profile",
  );
  const [profile, setProfile] = useState<PickedProfile | null>(
    member?.artistProfile ?? null,
  );
  const [role, setRole] = useState(member?.role ?? "");
  const [manual, setManual] = useState({
    name: member?.name ?? "",
    instagram: member?.instagram ?? "",
    soundcloud: member?.soundcloud ?? "",
    image: member?.image ?? "",
  });

  const options = {
    onSuccess: () => {
      toast.success(member ? "Crew member updated" : "Added to the crew");
      onSaved();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const create = api.crew.create.useMutation(options);
  const update = api.crew.update.useMutation(options);
  const isSaving = create.isPending || update.isPending;

  /** Manual mode starts from whatever the profile had, rather than blank. */
  const switchMode = (next: Mode) => {
    if (next === "manual" && profile && !manual.name) {
      setManual({
        name: profile.displayName,
        instagram: findProfileSocial(profile.socials, "instagram") ?? "",
        soundcloud: findProfileSocial(profile.socials, "soundcloud") ?? "",
        image: avatarUrl(profile) ?? "",
      });
    }
    setMode(next);
  };

  const save = () => {
    const roleValue = role.trim() || null;
    const details =
      mode === "profile" && profile
        ? {
            source: "profile" as const,
            artistProfileId: profile.id,
            role: roleValue,
          }
        : { source: "manual" as const, role: roleValue, ...manual };
    if (member) update.mutate({ id: member.id, details });
    else create.mutate(details);
  };

  const picking = mode === "profile" && !profile;
  const photoFileId = mediaFileIdFromUrl(manual.image);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle>
              {member ? "Edit crew member" : "Add crew member"}
            </DialogTitle>
            {picking ? null : (
              <Tabs
                value={mode}
                onValueChange={(value) => switchMode(value as Mode)}
              >
                <TabsList>
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          <DialogDescription>
            {picking
              ? "Pick their artist profile, or enter details by hand."
              : mode === "profile"
                ? "Name, photo and socials come from the profile."
                : "Everything shown on the crew page is set here."}
          </DialogDescription>
        </DialogHeader>

        {picking ? (
          <ProfilePicker
            onPick={setProfile}
            onManual={(name) => {
              setManual((prev) => ({ ...prev, name: prev.name || name }));
              setMode("manual");
            }}
          />
        ) : (
          <form
            id="crew-member-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            {mode === "profile" && profile ? (
              <div className="flex items-center gap-3 rounded-md border p-3">
                <ProfileAvatar
                  src={avatarUrl(profile)}
                  name={profile.displayName}
                  className="size-11"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {profile.displayName}
                  </div>
                  <div className="text-muted-foreground truncate font-mono text-xs">
                    @{profile.handle}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setProfile(null)}
                >
                  Change
                </Button>
                {member?.artistProfile?.id === profile.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEditProfile(profile.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit profile
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                <ImageUploadField
                  preset="crewPhoto"
                  value={photoFileId}
                  aspect="square"
                  label="Photo"
                  helperText={
                    manual.image && !photoFileId
                      ? `Using ${manual.image}`
                      : undefined
                  }
                  onChange={(fileId) =>
                    setManual((prev) => ({
                      ...prev,
                      image: fileId ? buildMediaUrl(fileId) : "",
                    }))
                  }
                />
                <div className="space-y-2">
                  <Label htmlFor="crew-name">Name</Label>
                  <Input
                    id="crew-name"
                    required
                    value={manual.name}
                    onChange={(event) =>
                      setManual((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="crew-instagram">Instagram</Label>
                    <Input
                      id="crew-instagram"
                      placeholder="handle or link"
                      value={manual.instagram}
                      onChange={(event) =>
                        setManual((prev) => ({
                          ...prev,
                          instagram: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crew-soundcloud">SoundCloud</Label>
                    <Input
                      id="crew-soundcloud"
                      placeholder="handle or link"
                      value={manual.soundcloud}
                      onChange={(event) =>
                        setManual((prev) => ({
                          ...prev,
                          soundcloud: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="crew-role">Role on crew page</Label>
              <Input
                id="crew-role"
                value={role}
                placeholder={
                  mode === "profile" && profile?.tagline
                    ? `${profile.tagline} (tagline)`
                    : "Optional"
                }
                onChange={(event) => setRole(event.target.value)}
              />
            </div>
          </form>
        )}

        {picking ? null : (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="crew-member-form" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {member ? "Save" : "Add to crew"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Searchable list of artist profiles, ending in the two ways out: create a
 * profile from what was typed, or skip profiles and enter details by hand.
 */
function ProfilePicker({
  onPick,
  onManual,
}: {
  onPick: (profile: PickedProfile) => void;
  onManual: (name: string) => void;
}) {
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query).trim();
  const profiles = api.artistProfiles.listAll.useQuery(
    search ? { search } : undefined,
  );
  const createProfile = api.artistProfiles.createProfile.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const createFromQuery = async () => {
    const displayName = query.trim();
    const { handle } = await utils.artistProfiles.suggestHandle.fetch({
      name: displayName,
    });
    const created = await createProfile.mutateAsync({ handle, displayName });
    onPick({ ...created, socials: [] });
  };

  const rowClass =
    "hover:bg-accent/40 flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 disabled:opacity-50";

  return (
    <div className="space-y-2">
      <Input
        autoFocus
        placeholder="Search artist profiles…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="max-h-80 overflow-y-auto rounded-md border">
        {profiles.isLoading ? (
          <div className="text-muted-foreground px-3 py-3 text-sm">
            Searching…
          </div>
        ) : (
          (profiles.data ?? []).map((profile) => {
            const onCrew = profile.crewMembers.length > 0;
            return (
              <button
                key={profile.id}
                type="button"
                disabled={onCrew}
                onClick={() => onPick(profile)}
                className={rowClass}
              >
                <ProfileAvatar
                  src={avatarUrl(profile)}
                  name={profile.displayName}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {profile.displayName}
                  </div>
                  <div className="text-muted-foreground truncate font-mono text-xs">
                    @{profile.handle}
                  </div>
                </div>
                {onCrew ? (
                  <span className="text-muted-foreground text-xs">
                    On the crew
                  </span>
                ) : null}
              </button>
            );
          })
        )}
        {query.trim() ? (
          <button
            type="button"
            className={rowClass}
            disabled={createProfile.isPending}
            onClick={() => void createFromQuery()}
          >
            <span className="text-muted-foreground grid size-8 place-items-center">
              {createProfile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                Create profile &ldquo;{query.trim()}&rdquo;
              </div>
              <div className="text-muted-foreground text-xs">
                Unclaimed and unpublished, linked to this crew row
              </div>
            </div>
          </button>
        ) : null}
        <button
          type="button"
          className={rowClass}
          onClick={() => onManual(query.trim())}
        >
          <span className="text-muted-foreground grid size-8 place-items-center">
            <Pencil className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Enter manually</div>
            <div className="text-muted-foreground text-xs">
              No profile page; name, photo and socials are set here
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
