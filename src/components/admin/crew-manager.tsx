"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Info,
  Link2,
  Loader2,
  Plus,
  Search,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { resolveCrewDisplay } from "~/lib/crew-display";
import { useConfirm } from "~/components/confirm-provider";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Card, CardContent } from "~/components/ui/card";

/**
 * The crew directory.
 *
 * Rows carry a hand-set order that the public page follows, which is why no
 * column here is sortable and the move buttons switch off while a search is
 * narrowing the list: both would move a row relative to neighbours that are not
 * the ones on screen.
 */
export function CrewManager() {
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instagram, setInstagram] = useState("");
  const [soundcloud, setSoundcloud] = useState("");
  const [image, setImage] = useState("");
  const [creatorProfileId, setCreatorProfileId] = useState<string | null>(null);
  const [creatorProfileHandle, setCreatorProfileHandle] = useState<
    string | null
  >(null);
  const [profileQuery, setProfileQuery] = useState("");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search).trim();
  const {
    data: crewMembers,
    isLoading,
    isFetching,
    refetch,
  } = api.crew.getAll.useQuery(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  );

  const onSaved = async (message: string) => {
    toast.success(message);
    await refetch();
    setIsOpen(false);
    resetForm();
  };

  const createMember = api.crew.create.useMutation({
    onSuccess: () => onSaved("Crew member added"),
    onError: (error) => toast.error(error.message),
  });
  const updateMember = api.crew.update.useMutation({
    onSuccess: () => onSaved("Crew member updated"),
    onError: (error) => toast.error(error.message),
  });
  const deleteMember = api.crew.delete.useMutation({
    onSuccess: async () => {
      toast.success("Crew member deleted");
      await refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const moveMember = api.crew.move.useMutation({
    onSuccess: async () => {
      await refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const linkCreatorProfile = api.crew.linkCreatorProfile.useMutation({
    onSuccess: async () => {
      toast.success("Creator profile unlinked");
      await refetch();
    },
    onError: (error) => toast.error(error.message),
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
  const rows = crewMembers ?? [];
  type CrewRow = (typeof rows)[number];
  const linkedBadge = (source: "profile" | "member" | "none") =>
    source === "profile" ? (
      <span className="text-muted-foreground ml-1 text-[10px] tracking-wide uppercase">
        from profile
      </span>
    ) : null;
  const columns: DataTableColumn<CrewRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (member) => {
        const display = resolveCrewDisplay(member);
        return (
          <div className="flex flex-col">
            <span>{display.name}</span>
            {display.source.name === "profile" &&
              display.name !== member.name && (
                <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  crew row: {member.name}
                </span>
              )}
          </div>
        );
      },
    },
    {
      id: "role",
      header: "Role",
      cell: (member) => {
        const display = resolveCrewDisplay(member);
        return (
          <>
            <span>{display.role}</span>
            {linkedBadge(display.source.role)}
          </>
        );
      },
    },
    {
      id: "instagram",
      header: "Instagram",
      cell: (member) => {
        const display = resolveCrewDisplay(member);
        return (
          <>
            {display.instagram ? "Yes" : "No"}
            {linkedBadge(display.source.instagram)}
          </>
        );
      },
    },
    {
      id: "soundcloud",
      header: "SoundCloud",
      cell: (member) => {
        const display = resolveCrewDisplay(member);
        return (
          <>
            {display.soundcloud ? "Yes" : "No"}
            {linkedBadge(display.source.soundcloud)}
          </>
        );
      },
    },
    {
      id: "profile",
      header: "Creator profile",
      cell: (member) =>
        member.creatorProfile ? (
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
        ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (member) => {
        const index = rows.indexOf(member);
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                moveMember.mutate({ id: member.id, direction: "up" })
              }
              disabled={Boolean(search) || moveMember.isPending || index === 0}
              aria-label={`Move ${member.name} up`}
              title="Move up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                moveMember.mutate({ id: member.id, direction: "down" })
              }
              disabled={
                Boolean(search) ||
                moveMember.isPending ||
                index === rows.length - 1
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
              disabled={deleteMember.isPending || moveMember.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${member.name}?`,
                  description:
                    "They come off the public crew page. Any linked creator profile is left alone. This cannot be undone.",
                  confirmLabel: "Delete",
                  variant: "destructive",
                });
                if (ok) deleteMember.mutate({ id: member.id });
              }}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="relative min-w-60 flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              placeholder="Search by name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {isFetching ? (
              <Loader2
                className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin"
                aria-hidden
              />
            ) : null}
          </div>
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4" aria-hidden />
                Add member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit crew member" : "Add crew member"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Changes show on the public crew page straight away."
                    : "New members are added to the end of the crew page; reorder them from the list."}
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
                        Fallback — profile&apos;s Instagram social is used if
                        set
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
                        Fallback — profile&apos;s SoundCloud social is used if
                        set
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
                    <Label htmlFor="image">Image path</Label>
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
                    {createMember.error?.message ?? updateMember.error?.message}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={createMember.isPending || updateMember.isPending}
                >
                  {editingId ? "Save" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {search ? (
          <p className="text-muted-foreground text-sm">
            Clear the search to reorder crew members.
          </p>
        ) : null}

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          storageKey="admin-crew"
          emptyMessage={
            search ? "No crew members found" : "No crew members yet"
          }
        />
      </CardContent>
    </Card>
  );
}
