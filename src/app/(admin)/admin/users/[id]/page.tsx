"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import {
  Loader2,
  Ban,
  Unlock,
  Shield,
  CheckCircle2,
  XCircle,
  Mail,
  Calendar,
  Clock,
} from "lucide-react";
import { UserActivityLogs } from "~/components/admin/user-activity-logs";

type PageProps = {
  params: Promise<{ id: string }>;
};

function titleizeProvider(providerId: string): string {
  return providerId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getLoginMethodBadge(method: string | null) {
  if (!method) return null;

  const methodMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    email: { label: "Email", variant: "default" },
    google: { label: "Google", variant: "secondary" },
    github: { label: "GitHub", variant: "outline" },
  };

  const config = methodMap[method.toLowerCase()] ?? { label: method, variant: "outline" as const };

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}

export default function UserManagementPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<
    "USER" | "CREATOR" | "ADMIN" | null
  >(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [isUnbanDialogOpen, setIsUnbanDialogOpen] = useState(false);
  const [isImpersonateDialogOpen, setIsImpersonateDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState("");

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
  const banUser = api.users.ban.useMutation({
    onSuccess: async () => {
      setIsBanDialogOpen(false);
      setBanReason("");
      await refetch();
    },
  });
  const unbanUser = api.users.unban.useMutation({
    onSuccess: async () => {
      setIsUnbanDialogOpen(false);
      await refetch();
    },
  });
  const impersonateUser = api.users.impersonate.useMutation({
    onSuccess: () => {
      setIsImpersonateDialogOpen(false);
      router.push("/");
      router.refresh();
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
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <span className="text-muted-foreground ml-2">Loading user...</span>
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
        <div className="flex gap-2">
          {user.banned ? (
            <Button
              variant="outline"
              onClick={() => setIsUnbanDialogOpen(true)}
              disabled={unbanUser.isPending}
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <Unlock className="mr-2 h-4 w-4" />
              {unbanUser.isPending ? "Unbanning..." : "Unban User"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsBanDialogOpen(true)}
              disabled={banUser.isPending}
              className="border-red-600 text-red-600 hover:bg-red-50"
            >
              <Ban className="mr-2 h-4 w-4" />
              Ban User
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setIsImpersonateDialogOpen(true)}
            disabled={impersonateUser.isPending}
          >
            <Shield className="mr-2 h-4 w-4" />
            Impersonate
          </Button>
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
        </div>
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
                <p className="text-muted-foreground text-sm">{user.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div>
                {user.banned ? (
                  <Badge variant="destructive" className="text-xs">
                    <Ban className="mr-1 h-3 w-3" />
                    Banned
                    {user.bannedReason && (
                      <span className="ml-1">({user.bannedReason})</span>
                    )}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Active
                  </Badge>
                )}
                {user.bannedAt && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Banned on: {formatDateInUserTimezone(user.bannedAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email Verified</Label>
              <div>
                {user.emailVerified ? (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <XCircle className="mr-1 h-3 w-3" />
                    Unverified
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last Login Method</Label>
              <div className="flex items-center gap-2">
                {user.lastLoginMethod ? (
                  <>
                    {getLoginMethodBadge(user.lastLoginMethod)}
                    {user.lastLoginAt && (
                      <span className="text-muted-foreground text-xs">
                        {formatDateInUserTimezone(user.lastLoginAt, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">Never logged in</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Account Created</Label>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDateInUserTimezone(user.createdAt, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last Updated</Label>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDateInUserTimezone(user.updatedAt, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
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
                onValueChange={(value: "USER" | "CREATOR" | "ADMIN") =>
                  setSelectedRole(value)
                }
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
              <p className="text-muted-foreground text-xs">
                Select a role and click "Update Role" to save changes
              </p>
            </div>

            {hasRoleChanged && (
              <Button
                onClick={() => {
                  if (
                    selectedRole &&
                    confirm(`Change ${user.name}'s role to ${selectedRole}?`)
                  ) {
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
            <CardDescription>
              Authentication providers linked to this account
            </CardDescription>
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
                      <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                        <span className="text-sm font-semibold">
                          {titleizeProvider(account.providerId).charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {titleizeProvider(account.providerId)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Account ID: {account.accountId}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Connected:{" "}
                          {formatDateInUserTimezone(account.createdAt, {
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
              <p className="text-muted-foreground py-8 text-center">
                No connected accounts
              </p>
            )}
          </CardContent>
        </Card>

        {/* Activity Logs */}
        <div className="lg:col-span-2">
          <UserActivityLogs userId={user.id} />
        </div>
      </div>

      {/* Ban Dialog */}
      <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Are you sure you want to ban {user.name}? They will not be able to access the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                placeholder="Enter ban reason..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBanDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                banUser.mutate({ id: user.id, reason: banReason || undefined });
              }}
              disabled={banUser.isPending}
            >
              {banUser.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Banning...
                </>
              ) : (
                "Ban User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unban Dialog */}
      <AlertDialog open={isUnbanDialogOpen} onOpenChange={setIsUnbanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unban {user.name}? They will regain access to the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unbanUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                unbanUser.mutate({ id: user.id });
              }}
              disabled={unbanUser.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {unbanUser.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unbanning...
                </>
              ) : (
                "Unban User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Impersonate Dialog */}
      <AlertDialog open={isImpersonateDialogOpen} onOpenChange={setIsImpersonateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Impersonate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to impersonate {user.name}? You will be logged in as this user.
              Make sure to log out when you're done.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={impersonateUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                impersonateUser.mutate({ id: user.id });
              }}
              disabled={impersonateUser.isPending}
            >
              {impersonateUser.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Impersonating...
                </>
              ) : (
                "Impersonate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {user.name}? This action cannot be
              undone and will permanently delete their account and all
              associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>
              Cancel
            </AlertDialogCancel>
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
