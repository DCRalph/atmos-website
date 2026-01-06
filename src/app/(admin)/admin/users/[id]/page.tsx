"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { formatDateInUserTimezone } from "~/lib/date-utils";
import Image from "next/image";
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
import { Loader2 } from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
};

function titleizeProvider(providerId: string): string {
  return providerId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function UserManagementPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"USER" | "CREATOR" | "ADMIN" | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: user, isLoading, refetch } = api.users.getById.useQuery({ id });
  const updateRole = api.users.updateRole.useMutation({
    onSuccess: async () => {
      await refetch();
      setSelectedRole(null);
    },
  });
  const deleteUser = api.users.delete.useMutation({
    onSuccess: () => {
      router.push("/admin/users");
    },
  });

  // Initialize role when user data loads
  useEffect(() => {
    if (user && selectedRole === null) {
      setSelectedRole(user.role);
    }
  }, [user, selectedRole]);

  if (isLoading) {
    return (
      <AdminSection
        title="Manage User"
        backLink={{ href: "/admin/users", label: "← Back to Users" }}
        maxWidth="max-w-4xl"
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading user...</span>
        </div>
      </AdminSection>
    );
  }

  if (!user) {
    return (
      <AdminSection
        title="Manage User"
        backLink={{ href: "/admin/users", label: "← Back to Users" }}
        maxWidth="max-w-4xl"
      >
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">User not found</p>
          </CardContent>
        </Card>
      </AdminSection>
    );
  }

  const hasRoleChanged = selectedRole !== null && selectedRole !== user.role;

  return (
    <AdminSection
      title="Manage User"
      subtitle={user.name}
      backLink={{ href: "/admin/users", label: "← Back to Users" }}
      maxWidth="max-w-4xl"
      actions={
        <Button
          variant="destructive"
          onClick={() => setIsDeleteDialogOpen(true)}
          disabled={deleteUser.isPending}
        >
          {deleteUser.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            "Delete User"
          )}
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
          {/* User Details */}
          <Card>
            <CardHeader>
              <CardTitle>User Details</CardTitle>
              <CardDescription>Basic user information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                {user.image && (
                  <div className="relative h-16 w-16 overflow-hidden rounded-full">
                    <Image
                      src={user.image}
                      alt={user.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Verified</Label>
                <div>
                  {user.emailVerified ? (
                    <span className="text-green-600 text-sm font-medium">✓ Verified</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Not verified</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Account Created</Label>
                <p className="text-sm text-muted-foreground">
                  {formatDateInUserTimezone(user.createdAt, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Last Updated</Label>
                <p className="text-sm text-muted-foreground">
                  {formatDateInUserTimezone(user.updatedAt, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Role Management */}
          <Card>
            <CardHeader>
              <CardTitle>Role Management</CardTitle>
              <CardDescription>Change the user's role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={selectedRole ?? user.role}
                  onValueChange={(value: "USER" | "CREATOR" | "ADMIN") => setSelectedRole(value)}
                  disabled={updateRole.isPending}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="CREATOR">Creator</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select a role and click "Update Role" to save changes
                </p>
              </div>

              {hasRoleChanged && (
                <Button
                  onClick={() => {
                    if (selectedRole && confirm(`Change ${user.name}'s role to ${selectedRole}?`)) {
                      updateRole.mutate({ id: user.id, role: selectedRole });
                    }
                  }}
                  disabled={updateRole.isPending}
                  className="w-full"
                >
                  {updateRole.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Role"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Connected Accounts */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Authentication providers linked to this account</CardDescription>
            </CardHeader>
            <CardContent>
              {user.accounts.length > 0 ? (
                <div className="space-y-3">
                  {user.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <span className="text-sm font-semibold">
                            {titleizeProvider(account.providerId).charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{titleizeProvider(account.providerId)}</p>
                          <p className="text-xs text-muted-foreground">
                            Account ID: {account.accountId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Connected: {formatDateInUserTimezone(account.createdAt, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No connected accounts
                </p>
              )}
            </CardContent>
          </Card>
        </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {user.name}? This action cannot be undone and will
              permanently delete their account and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteUser.mutate({ id: user.id });
              }}
              disabled={deleteUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminSection>
  );
}

