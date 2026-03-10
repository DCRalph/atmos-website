"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setRole("");
    setInstagram("");
    setSoundcloud("");
    setImage("");
  };

  const handleEdit = (member: NonNullable<typeof crewMembers>[0]) => {
    setEditingId(member.id);
    setName(member.name);
    setRole(member.role);
    setInstagram(member.instagram ?? "");
    setSoundcloud(member.soundcloud ?? "");
    setImage(member.image);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMember.mutate({
        id: editingId,
        name,
        role,
        instagram: instagram || null,
        soundcloud: soundcloud || null,
        image,
      });
    } else {
      createMember.mutate({
        name,
        role,
        instagram: instagram || undefined,
        soundcloud: soundcloud || undefined,
        image,
      });
    }
  };

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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="instagram">Instagram URL</Label>
                  <Input
                    id="instagram"
                    type="url"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="soundcloud">SoundCloud URL</Label>
                  <Input
                    id="soundcloud"
                    type="url"
                    value={soundcloud}
                    onChange={(e) => setSoundcloud(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="image">Image Path</Label>
                  <Input
                    id="image"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="/crew_pfp/example.jpg"
                    required
                  />
                </div>
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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`loading-${i}`}>
                    <TableCell colSpan={5}>
                      <div className="bg-muted h-8 w-full animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              : crewMembers?.map((member, index) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell>{member.instagram ? "Yes" : "No"}</TableCell>
                    <TableCell>{member.soundcloud ? "Yes" : "No"}</TableCell>
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
                ))}
            {!isLoading && crewMembers?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
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
