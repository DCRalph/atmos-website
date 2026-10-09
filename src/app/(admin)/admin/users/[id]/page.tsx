"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Lock,
  XCircle,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import UserAvatar from "~/components/UserAvatar";
import { useConfirm } from "~/components/confirm-provider";
import { UserActivityLogs } from "~/components/admin/user-activity-logs";
import {
  LoginMethodBadge,
  PERMISSIONS,
  PermissionBadges,
  permissionLabel,
  type PermissionName,
} from "~/components/admin/user-badges";
import { SessionsTable } from "~/components/account/sessions-table";
import { SignInMethodRow } from "~/components/account/sign-in-method-row";
import { formatDate, formatDateTime } from "~/lib/date-utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

type User = NonNullable<RouterOutputs["users"]["getById"]>;
type ManageableUser = Extract<User, { canManage: true }>;

/** Permissions only a superadmin may grant or take away. */
const ADMIN_TIER: PermissionName[] = ["ADMIN", "SUPERADMIN"];

export default function UserManagementPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: user, isLoading } = api.users.getById.useQuery({ id });

  if (isLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-12">
          <Loader2
            className="text-muted-foreground h-8 w-8 animate-spin"
            aria-hidden
          />
          <span className="text-muted-foreground ml-2">Loading user…</span>
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">User not found</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title={user.name} subtitle={user.email}>
      <div className="mb-6 flex items-center gap-4">
        <UserAvatar
          className="size-14 shrink-0"
          size={24}
          src={user.image}
          name={user.name}
        />
        <div className="flex flex-wrap items-center gap-2">
          <PermissionBadges permissions={user.permissions} />
          {user.isSelf && (
            <Badge variant="outline" className="text-xs">
              You
            </Badge>
          )}
        </div>
        {!user.isSelf &&
          !user.permissions.some((row) =>
            ADMIN_TIER.includes(row.permission),
          ) && <ViewAsButton user={user} />}
      </div>

      {user.canManage ? (
        <ManageableView user={user} />
      ) : (
        <RestrictedView user={user} />
      )}
    </Shell>
  );
}

/**
 * Signs the admin in as this user for up to an hour, logged in the activity
 * log. Admins can't be viewed as, so admin access can't be borrowed.
 */
function ViewAsButton({ user }: { user: User }) {
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    const { error } = await authClient.impersonation.start({
      userId: user.id,
    });
    if (error) {
      toast.error(error.message ?? "Couldn't view as this user");
      setPending(false);
      return;
    }
    // A full load, not router.push, so no query cache from the other user survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/dashboard";
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-auto"
      disabled={pending}
      onClick={start}
    >
      <Eye aria-hidden />
      View as
    </Button>
  );
}

function Shell({
  title = "Manage user",
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <AdminSection
      title={title}
      subtitle={subtitle}
      backLink={{ href: "/admin/users", label: "Users" }}
      maxWidth="max-w-4xl"
    >
      {children}
    </AdminSection>
  );
}

/** What an admin sees of another admin: who they are, and nothing to change. */
function RestrictedView({ user }: { user: User }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DetailsCard user={user} />
      <Card>
        <CardContent className="text-muted-foreground flex items-start gap-3 pt-6 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Only superadmins can view or change another admin&apos;s
            permissions, password, sign-in methods, and sessions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ManageableView({ user }: { user: ManageableUser }) {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sign-in methods" value={user.accounts.length} />
        <Stat label="Active sessions" value={user.sessions.length} />
        <Stat
          label="Email"
          value={<VerifiedBadge verified={user.emailVerified} />}
        />
        <Stat
          label="Last login"
          value={
            user.lastLoginAt ? (
              <span className="flex items-center gap-2">
                <LoginMethodBadge method={user.lastLoginMethod} />
                <span className="text-muted-foreground text-sm">
                  {formatDate(user.lastLoginAt, "short")}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">Never</span>
            )
          }
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sign-in">Sign-in</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="danger">Danger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailsCard user={user} />
            <PermissionsCard user={user} />
          </div>
        </TabsContent>

        <TabsContent value="sign-in">
          <div className="grid gap-6 lg:grid-cols-2">
            <ConnectedAccountsCard user={user} />
            <PasswordCard user={user} />
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsCard user={user} />
        </TabsContent>

        <TabsContent value="activity">
          <UserActivityLogs userId={user.id} />
        </TabsContent>

        <TabsContent value="danger">
          <DangerCard user={user} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <div className="text-xl font-bold">{value}</div>
        <div className="text-muted-foreground text-xs">{label}</div>
      </CardContent>
    </Card>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge variant="outline" className="text-xs text-green-600">
      <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
      Verified
    </Badge>
  ) : (
    <Badge variant="outline" className="text-xs">
      <XCircle className="mr-1 h-3 w-3" aria-hidden />
      Unverified
    </Badge>
  );
}

