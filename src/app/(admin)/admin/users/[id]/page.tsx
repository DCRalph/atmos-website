"use client";

import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import { Badge } from "~/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Calendar, Clock } from "lucide-react";
import { UserActivityLogs } from "~/components/admin/user-activity-logs";
import { useConfirm } from "~/components/confirm-provider";

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

  const methodMap: Record<
    string,
    { label: string; variant: "default" | "secondary" | "outline" }
  > = {
    email: { label: "Email", variant: "default" },
    google: { label: "Google", variant: "secondary" },
    github: { label: "GitHub", variant: "outline" },
  };

  const config = methodMap[method.toLowerCase()] ?? {
    label: method,
    variant: "outline" as const,
  };

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}

type PermissionName = "EVENT_ORGANISER" | "CREATOR" | "ADMIN";
const ALL_PERMISSIONS: PermissionName[] = [
  "EVENT_ORGANISER",
  "CREATOR",
  "ADMIN",
];

export default function UserManagementPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const [selectedPermissions, setSelectedPermissions] =
    useState<Set<PermissionName> | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: user, isLoading, refetch } = api.users.getById.useQuery({ id });
  const setPermissions = api.users.setPermissions.useMutation({
    onSuccess: async () => {
      await refetch();
      setSelectedPermissions(null);
    },
  });
  const deleteUser = api.users.delete.useMutation({
    onSuccess: () => {
      router.push("/admin/users");
    },
  });

  const userPermissions = useMemo<PermissionName[]>(() => {
    if (!user) return [];
    return user.permissions?.map((row) => row.permission) ?? [];
  }, [user]);

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

  const currentPermissionsSet = new Set(userPermissions);
  const nextPermissionsSet = selectedPermissions ?? currentPermissionsSet;
  const hasPermissionsChanged =
    selectedPermissions !== null &&
    (nextPermissionsSet.size !== currentPermissionsSet.size ||
      [...nextPermissionsSet].some(
        (permission) => !currentPermissionsSet.has(permission),
      ));

  function togglePermission(permission: PermissionName, checked: boolean) {
    setSelectedPermissions((prev) => {
      const base = new Set(prev ?? currentPermissionsSet);
      if (checked) base.add(permission);
      else base.delete(permission);
      return base;
    });
  }

  return (
    <AdminSection
      title="Manage User"
      subtitle={user.name}
      backLink={{ href: "/admin/users", label: "← Back to Users" }}
      maxWidth="max-w-4xl"
      actions={
        <div className="flex gap-2">
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
                  <span className="text-muted-foreground text-sm">
                    Never logged in
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Account Created</Label>
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
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
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
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

        {/* Permission Management */}
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              Permissions can be combined. Admin grants full access without
              requiring the other permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              {ALL_PERMISSIONS.map((permission) => {
                const checked = nextPermissionsSet.has(permission);
                return (
                  <label
                    key={permission}
                    className="hover:bg-accent/30 flex cursor-pointer items-center gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        togglePermission(permission, Boolean(value))
                      }
                      disabled={setPermissions.isPending}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {permission === "EVENT_ORGANISER"
                          ? "Event organiser"
                          : permission === "CREATOR"
                            ? "Creator"
                            : "Admin"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {permission === "EVENT_ORGANISER"
                          ? "Can view every event, complete analytics, order details, CSV exports, and scan tickets at the door."
                          : permission === "CREATOR"
                            ? "Can own, edit, and publish their creator profile and themes."
                            : "Full application administration rights."}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {hasPermissionsChanged && (
              <Button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Update permissions",
                    description: `Update ${user.name}'s permissions to: ${
                      [...nextPermissionsSet].join(", ") || "(none)"
                    }?`,
                    confirmLabel: "Update",
                  });
                  if (ok) {
                    setPermissions.mutate({
                      id: user.id,
                      permissions: [...nextPermissionsSet],
                    });
                  }
                }}
                disabled={setPermissions.isPending}
                className="w-full"
              >
                {setPermissions.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save permissions"
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
