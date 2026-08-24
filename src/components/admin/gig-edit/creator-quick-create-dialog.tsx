"use client";

import { useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { useUpload } from "~/hooks/use-upload";
import { presetConstraints } from "~/lib/uploads/presets";
import { validateFile } from "~/lib/uploads/validate";
import { cn } from "~/lib/utils";
import type { PickedCreator } from "./types";

const AVATAR_CONSTRAINTS = presetConstraints("creatorAvatar");

/** Same rules as the server's handle schema, applied as you type. */
const slugifyHandle = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

type QuickCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the name from whatever was typed into the search box. */
  initialName: string;
  /** The new profile, ready to drop straight into the line-up. */
  onCreated: (creator: PickedCreator) => void;
};

/**
 * Creates a creator profile without leaving the gig. The common case is one
 * field — a name — with the handle derived server-side so it cannot collide;
 * everything else is behind "More options".
 */
export function CreatorQuickCreateDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: QuickCreateDialogProps) {
  // Held here rather than in the form so the dialog cannot be dismissed out
  // from under a create that is already in flight.
  const [isWorking, setIsWorking] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isWorking) onOpenChange(next);
      }}
    >
      <DialogContent>
        {/* Mounted only while open, so every visit starts from a clean form
            instead of being reset field by field. */}
        {open ? (
          <QuickCreateForm
            initialName={initialName}
            onCreated={onCreated}
            onClose={() => onOpenChange(false)}
            isWorking={isWorking}
            onWorkingChange={setIsWorking}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function QuickCreateForm({
  initialName,
  onCreated,
  onClose,
  isWorking,
  onWorkingChange,
}: {
  initialName: string;
  onCreated: QuickCreateDialogProps["onCreated"];
  onClose: () => void;
  isWorking: boolean;
  onWorkingChange: (working: boolean) => void;
}) {
  const [name, setName] = useState(initialName);
  const [handleInput, setHandleInput] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [tagline, setTagline] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [pickedUser, setPickedUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarRejection, setAvatarRejection] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const debouncedName = useDebouncedValue(name, 300);
  const debouncedHandle = useDebouncedValue(handleInput, 300);

  // Untouched handle: the server suggests a free one, with a local slug shown
  // in the meantime so the field is never blank while you type.
  const suggestion = api.creatorProfiles.suggestHandle.useQuery(
    { name: debouncedName },
    { enabled: !handleTouched && debouncedName.trim().length > 0 },
  );
  const handle = handleTouched
    ? handleInput
    : (suggestion.data?.handle ?? slugifyHandle(name));

  const availability = api.creatorProfiles.handleAvailable.useQuery(
    { handle: debouncedHandle },
    { enabled: handleTouched && debouncedHandle.trim().length > 0 },
  );
  const handleProblem =
    handleTouched && availability.data && !availability.data.available
      ? availability.data.reason
      : null;

  const users = api.users.getAll.useQuery(
    userQuery ? { search: userQuery } : undefined,
    { enabled: showMore && userQuery.length > 0 },
  );

  const createProfile = api.creatorProfiles.createProfile.useMutation();
  const setAvatar = api.creatorProfiles.setAvatar.useMutation();
  const { upload: uploadAvatar } = useUpload("creatorAvatar", {
    onError: (message) => toast.error(message),
  });

  const canSubmit =
    !isWorking &&
    name.trim().length > 0 &&
    handle.length >= 3 &&
    !handleProblem;

  const submit = async () => {
    setError(null);
    onWorkingChange(true);
    try {
      const profile = await createProfile.mutateAsync({
        handle,
        displayName: name.trim(),
        tagline: tagline.trim() || null,
        userId: pickedUser?.id ?? null,
      });

      // The avatar preset keys objects under the profile, so its bytes can only
      // go up once the profile exists.
      let avatarFileId: string | null = null;
      if (avatarFile) {
        const [uploaded] = await uploadAvatar([avatarFile], {
          context: { profileId: profile.id },
        });
        if (uploaded) {
          await setAvatar.mutateAsync({
            profileId: profile.id,
            fileId: uploaded.id,
          });
          avatarFileId = uploaded.id;
        } else {
          toast.error(
            `@${profile.handle} was created, but the photo did not upload`,
          );
        }
      }

      onCreated({
        creatorProfileId: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
        avatarFileId,
        claimStatus: pickedUser ? "ACTIVE" : "UNCLAIMED",
        isPublished: false,
      });
      toast.success(`Created @${profile.handle}`);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create the profile";
      setError(message);
    } finally {
      onWorkingChange(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New creator profile</DialogTitle>
        <DialogDescription>
          Created unclaimed and unpublished, and added to this line-up. It can
          be linked to a user or claimed later.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="space-y-1">
          <Label htmlFor="quick-create-name">Name</Label>
          <Input
            id="quick-create-name"
            autoFocus
            placeholder="DJ Nova"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) {
                e.preventDefault();
                void submit();
              }
            }}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="quick-create-handle">Handle</Label>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
              @
            </span>
            <Input
              id="quick-create-handle"
              value={handle}
              onChange={(e) => {
                setHandleTouched(true);
                setHandleInput(slugifyHandle(e.target.value));
              }}
              className="pl-7"
            />
            {handleTouched && availability.isFetching ? (
              <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
            ) : handleTouched && availability.data?.available ? (
              <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-emerald-500" />
            ) : null}
          </div>
          <p
            className={cn(
              "text-xs",
              handleProblem ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {handleProblem ??
              (handleTouched
                ? "Lowercase letters, numbers, underscores or hyphens. 3-30 characters."
                : "Derived from the name, and checked to be free. Edit it if you like.")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              showMore && "rotate-180",
            )}
          />
          More options
        </button>

        {showMore ? (
          <div className="space-y-3 border-t pt-3">
            <div className="space-y-1">
              <Label htmlFor="quick-create-tagline">Tagline</Label>
              <Input
                id="quick-create-tagline"
                placeholder="Tech-house & minimal"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Profile photo</Label>
              <input
                ref={avatarInputRef}
                type="file"
                accept={AVATAR_CONSTRAINTS.accept.join(",")}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  // Checked here rather than on submit, so a wrong file is
                  // rejected before a profile has been created for it.
                  const reason = validateFile(file, AVATAR_CONSTRAINTS);
                  setAvatarRejection(reason);
                  setAvatarFile(reason ? null : file);
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  {avatarFile ? "Change" : "Choose"}
                </Button>
                {avatarFile ? (
                  <>
                    {/* Upload names run long, so this is the part that gives. */}
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                      {avatarFile.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => setAvatarFile(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Uploaded once the profile is created.
                  </span>
                )}
              </div>
              {avatarRejection ? (
                <p className="text-destructive text-xs">{avatarRejection}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label>Link a user</Label>
              {pickedUser ? (
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <div className="text-sm font-medium">{pickedUser.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {pickedUser.email}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPickedUser(null)}
                    aria-label="Unlink user"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search users by name or email..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                  />
                  {userQuery ? (
                    <div className="max-h-40 overflow-y-auto rounded-md border">
                      {users.isLoading ? (
                        <div className="text-muted-foreground px-3 py-3 text-sm">
                          Searching...
                        </div>
                      ) : (users.data ?? []).length === 0 ? (
                        <div className="text-muted-foreground px-3 py-3 text-sm">
                          No users match.
                        </div>
                      ) : (
                        (users.data ?? []).map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setPickedUser({
                                id: user.id,
                                name: user.name,
                                email: user.email,
                              });
                              setUserQuery("");
                            }}
                            className="hover:bg-accent/30 block w-full px-3 py-2 text-left"
                          >
                            <div className="text-sm font-medium">
                              {user.name}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {user.email}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    Leave empty to create an unclaimed profile.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isWorking}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={!canSubmit}>
          {isWorking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create & add to line-up"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
