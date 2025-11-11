"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { formatDateInUserTimezone } from "~/lib/date-utils";

export function UsersManager() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"USER" | "CREATOR" | "ADMIN">("USER");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = api.users.getAll.useQuery(
    userSearch ? { search: userSearch } : undefined,
  );
  const { data: invites, isLoading: invitesLoading, refetch: refetchInvites } = api.invites.getAll.useQuery(
    inviteSearch ? { search: inviteSearch } : undefined,
  );
  
  const createInvite = api.invites.create.useMutation({
    onSuccess: async () => {
      await refetchInvites();
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("USER");
      setError(null);
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const deleteInvite = api.invites.delete.useMutation({
    onSuccess: async () => {
      await refetchInvites();
    },
  });

  const updateUserRole = api.users.updateRole.useMutation({
    onSuccess: async () => {
      await refetchUsers();
    },
  });

  const deleteUser = api.users.delete.useMutation({
    onSuccess: async () => {
      await refetchUsers();
    },
  });

  const handleCreateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createInvite.mutate({
      email: inviteEmail,
      role: inviteRole,
    });
  };

  return (
    <div className="space-y-6">
      {/* Invites Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <CardTitle>Invites</CardTitle>
              <CardDescription>Manage user invitations</CardDescription>
            </div>
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setError(null)}>Create Invite</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Invite</DialogTitle>
                  <DialogDescription>
                    Invite a user by email. They will be able to sign up with the specified role.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateInvite} className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="inviteEmail">Email</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="inviteRole">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: "USER" | "CREATOR" | "ADMIN") => setInviteRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="CREATOR">Creator</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {error && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <Button type="submit" disabled={createInvite.isPending}>
                    {createInvite.isPending ? "Creating..." : "Create Invite"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search invites by email..."
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`loading-invite-${i}`}>
                    <TableCell colSpan={5}>
                      <div className="h-8 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : invites?.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>{invite.email}</TableCell>
                  <TableCell>
                    <span className="rounded bg-muted px-2 py-1 text-xs font-medium capitalize">
                      {invite.role.toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell>
                    {invite.used ? (
                      <span className="text-muted-foreground text-sm">Used</span>
                    ) : (
                      <span className="text-green-600 text-sm font-medium">Active</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDateInUserTimezone(invite.createdAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    {!invite.used && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this invite?")) {
                            deleteInvite.mutate({ id: invite.id });
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!invitesLoading && invites?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {inviteSearch ? "No invites found" : "No invites yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Users Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage user accounts and roles</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search users by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`loading-user-${i}`}>
                    <TableCell colSpan={6}>
                      <div className="h-8 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value: "USER" | "CREATOR" | "ADMIN") => {
                        if (confirm(`Change ${user.name}'s role to ${value}?`)) {
                          updateUserRole.mutate({ id: user.id, role: value });
                        }
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="CREATOR">Creator</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {user.emailVerified ? (
                      <span className="text-green-600 text-sm">Yes</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDateInUserTimezone(user.createdAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
                          deleteUser.mutate({ id: user.id });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!usersLoading && users?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {userSearch ? "No users found" : "No users yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

