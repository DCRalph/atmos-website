"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, ExternalLink, Loader2, Link2, Unlink, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { LinkUserDialog, type LinkUserTarget } from "~/components/admin/link-user-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";

type ClaimFilter = "ALL" | "ACTIVE" | "UNCLAIMED" | "PENDING_CLAIM";

function ClaimBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return <Badge variant="default">Active</Badge>;
  }
  if (status === "UNCLAIMED") {
    return <Badge variant="secondary">Unclaimed</Badge>;
  }
  return <Badge variant="outline">Pending claim</Badge>;
}

export function CreatorProfilesManager() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClaimFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<LinkUserTarget | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<{
    profileId: string;
    handle: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    handle: string;
  } | null>(null);

  const list = api.creatorProfiles.listAll.useQuery({
    search: search || undefined,
    claimStatus: filter === "ALL" ? undefined : filter,
  });

  const deleteProfile = api.creatorProfiles.deleteProfile.useMutation({
    onSuccess: () => {
      setDeleteTarget(null);
      void list.refetch();
    },
  });
  const unlinkUser = api.creatorProfiles.unlinkUser.useMutation({
    onSuccess: () => {
      setUnlinkTarget(null);
      void list.refetch();
    },
  });

  const profiles = list.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Profiles</CardTitle>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create profile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search handle or display name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as ClaimFilter)}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="UNCLAIMED">Unclaimed</SelectItem>
                <SelectItem value="PENDING_CLAIM">Pending claim</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Handle</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Linked user</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Blocks</TableHead>
                  <TableHead>Gigs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      No profiles yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/admin/creator-profiles/${p.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          @{p.handle}
                        </Link>
                      </TableCell>
                      <TableCell>{p.displayName}</TableCell>
                      <TableCell>
                        {p.user ? (
                          <Link
                            href={`/admin/users/${p.user.id}`}
                            className="text-sm hover:underline"
                          >
                            {p.user.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ClaimBadge status={p.claimStatus} />
                      </TableCell>
                      <TableCell>
                        {p.isPublished ? (
                          <Badge variant="outline" className="text-green-600">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>{p._count.blocks}</TableCell>
                      <TableCell>{p._count.gigCreators}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/@${p.handle}`} target="_blank">
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setLinkTarget({
                                profileId: p.id,
                                handle: p.handle,
                                currentUserId: p.user?.id ?? null,
                                currentUserName: p.user?.name ?? null,
                              })
                            }
                            title={p.user ? "Relink to a different user" : "Link to a user"}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          {p.user ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setUnlinkTarget({
                                  profileId: p.id,
                                  handle: p.handle,
                                })
                              }
                              title="Unlink user"
                            >
                              <Unlink className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDeleteTarget({ id: p.id, handle: p.handle })
                            }
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateProfileDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          router.push(`/admin/creator-profiles/${id}`);
        }}
      />

      <LinkUserDialog
        target={linkTarget}
        onClose={() => setLinkTarget(null)}
        onLinked={() => {
          setLinkTarget(null);
          void list.refetch();
        }}
      />

      <AlertDialog
        open={Boolean(unlinkTarget)}
        onOpenChange={(v) => !v && setUnlinkTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink user from @{unlinkTarget?.handle}?</AlertDialogTitle>
            <AlertDialogDescription>
              The profile will become unclaimed again. Blocks and gig
              attributions are kept. The user will lose edit access until the
              profile is relinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                unlinkTarget && unlinkUser.mutate({ profileId: unlinkTarget.profileId })
              }
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete @{deleteTarget?.handle}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the profile, all blocks, socials, and
              gig attributions. The linked user (if any) is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteProfile.mutate({ id: deleteTarget.id })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateProfileDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [pickedUser, setPickedUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const users = api.users.getAll.useQuery(
    userQuery ? { search: userQuery } : undefined,
    { enabled: open && userQuery.length > 0 },
  );

  const create = api.creatorProfiles.createProfile.useMutation({
    onSuccess: (profile) => {
      setHandle("");
      setDisplayName("");
      setTagline("");
      setUserQuery("");
      setPickedUser(null);
      onCreated(profile.id);
    },
  });

  const handleClose = (v: boolean) => {
    if (!v) {
      setUserQuery("");
      setPickedUser(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create creator profile</DialogTitle>
          <DialogDescription>
            Create a new creator profile. Linking a user is optional — if you
            don't link one, the profile stays unclaimed and can be attributed to
            gigs or claimed later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Handle</Label>
            <Input
              placeholder="dj-nova"
              value={handle}
              onChange={(e) =>
                setHandle(e.target.value.toLowerCase().replace(/\s/g, "-"))
              }
            />
            <p className="text-muted-foreground text-xs">
              Lowercase letters, numbers, underscores or hyphens. 3-30 chars.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Display name</Label>
            <Input
              placeholder="DJ Nova"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Tagline (optional)</Label>
            <Input
              placeholder="Tech-house & minimal"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>

          <div className="space-y-1 pt-2">
            <Label>Link user (optional)</Label>
            {pickedUser ? (
              <div className="flex items-center justify-between rounded-md border p-2">
                <div>
                  <div className="text-sm font-medium">{pickedUser.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {pickedUser.email}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPickedUser(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search users by name or email…"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                {userQuery && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {users.isLoading ? (
                      <div className="text-muted-foreground px-3 py-3 text-sm">
                        Searching…
                      </div>
                    ) : (users.data ?? []).length === 0 ? (
                      <div className="text-muted-foreground px-3 py-3 text-sm">
                        No users match.
                      </div>
                    ) : (
                      (users.data ?? []).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setPickedUser({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                            });
                            setUserQuery("");
                          }}
                          className="hover:bg-accent/30 flex w-full items-center justify-between px-3 py-2 text-left"
                        >
                          <div>
                            <div className="text-sm font-medium">{u.name}</div>
                            <div className="text-muted-foreground text-xs">
                              {u.email}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <p className="text-muted-foreground text-xs">
                  Leave empty to create an unclaimed profile.
                </p>
              </>
            )}
          </div>

          {create.error && (
            <p className="text-destructive text-sm">{create.error.message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              create.mutate({
                handle,
                displayName: displayName || handle,
                tagline: tagline || null,
                userId: pickedUser?.id ?? null,
              })
            }
            disabled={create.isPending || !handle || !displayName}
          >
            {create.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
              </>
            ) : (
              "Create & edit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

