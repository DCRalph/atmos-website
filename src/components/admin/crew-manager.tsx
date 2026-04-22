"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Info, Link2, Unlink } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { resolveCrewDisplay } from "~/lib/crew-display";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function CrewManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instagram, setInstagram] = useState("");
  const [soundcloud, setSoundcloud] = useState("");
  const [image, setImage] = useState("");
  const [creatorProfileId, setCreatorProfileId] = useState<string | null>(null);
  const [creatorProfileHandle, setCreatorProfileHandle] = useState<string | null>(
    null,
  );
  const [profileQuery, setProfileQuery] = useState("");
  const [search, setSearch] = useState("");

  const {
    data: crewMembers,
    isLoading,
    refetch,
  } = api.crew.getAll.useQuery(search ? { search } : undefined);
  const createMember = api.crew.create.useMutation({
    onSuccess: async () => {
      await refetch();
      setIsOpen(false);
      resetForm();
    },
  });
  const updateMember = api.crew.update.useMutation({
    onSuccess: async () => {
      await refetch();
      setIsOpen(false);
      resetForm();
    },
  });
  const deleteMember = api.crew.delete.useMutation({
    onSuccess: async () => {
      setDeleteTarget(null);
      await refetch();
    },
  });
  const moveMember = api.crew.move.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const linkCreatorProfile = api.crew.linkCreatorProfile.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const profileSearch = api.creatorProfiles.listAll.useQuery(
    profileQuery ? { search: profileQuery } : undefined,
    { enabled: isOpen && profileQuery.length > 0 },
  );

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setRole("");
    setInstagram("");
    setSoundcloud("");
    setImage("");
    setCreatorProfileId(null);
    setCreatorProfileHandle(null);
    setProfileQuery("");
  };

  const handleEdit = (member: NonNullable<typeof crewMembers>[0]) => {
    setEditingId(member.id);
    setName(member.name);
    setRole(member.role ?? "");
    setInstagram(member.instagram ?? "");
    setSoundcloud(member.soundcloud ?? "");
    setImage(member.image ?? "");
    setCreatorProfileId(member.creatorProfile?.id ?? null);
    setCreatorProfileHandle(member.creatorProfile?.handle ?? null);
    setProfileQuery("");
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMember.mutate({
        id: editingId,
        name,
        role: role || null,
        instagram: instagram || null,
        soundcloud: soundcloud || null,
        image: image || null,
        creatorProfileId: creatorProfileId ?? null,
      });
    } else {
      createMember.mutate({
        name,
        role: role || null,
        instagram: instagram || null,
        soundcloud: soundcloud || null,
        image: image || null,
        creatorProfileId: creatorProfileId ?? null,
      });
    }
  };

  const profileOptions = useMemo(() => {
    const results = profileSearch.data ?? [];
    return results.filter((p) => p.id !== creatorProfileId);
  }, [profileSearch.data, creatorProfileId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Crew Members</CardTitle>
            <CardDescription>
              Manage crew members and their information
            </CardDescription>
          </div>
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>Add Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit" : "Add"} Crew Member
                </DialogTitle>
                <DialogDescription>
                  {editingId ? "Update" : "Create"} a new crew member
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {creatorProfileId && (
                  <div className="rounded-md border border-blue-500/40 bg-blue-500/5 p-3 text-xs">
                    <div className="mb-1 flex items-center gap-1.5 font-medium">
                      <Info className="h-3.5 w-3.5" />
                      Linked to{" "}
                      <Link
                        href={`/admin/creator-profiles/${creatorProfileId}`}
                        target="_blank"
                        className="font-mono hover:underline"
                      >
                        @{creatorProfileHandle ?? creatorProfileId}
                      </Link>
                    </div>
                    <p className="text-muted-foreground">
                      Name, role (tagline), Instagram, SoundCloud and image are
                      pulled from the profile when set there. The values below
                      act as fallbacks for any fields the profile doesn&apos;t
                      have.
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="name">Name</Label>
                    {creatorProfileId && (
                      <span className="text-muted-foreground text-xs">
                        Fallback — profile&apos;s display name is used if set
                      </span>
                    )}
                  </div>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="role">Role / tagline</Label>
                    <span className="text-muted-foreground text-xs">
                      {creatorProfileId
                        ? "Fallback — profile's tagline is used if set"
                        : "Optional"}
                    </span>
                  </div>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="instagram">Instagram URL</Label>
                    {creatorProfileId && (
                      <span className="text-muted-foreground text-xs">
                        Fallback — profile&apos;s Instagram social is used if set
                      </span>
                    )}
                  </div>
                  <Input
                    id="instagram"
                    type="url"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="soundcloud">SoundCloud URL</Label>
                    {creatorProfileId && (
                      <span className="text-muted-foreground text-xs">
                        Fallback — profile&apos;s SoundCloud social is used if set
                      </span>
                    )}
                  </div>
                  <Input
                    id="soundcloud"
                    type="url"
                    value={soundcloud}
                    onChange={(e) => setSoundcloud(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="image">Image Path</Label>
                    <span className="text-muted-foreground text-xs">
                      {creatorProfileId
                        ? "Fallback — profile's avatar is used if set"
                        : "Required when no profile is linked"}
                    </span>
                  </div>
                  <Input
                    id="image"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="/crew_pfp/example.jpg"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Creator profile (optional)</Label>
                  {creatorProfileId ? (
                    <div className="flex items-center justify-between rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <Link2 className="text-muted-foreground h-4 w-4" />
                        <Link
                          href={`/admin/creator-profiles/${creatorProfileId}`}
                          className="text-sm font-medium hover:underline"
                          target="_blank"
                        >
                          @{creatorProfileHandle ?? creatorProfileId}
                        </Link>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setCreatorProfileId(null);
                          setCreatorProfileHandle(null);
                        }}
                      >
                        <Unlink className="mr-1.5 h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder="Search profiles by handle or name…"
                        value={profileQuery}
                        onChange={(e) => setProfileQuery(e.target.value)}
                      />
                      {profileQuery && (
                        <div className="max-h-48 overflow-y-auto rounded-md border">
                          {profileSearch.isLoading ? (
                            <div className="text-muted-foreground px-3 py-3 text-sm">
                              Searching…
                            </div>
                          ) : profileOptions.length === 0 ? (
                            <div className="text-muted-foreground px-3 py-3 text-sm">
                              No profiles match.
                            </div>
                          ) : (
                            profileOptions.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setCreatorProfileId(p.id);
                                  setCreatorProfileHandle(p.handle);
                                  setProfileQuery("");
                                }}
                                className="hover:bg-accent/30 flex w-full items-center justify-between px-3 py-2 text-left"
                              >
                                <div>
                                  <div className="text-sm font-medium">
                                    @{p.handle}
                                  </div>
                                  <div className="text-muted-foreground text-xs">
                                    {p.displayName}
                                  </div>
                                </div>
                                {p.user ? (
                                  <span className="text-muted-foreground text-xs">
                                    {p.user.name}
                                  </span>
                                ) : null}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      <p className="text-muted-foreground text-xs">
                        Links this crew card to a creator profile page.
                      </p>
                    </>
                  )}
                </div>
                {(createMember.error ?? updateMember.error) && (
                  <p className="text-destructive text-sm">
                    {createMember.error?.message ??
                      updateMember.error?.message}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={createMember.isPending || updateMember.isPending}
                >
                  {editingId ? "Update" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by name or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        {search ? (
          <p className="text-muted-foreground mb-4 text-sm">
            Clear search to reorder crew members.
          </p>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>SoundCloud</TableHead>
              <TableHead>Creator profile</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`loading-${i}`}>
                    <TableCell colSpan={6}>
                      <div className="bg-muted h-8 w-full animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              : crewMembers?.map((member, index) => {
                  const d = resolveCrewDisplay(member);
                  const linkedBadge = (src: "profile" | "member" | "none") =>
                    src === "profile" ? (
                      <span className="text-muted-foreground ml-1 text-[10px] tracking-wide uppercase">
                        from profile
                      </span>
                    ) : null;
                  return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{d.name}</span>
                        {d.source.name === "profile" &&
                          d.name !== member.name && (
                            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                              crew row: {member.name}
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span>{d.role}</span>
                      {linkedBadge(d.source.role)}
                    </TableCell>
                    <TableCell>
                      {d.instagram ? "Yes" : "No"}
                      {linkedBadge(d.source.instagram)}
                    </TableCell>
                    <TableCell>
                      {d.soundcloud ? "Yes" : "No"}
                      {linkedBadge(d.source.soundcloud)}
                    </TableCell>
                    <TableCell>
                      {member.creatorProfile ? (
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/admin/creator-profiles/${member.creatorProfile.id}`}
                            className="text-primary font-mono text-sm hover:underline"
                          >
                            @{member.creatorProfile.handle}
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              linkCreatorProfile.mutate({
                                id: member.id,
                                creatorProfileId: null,
                              })
                            }
                            disabled={linkCreatorProfile.isPending}
                            aria-label={`Unlink creator profile from ${member.name}`}
                            title="Unlink creator profile"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() =>
                            moveMember.mutate({ id: member.id, direction: "up" })
                          }
                          disabled={
                            Boolean(search) || moveMember.isPending || index === 0
                          }
                          aria-label={`Move ${member.name} up`}
                          title="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() =>
                            moveMember.mutate({
                              id: member.id,
                              direction: "down",
                            })
                          }
                          disabled={
                            Boolean(search) ||
                            moveMember.isPending ||
                            index === (crewMembers?.length ?? 1) - 1
                          }
                          aria-label={`Move ${member.name} down`}
                          title="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(member)}
                          disabled={moveMember.isPending}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({ id: member.id, name: member.name })
                          }
                          disabled={deleteMember.isPending || moveMember.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
            {!isLoading && crewMembers?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  {search ? "No crew members found" : "No crew members yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete crew member?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <span className="text-foreground font-medium">
                  {deleteTarget?.name ?? "this crew member"}
                </span>
                . This action can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMember.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!deleteTarget) return;
                  deleteMember.mutate({ id: deleteTarget.id });
                }}
                disabled={deleteMember.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMember.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
