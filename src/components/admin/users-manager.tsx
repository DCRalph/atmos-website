"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatDateInUserTimezone } from "~/lib/date-utils";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/ui/badge";
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
  MoreHorizontal,
  Shield,
  ShieldCheck,
  User,
  Ban,
  Unlock,
  UserCog,
  Mail,
  Calendar,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "~/lib/auth-client";
import { Input as BanReasonInput } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

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

function getRoleBadge(role: string) {
  const roleMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    ADMIN: { label: "Admin", variant: "destructive" },
    CREATOR: { label: "Creator", variant: "secondary" },
    USER: { label: "User", variant: "default" },
  };

  const config = roleMap[role] ?? { label: role, variant: "default" as const };

  return (
    <Badge variant={config.variant} className="text-xs font-medium">
      {config.label}
    </Badge>
  );
}

export function UsersManager() {
  const router = useRouter();
  const [userSearch, setUserSearch] = useState("");
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
    email: string;
    banned: boolean;
  } | null>(null);
  const [banReason, setBanReason] = useState("");

  const { data: users, isLoading: usersLoading, refetch } = api.users.getAll.useQuery(
    userSearch ? { search: userSearch } : undefined,
  );

  const banUser = api.users.ban.useMutation({
    onSuccess: () => {
      setBanDialogOpen(false);
      setSelectedUser(null);
      setBanReason("");
      void refetch();
    },
  });

  const unbanUser = api.users.unban.useMutation({
    onSuccess: () => {
      setUnbanDialogOpen(false);
      setSelectedUser(null);
      void refetch();
    },
  });

  const impersonateUser = api.users.impersonate.useMutation({
    onSuccess: () => {
      setImpersonateDialogOpen(false);
      setSelectedUser(null);
      // Redirect to home page after impersonation
      router.push("/");
      router.refresh();
    },
  });

  const handleBan = (user: { id: string; name: string; email: string }) => {
    setSelectedUser({ ...user, banned: false });
    setBanReason("");
    setBanDialogOpen(true);
  };

  const handleUnban = (user: { id: string; name: string; email: string }) => {
    setSelectedUser({ ...user, banned: true });
    setUnbanDialogOpen(true);
  };

  const handleImpersonate = (user: { id: string; name: string; email: string }) => {
    setSelectedUser({ ...user, banned: false });
    setImpersonateDialogOpen(true);
  };

  const confirmBan = () => {
    if (selectedUser) {
      banUser.mutate({
        id: selectedUser.id,
        reason: banReason || undefined,
      });
    }
  };

  const confirmUnban = () => {
    if (selectedUser) {
      unbanUser.mutate({ id: selectedUser.id });
    }
  };

  const confirmImpersonate = () => {
    if (selectedUser) {
      impersonateUser.mutate({ id: selectedUser.id });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user accounts, roles, and permissions. View last login methods and manage user access.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`loading-user-${i}`}>
                        <TableCell colSpan={7}>
                          <div className="bg-muted h-8 w-full animate-pulse rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  : users?.map((user) => (
                      <TableRow key={user.id} className={user.banned ? "bg-destructive/5" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {user.image ? (
                              <div className="relative h-8 w-8 overflow-hidden rounded-full">
                                <img
                                  src={user.image}
                                  alt={user.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                                <User className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-muted-foreground text-sm">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          {user.banned ? (
                            <Badge variant="destructive" className="text-xs">
                              <Ban className="mr-1 h-3 w-3" />
                              Banned
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {user.lastLoginMethod && getLoginMethodBadge(user.lastLoginMethod)}
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
                            {!user.lastLoginAt && !user.lastLoginMethod && (
                              <span className="text-muted-foreground text-xs">Never</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDateInUserTimezone(user.createdAt, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/users/${user.id}`} className="flex items-center gap-2">
                                  <UserCog className="h-4 w-4" />
                                  Manage User
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleImpersonate(user)}
                                disabled={impersonateUser.isPending}
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Impersonate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.banned ? (
                                <DropdownMenuItem
                                  onClick={() => handleUnban(user)}
                                  disabled={unbanUser.isPending}
                                  className="text-green-600"
                                >
                                  <Unlock className="mr-2 h-4 w-4" />
                                  Unban User
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleBan(user)}
                                  disabled={banUser.isPending}
                                  className="text-destructive"
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Ban User
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                {!usersLoading && users?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                      {userSearch ? "No users found" : "No users yet"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Are you sure you want to ban {selectedUser?.name}? They will not be able to access the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <BanReasonInput
                placeholder="Enter ban reason..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBan}
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
      <AlertDialog open={unbanDialogOpen} onOpenChange={setUnbanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unban {selectedUser?.name}? They will regain access to the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unbanUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnban}
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
      <AlertDialog open={impersonateDialogOpen} onOpenChange={setImpersonateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Impersonate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to impersonate {selectedUser?.name}? You will be logged in as this user.
              Make sure to log out when you're done.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={impersonateUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmImpersonate}
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
    </>
  );
}
