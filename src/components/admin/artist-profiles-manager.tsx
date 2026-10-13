"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ExternalLink,
  LayoutGrid,
  Loader2,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { ArtistCoreSheet } from "~/components/admin/artist-core-sheet";
import { ProfileAvatar } from "~/components/admin/profile-avatar";
import { findProfileSocial } from "~/lib/crew-display";
import { buildMediaUrl } from "~/lib/media-url";
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

/** A filled dot when the profile has a link for the platform, hollow when not. */
function SocialDot({ url, label }: { url: string | null; label: string }) {
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="text-green-600 hover:opacity-70"
      title={url}
      aria-label={`${label}: ${url}`}
    >
      ●
    </a>
  ) : (
    <span className="text-muted-foreground" aria-label={`No ${label}`}>
      ○
    </span>
  );
}

export function ArtistProfilesManager() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClaimStatus | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    handle: string;
  } | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();
  const list = api.artistProfiles.listAll.useQuery({
    search: debouncedSearch || undefined,
    claimStatus: filter ?? undefined,
  });
  const pendingClaims = api.artistProfiles.listClaimRequests.useQuery({
    status: "PENDING",
  });
  const pendingClaimCount = pendingClaims.data?.length ?? 0;

  const deleteProfile = api.artistProfiles.deleteProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile deleted");
      setDeleteTarget(null);
      void list.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const profiles = list.data ?? [];
  type ProfileRow = (typeof profiles)[number];

  // Steps through the list in its fetched order. The table's own sort is local
  // to it, so this can disagree with a re-sorted table; good enough for a
  // quick pass over every profile.
  const navigate = (direction: -1 | 1) => {
    const index = profiles.findIndex((profile) => profile.id === openId);
    const next = profiles[index + direction];
    if (next) setOpenId(next.id);
  };

  const columns: DataTableColumn<ProfileRow>[] = [
    {
      id: "avatar",
      header: "",
      hideable: false,
      cell: (profile) => (
        <ProfileAvatar
          src={profile.avatarFileId ? buildMediaUrl(profile.avatarFileId) : null}
          name={profile.displayName}
        />
      ),
    },
    {
      id: "displayName",
      header: "Name",
      sortable: true,
      accessor: (row) => row.displayName,
    },
    {
      id: "handle",
      header: "Handle",
      sortable: true,
      accessor: (profile) => profile.handle,
      cell: (profile) => (
        <span className="text-muted-foreground font-mono">
          @{profile.handle}
        </span>
      ),
    },
    {
      id: "instagram",
      header: "IG",
      align: "center",
      sortable: true,
      accessor: (row) => Boolean(findProfileSocial(row.socials, "instagram")),
      cell: (row) => (
        <SocialDot
          url={findProfileSocial(row.socials, "instagram")}
          label="Instagram"
        />
      ),
    },
    {
      id: "soundcloud",
      header: "SC",
      align: "center",
      sortable: true,
      accessor: (row) => Boolean(findProfileSocial(row.socials, "soundcloud")),
      cell: (row) => (
        <SocialDot
          url={findProfileSocial(row.socials, "soundcloud")}
          label="SoundCloud"
        />
      ),
    },
    {
      id: "user",
      header: "Linked user",
      sortable: true,
      accessor: (profile) => profile.user?.name,
      cell: (profile) =>
        profile.user ? (
          <span className="text-sm">{profile.user.name}</span>
        ) : (
          <span className="text-muted-foreground text-sm">None</span>
        ),
    },
    {
      id: "crew",
      header: "Crew",
      sortable: true,
      accessor: (row) => row.crewMembers.length > 0,
      cell: (row) =>
        row.crewMembers.length ? (
          <span className="text-sm">
            {row.crewMembers.map((m) => m.role ?? "Crew").join(", ")}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">None</span>
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
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Button size="icon" variant="ghost" asChild>
            <Link
              href={`/admin/artist-profiles/${profile.id}`}
              aria-label={`Open the block editor for @${profile.handle}`}
              title="Block editor"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
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
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <Button variant="outline" asChild>
                <Link href="/admin/artist-profiles/claims">
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
            onRowClick={(row) => setOpenId(row.id)}
            rowClassName={(row) => (row.id === openId ? "bg-muted/50" : undefined)}
            storageKey="admin-artist-profiles"
            emptyMessage="No profiles yet."
          />
        </CardContent>
      </Card>

      <ArtistCoreSheet
        profileId={openId}
        onClose={() => setOpenId(null)}
        onNavigate={navigate}
      />

      <CreateProfileDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          router.push(`/admin/artist-profiles/${id}`);
        }}
      />

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

  const create = api.artistProfiles.createProfile.useMutation({
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
          <DialogTitle>Create artist profile</DialogTitle>
          <DialogDescription>
            Create a new artist profile. Linking a user is optional — if you
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
