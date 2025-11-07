"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export function CrewManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instagram, setInstagram] = useState("");
  const [soundcloud, setSoundcloud] = useState("");
  const [image, setImage] = useState("");

  const { data: crewMembers, refetch } = api.crew.getAll.useQuery();
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
            <CardDescription>Manage crew members and their information</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>Add Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit" : "Add"} Crew Member</DialogTitle>
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
                <Button type="submit" disabled={createMember.isPending || updateMember.isPending}>
                  {editingId ? "Update" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
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
            {crewMembers?.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.name}</TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell>{member.instagram ? "Yes" : "No"}</TableCell>
                <TableCell>{member.soundcloud ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(member)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this member?")) {
                          deleteMember.mutate({ id: member.id });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

