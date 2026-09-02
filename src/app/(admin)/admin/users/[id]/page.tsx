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
import { formatDateTime } from "~/lib/date-utils";
import UserAvatar from "~/components/UserAvatar";
import { toast } from "sonner";
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
import {
  LoginMethodBadge,
  PERMISSIONS,
  permissionLabel,
  type PermissionName,
} from "~/components/admin/user-badges";
import { DataTable, type DataTableColumn } from "~/components/data-table";
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

type ConnectedAccount = {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: Date;
};

const accountColumns: DataTableColumn<ConnectedAccount>[] = [
  {
    id: "provider",
    header: "Provider",
    sortable: true,
    accessor: (row) => titleizeProvider(row.providerId),
    className: "font-medium",
  },
  {
    id: "accountId",
    header: "Account ID",
    cell: (row) => <span className="font-mono text-xs">{row.accountId}</span>,
  },
  {
    id: "createdAt",
    header: "Connected",
    type: "date",
    sortable: true,
    accessor: (row) => row.createdAt,
  },
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
      toast.success("Permissions updated");
      await refetch();
      setSelectedPermissions(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteUser = api.users.delete.useMutation({
    onSuccess: () => {
      toast.success("User deleted");
      router.push("/admin/users");
    },
    onError: (error) => toast.error(error.message),
  });

  const userPermissions = useMemo<PermissionName[]>(() => {
    if (!user) return [];
    return user.permissions?.map((row) => row.permission) ?? [];
  }, [user]);

  if (isLoading) {
    return (
      <AdminSection
        title="Manage user"
        backLink={{ href: "/admin/users", label: "Users" }}
        maxWidth="max-w-4xl"
      >
        <div className="flex items-center justify-center py-12">
          <Loader2
            className="text-muted-foreground h-8 w-8 animate-spin"
            aria-hidden
          />
          <span className="text-muted-foreground ml-2">Loading user…</span>
        </div>
      </AdminSection>
    );
  }

  if (!user) {
    return (
      <AdminSection
        title="Manage user"
        backLink={{ href: "/admin/users", label: "Users" }}
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
      title="Manage user"
      subtitle={user.name}
      backLink={{ href: "/admin/users", label: "Users" }}
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
                Deleting…
              </>
            ) : (
              "Delete user"
            )}
          </Button>
        </div>
      }
    >
      <div className="grid min-w-0 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {/* User details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Basic user information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <UserAvatar
                className="size-16 shrink-0"
                size={28}
                src={user.image}
                name={user.name}
              />
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-muted-foreground text-sm">{user.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email verified</Label>
              <div>
                {user.emailVerified ? (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <XCircle className="mr-1 h-3 w-3" aria-hidden />
                    Unverified
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last login</Label>
              <div className="flex items-center gap-2">
                {user.lastLoginMethod ? (
                  <>
                    <LoginMethodBadge method={user.lastLoginMethod} />
                    {user.lastLoginAt && (
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(user.lastLoginAt)}
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
              <Label>Account created</Label>
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Calendar className="h-3 w-3" aria-hidden />
                {formatDateTime(user.createdAt)}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last updated</Label>
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3" aria-hidden />
                {formatDateTime(user.updatedAt)}
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
              {PERMISSIONS.map(({ name, label, description }) => (
                <label
                  key={name}
                  className="hover:bg-accent/30 flex cursor-pointer items-center gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    checked={nextPermissionsSet.has(name)}
                    onCheckedChange={(value) =>
                      togglePermission(name, Boolean(value))
                    }
                    disabled={setPermissions.isPending}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground text-xs">
                      {description}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            {hasPermissionsChanged && (
              <Button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Update permissions",
                    description: `Update ${user.name}'s permissions to: ${
                      [...nextPermissionsSet].map(permissionLabel).join(", ") ||
                      "none"
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
                    Updating…
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
            <CardTitle>Connected accounts</CardTitle>
            <CardDescription>
              Authentication providers linked to this account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={accountColumns}
              data={user.accounts}
              getRowId={(row) => row.id}
              storageKey="admin-user-accounts"
              emptyMessage="No connected accounts"
            />
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
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
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
                  Deleting…
                </>
              ) : (
                "Delete user"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminSection>
  );
}
