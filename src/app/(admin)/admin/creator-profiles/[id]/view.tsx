"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Unlink,
  User as UserIcon,
  Users,
} from "lucide-react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import UserAvatar from "~/components/UserAvatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  LinkUserDialog,
  type LinkUserTarget,
} from "~/components/admin/link-user-dialog";
import { CreatorProfileEditor } from "~/components/creator/creator-profile-editor";
import { api } from "~/trpc/react";

export function AdminEditCreatorProfileView({ id }: { id: string }) {
  const utils = api.useUtils();
  const { data: profile, isLoading } = api.creatorProfiles.getById.useQuery({
    id,
  });

  const [manageOpen, setManageOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<LinkUserTarget | null>(null);
  const [unlinkOpen, setUnlinkOpen] = useState(false);

  const unlinkUser = api.creatorProfiles.unlinkUser.useMutation({
    onSuccess: async () => {
      setUnlinkOpen(false);
      setManageOpen(false);
      await utils.creatorProfiles.getById.invalidate({ id });
    },
  });

  const refetchProfile = async () => {
    await utils.creatorProfiles.getById.invalidate({ id });
  };

  return (
    <AdminSection
      title="Edit creator profile"
      subtitle={profile ? `@${profile.handle}` : undefined}
      backLink={{
        href: "/admin/creator-profiles",
        label: "← Back to profiles",
      }}
      maxWidth="max-w-7xl"
      actions={
        profile && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManageOpen(true)}
            >
              <span className="mr-1.5">Linked</span>
              {profile.user ? (
                <>
                  <UserAvatar
                    className="mr-2 h-5 w-5"
                    size={12}
                    src={profile.user.image ?? null}
                    name={profile.user.name}
                  />
                  <span className="mr-1.5 max-w-40 truncate">
                    {profile.user.name}
                  </span>
                </>
              ) : (
                <>
                  <UserIcon className="text-muted-foreground mr-2 h-4 w-4" />
                  <span className="mr-1.5">No user linked</span>
                </>
              )}
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/@${profile.handle}`} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" /> Preview
              </Link>
            </Button>
          </div>
        )
      }
    >
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !profile ? (
        <p className="text-muted-foreground">Profile not found.</p>
      ) : (
        <>
          {profile.crewMembers && profile.crewMembers.length > 0 && (
            <div className="border-border/60 bg-muted/20 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Linked to crew:
              </span>
              {profile.crewMembers.map((m) => (
                <span
                  key={m.id}
                  className="border-border/70 bg-background inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {m.role}
                  </span>
                </span>
              ))}
              <Link
                href="/admin/crew"
                className="text-muted-foreground hover:text-foreground ml-auto text-xs hover:underline"
              >
                Manage crew →
              </Link>
            </div>
          )}

          <CreatorProfileEditor profileId={id} mode="admin" />

          <Dialog open={manageOpen} onOpenChange={setManageOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Linked user</DialogTitle>
                <DialogDescription>
                  Manage which user owns <span className="font-mono">@{profile.handle}</span>.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md border p-3">
                {profile.user ? (
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      className="h-10 w-10 shrink-0"
                      size={18}
                      src={profile.user.image ?? null}
                      name={profile.user.name}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${profile.user.id}`}
                          className="truncate font-medium hover:underline"
                          onClick={() => setManageOpen(false)}
                        >
                          {profile.user.name}
                        </Link>
                        <Badge variant="default" className="shrink-0">
                          Active
                        </Badge>
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {profile.user.email}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">No user linked</span>
                        <Badge variant="secondary" className="shrink-0">
                          Unclaimed
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Link a user so they can edit this profile themselves.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="sm:justify-between">
                {profile.user ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setUnlinkOpen(true)}
                  >
                    <Unlink className="mr-2 h-4 w-4" /> Unlink
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setManageOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setManageOpen(false);
                      setLinkTarget({
                        profileId: profile.id,
                        handle: profile.handle,
                        currentUserId: profile.user?.id ?? null,
                        currentUserName: profile.user?.name ?? null,
                      });
                    }}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {profile.user ? "Change user" : "Link user"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <LinkUserDialog
            target={linkTarget}
            onClose={() => setLinkTarget(null)}
            onLinked={async () => {
              setLinkTarget(null);
              await refetchProfile();
            }}
          />

          <AlertDialog
            open={unlinkOpen}
            onOpenChange={(v) => !v && setUnlinkOpen(false)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Unlink {profile.user?.name ?? "user"} from @{profile.handle}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The profile will become unclaimed. Blocks, socials and gig
                  attributions are kept. The user will lose edit access until
                  the profile is relinked.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    unlinkUser.mutate({ profileId: profile.id })
                  }
                  disabled={unlinkUser.isPending}
                >
                  {unlinkUser.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Unlinking…
                    </>
                  ) : (
                    "Unlink"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </AdminSection>
  );
}