function DetailsCard({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>Basic user information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Email</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm">{user.email}</span>
            <VerifiedBadge verified={user.emailVerified} />
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
  );
}

function PermissionsCard({ user }: { user: ManageableUser }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const [draft, setDraft] = useState<Set<PermissionName> | null>(null);

  const setPermissions = api.users.setPermissions.useMutation({
    onSuccess: async () => {
      toast.success("Permissions updated");
      await utils.users.getById.invalidate({ id: user.id });
      setDraft(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const current = new Set(user.permissions.map((row) => row.permission));
  const next = draft ?? current;
  const changed =
    draft !== null &&
    (next.size !== current.size || [...next].some((p) => !current.has(p)));

  function toggle(permission: PermissionName, checked: boolean) {
    setDraft((prev) => {
      const base = new Set(prev ?? current);
      if (checked) {
        base.add(permission);
        // A superadmin is always an admin too; the server enforces the same.
        if (permission === "SUPERADMIN") base.add("ADMIN");
      } else {
        base.delete(permission);
        if (permission === "ADMIN") base.delete("SUPERADMIN");
      }
      return base;
    });
  }

  /** Why a row can't be toggled, or null when it can. */
  function lockedReason(permission: PermissionName): string | null {
    if (!ADMIN_TIER.includes(permission)) return null;
    if (!user.viewerIsSuperadmin) return "Only superadmins can change this";
    if (user.isSelf && current.has(permission)) {
      return "You can't remove your own admin access";
    }
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
        <CardDescription>
          Admin grants full access. Only superadmins can change Admin and
          Superadmin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          {PERMISSIONS.map(({ name, label, description }) => {
            const locked = lockedReason(name);
            return (
              <label
                key={name}
                title={locked ?? undefined}
                className={
                  locked
                    ? "flex items-center gap-3 rounded-md border p-3 opacity-60"
                    : "hover:bg-accent/30 flex cursor-pointer items-center gap-3 rounded-md border p-3"
                }
              >
                <Checkbox
                  checked={next.has(name)}
                  onCheckedChange={(value) => toggle(name, Boolean(value))}
                  disabled={setPermissions.isPending || locked !== null}
                />
                <div className="flex flex-col">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground text-xs">
                    {description}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        {changed && (
          <Button
            onClick={async () => {
              const ok = await confirm({
                title: "Update permissions",
                description: `Update ${user.name}'s permissions to: ${
                  [...next].map(permissionLabel).join(", ") || "none"
                }?`,
                confirmLabel: "Update",
              });
              if (ok) {
                setPermissions.mutate({ id: user.id, permissions: [...next] });
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
  );
}

function ConnectedAccountsCard({ user }: { user: ManageableUser }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const unlink = api.users.unlinkAccount.useMutation({
    onSuccess: async () => {
      toast.success("Sign-in method removed");
      await utils.users.getById.invalidate({ id: user.id });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>
          How this user can sign in. The last one can&apos;t be removed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user.accounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sign-in methods</p>
        ) : (
          user.accounts.map((account) => (
            <SignInMethodRow
              key={account.id}
              providerId={account.providerId}
              connectedAt={account.createdAt}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unlink.isPending || user.accounts.length === 1}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Remove sign-in method",
                      description: `${user.name} will no longer be able to sign in this way.`,
                      confirmLabel: "Remove",
                      variant: "destructive",
                    });
                    if (ok) {
                      unlink.mutate({ id: user.id, accountId: account.id });
                    }
                  }}
                >
                  {account.providerId === "credential" ? "Remove" : "Unlink"}
                </Button>
              }
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PasswordCard({ user }: { user: ManageableUser }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const [password, setPassword] = useState("");
  const [revokeSessions, setRevokeSessions] = useState(true);

  const setPasswordMutation = api.users.setPassword.useMutation({
    onSuccess: async () => {
      toast.success("Password set");
      setPassword("");
      await utils.users.getById.invalidate({ id: user.id });
    },
    onError: (error) => toast.error(error.message),
  });
  const sendReset = api.users.sendPasswordReset.useMutation({
    onSuccess: (result) => toast.success(`Reset link sent to ${result.sentTo}`),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          {user.hasPassword
            ? "Set a new one directly, or email the user a reset link."
            : "No password yet. Setting one adds password sign-in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-new-password">New password</Label>
          <Input
            id="admin-new-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={revokeSessions}
            onCheckedChange={(value) => setRevokeSessions(Boolean(value))}
          />
          Sign them out everywhere
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={password.length < 8 || setPasswordMutation.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: "Set a new password",
                description: `${user.name} won't be told. Share it with them yourself, or send a reset link instead.`,
                confirmLabel: "Set password",
              });
              if (ok) {
                setPasswordMutation.mutate({
                  id: user.id,
                  password,
                  revokeSessions,
                });
              }
            }}
          >
            {setPasswordMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Set password
          </Button>
          <Button
            variant="outline"
            disabled={sendReset.isPending}
            onClick={() => sendReset.mutate({ id: user.id })}
          >
            {sendReset.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Email reset link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionsCard({ user }: { user: ManageableUser }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const invalidate = () => utils.users.getById.invalidate({ id: user.id });

  const revokeOne = api.users.revokeSession.useMutation({
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });
  const revokeAll = api.users.revokeSessions.useMutation({
    onSuccess: async (result) => {
      toast.success(`Signed out of ${result.count} sessions`);
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Devices currently signed in</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={revokeAll.isPending || user.sessions.length === 0}
          onClick={async () => {
            const ok = await confirm({
              title: "Sign out everywhere",
              description: `Ends all ${user.sessions.length} of ${user.name}'s sessions.`,
              confirmLabel: "Sign out",
              variant: "destructive",
            });
            if (ok) revokeAll.mutate({ id: user.id });
          }}
        >
          Sign out everywhere
        </Button>
      </CardHeader>
      <CardContent>
        <SessionsTable
          sessions={user.sessions}
          storageKey="admin-user-sessions"
          isRevoking={revokeOne.isPending}
          onRevoke={(sessionId) => revokeOne.mutate({ id: user.id, sessionId })}
        />
      </CardContent>
    </Card>
  );
}

function DangerCard({ user }: { user: ManageableUser }) {
  const confirm = useConfirm();
  const router = useRouter();
  const utils = api.useUtils();
  const invalidate = () => utils.users.getById.invalidate({ id: user.id });

  const revokeAll = api.users.revokeSessions.useMutation({
    onSuccess: async (result) => {
      toast.success(`Signed out of ${result.count} sessions`);
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const setVerified = api.users.setEmailVerified.useMutation({
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });
  const deleteUser = api.users.delete.useMutation({
    onSuccess: () => {
      toast.success("User deleted");
      router.push("/admin/users");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
      </CardHeader>
      <CardContent>
        <DangerRow
          title="Sign out everywhere"
          description={`Ends all ${user.sessions.length} sessions on every device.`}
        >
          <Button
            variant="outline"
            disabled={revokeAll.isPending || user.sessions.length === 0}
            onClick={async () => {
              const ok = await confirm({
                title: "Sign out everywhere",
                description: `Ends all of ${user.name}'s sessions.`,
                confirmLabel: "Sign out",
                variant: "destructive",
              });
              if (ok) revokeAll.mutate({ id: user.id });
            }}
          >
            Sign out
          </Button>
        </DangerRow>

        <DangerRow
          title={
            user.emailVerified ? "Mark email unverified" : "Mark email verified"
          }
          description={
            user.emailVerified
              ? "They'll be asked to confirm their address again."
              : "Skips the confirmation email."
          }
        >
          <Button
            variant="outline"
            disabled={setVerified.isPending}
            onClick={() =>
              setVerified.mutate({ id: user.id, verified: !user.emailVerified })
            }
          >
            {user.emailVerified ? "Mark unverified" : "Mark verified"}
          </Button>
        </DangerRow>

        <DangerRow
          title="Delete user"
          description="Permanently removes the account. This cannot be undone."
        >
          <Button
            variant="destructive"
            disabled={deleteUser.isPending || user.isSelf}
            onClick={async () => {
              const ok = await confirm({
                title: "Delete user?",
                description: `Permanently deletes ${user.name}'s account and all associated data.`,
                confirmLabel: "Delete user",
                variant: "destructive",
              });
              if (ok) deleteUser.mutate({ id: user.id });
            }}
          >
            {deleteUser.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Delete
          </Button>
        </DangerRow>
      </CardContent>
    </Card>
  );
}

function DangerRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}
