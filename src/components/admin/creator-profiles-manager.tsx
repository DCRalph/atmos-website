"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ExternalLink,
  Loader2,
  Link2,
  Unlink,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
  LinkUserDialog,
  type LinkUserTarget,
} from "~/components/admin/link-user-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Card, CardContent } from "~/components/ui/card";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
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
import { Label } from "~/components/ui/label";
import { FilterSelect, ListFilters } from "./list-filters";

type ClaimStatus = "ACTIVE" | "UNCLAIMED" | "PENDING_CLAIM";

const CLAIM_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "UNCLAIMED", label: "Unclaimed" },
  { value: "PENDING_CLAIM", label: "Pending claim" },
] as const satisfies readonly { value: ClaimStatus; label: string }[];

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
  const [filter, setFilter] = useState<ClaimStatus | null>(null);
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

  const debouncedSearch = useDebouncedValue(search).trim();
  const list = api.creatorProfiles.listAll.useQuery({
    search: debouncedSearch || undefined,
    claimStatus: filter ?? undefined,
  });
  const pendingClaims = api.creatorProfiles.listClaimRequests.useQuery({
    status: "PENDING",
  });
  const pendingClaimCount = pendingClaims.data?.length ?? 0;

  const deleteProfile = api.creatorProfiles.deleteProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile deleted");
      setDeleteTarget(null);
      void list.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const unlinkUser = api.creatorProfiles.unlinkUser.useMutation({
    onSuccess: () => {
      toast.success("User unlinked");
      setUnlinkTarget(null);
      void list.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const profiles = list.data ?? [];
  type ProfileRow = (typeof profiles)[number];
  const columns: DataTableColumn<ProfileRow>[] = [
    {
      id: "handle",
      header: "Handle",
      sortable: true,
      accessor: (profile) => profile.handle,
      cell: (profile) => (
        <Link
          href={`/admin/creator-profiles/${profile.id}`}
          className="text-primary font-mono hover:underline"
        >
          @{profile.handle}
        </Link>
      ),
    },
    {
      id: "displayName",
      header: "Display name",
      sortable: true,
      accessor: (row) => row.displayName,
    },
    {
      id: "user",
      header: "Linked user",
      sortable: true,
      accessor: (profile) => profile.user?.name,
      cell: (profile) =>
        profile.user ? (
          <Link
            href={`/admin/users/${profile.user.id}`}
            className="text-sm hover:underline"
          >
            {profile.user.name}
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.claimStatus,
      cell: (row) => <ClaimBadge status={row.claimStatus} />,
    },
    {
      id: "published",
      header: "Published",
      sortable: true,
      accessor: (row) => row.isPublished,
      cell: (row) =>
        row.isPublished ? (
          <Badge variant="outline" className="text-green-600">
            Yes
          </Badge>
        ) : (
          <Badge variant="outline">Draft</Badge>
        ),
    },
    {
      id: "blocks",
      header: "Blocks",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row._count.blocks,
    },
    {
      id: "gigs",
      header: "Gigs",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.gigCount,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (profile) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" asChild>
            <Link
              href={`/@${profile.handle}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open @${profile.handle} in a new tab`}
              title="Open public profile"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() =>
              setLinkTarget({
                profileId: profile.id,
                handle: profile.handle,
                currentUserId: profile.user?.id ?? null,
                currentUserName: profile.user?.name ?? null,
              })
            }
            aria-label={
              profile.user
                ? `Relink @${profile.handle} to a different user`
                : `Link @${profile.handle} to a user`
            }
            title={
              profile.user ? "Relink to a different user" : "Link to a user"
            }
          >
            <Link2 className="h-4 w-4" aria-hidden />
          </Button>
          {profile.user && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                setUnlinkTarget({
                  profileId: profile.id,
                  handle: profile.handle,
                })
              }
              aria-label={`Unlink the user from @${profile.handle}`}
              title="Unlink user"
            >
              <Unlink className="h-4 w-4" aria-hidden />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() =>
              setDeleteTarget({ id: profile.id, handle: profile.handle })
            }
            aria-label={`Delete @${profile.handle}`}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                placeholder="Search handle or display name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {list.isFetching ? (
                <Loader2
                  className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin"
                  aria-hidden
                />
              ) : null}
            </div>
            <ListFilters
              activeCount={filter ? 1 : 0}
              onClear={() => setFilter(null)}
            >
              <FilterSelect
                label="Status"
                value={filter}
                onChange={setFilter}
                options={CLAIM_STATUSES}
                anyLabel="All statuses"
              />
            </ListFilters>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/admin/creator-profiles/claims">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Claim requests
                  {pendingClaimCount > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {pendingClaimCount}
                    </Badge>
                  )}
                </Link>
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Create profile
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={profiles}
            getRowId={(row) => row.id}
            isLoading={list.isLoading}
            storageKey="admin-creator-profiles"
            emptyMessage="No profiles yet."
          />
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
            <AlertDialogTitle>
              Unlink user from @{unlinkTarget?.handle}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The profile will become unclaimed again. Blocks and gig
              attributions are kept. The user will lose edit access until the
              profile is relinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinkUser.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={unlinkUser.isPending}
              onClick={() =>
                unlinkTarget &&
                unlinkUser.mutate({ profileId: unlinkTarget.profileId })
              }
            >
              {unlinkUser.isPending ? "Unlinking…" : "Unlink"}
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
            <AlertDialogTitle>Delete @{deleteTarget?.handle}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the profile, all blocks, socials, and gig
              attributions. The linked user (if any) is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProfile.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProfile.isPending}
              onClick={() =>
                deleteTarget && deleteProfile.mutate({ id: deleteTarget.id })
              }
            >
              {deleteProfile.isPending ? "Deleting…" : "Delete"}
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
            don&apos;t link one, the profile stays unclaimed and can be
            attributed to gigs or claimed later.
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
                displayName,
                tagline: tagline || null,
                userId: pickedUser?.id ?? null,
              })
            }
            disabled={create.isPending || !handle || !displayName}
          >
            {create.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />{" "}
                Creating…
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
