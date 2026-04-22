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
  MoreHorizontal,
  ShieldCheck,
  User,
  UserCog,
  Calendar,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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

  const config =
    methodMap[method.toLowerCase()] ?? {
      label: method,
      variant: "outline" as const,
    };

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}

function getRoleBadge(role: string) {
  const roleMap: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" }
  > = {
    ADMIN: { label: "Admin", variant: "destructive" },
    CREATOR: { label: "Creator", variant: "secondary" },
    USER: { label: "User", variant: "default" },
  };

  const config =
    roleMap[role] ?? { label: role, variant: "default" as const };

  return (
    <Badge variant={config.variant} className="text-xs font-medium">
      {config.label}
    </Badge>
  );
}

function getRoleBadges(user: { roles?: { role: string }[] }) {
  const roles = user.roles?.map((r) => r.role) ?? [];
  const order: Record<string, number> = { ADMIN: 0, CREATOR: 1, USER: 2 };
  const sorted = [...new Set(roles)].sort(
    (a, b) => (order[a] ?? 99) - (order[b] ?? 99),
  );
  if (sorted.length === 0) {
    return <span className="text-muted-foreground text-xs">No roles</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((r) => (
        <span key={r}>{getRoleBadge(r)}</span>
      ))}
    </div>
  );
}

export function UsersManager() {
  const [userSearch, setUserSearch] = useState("");

  const { data: users, isLoading: usersLoading } = api.users.getAll.useQuery(
    userSearch ? { search: userSearch } : undefined,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage user accounts and roles. View last login methods and
            manage user access.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
                <TableHead>Roles</TableHead>
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
                      <TableCell colSpan={6}>
                        <div className="bg-muted h-8 w-full animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                : users?.map((user) => (
                    <TableRow key={user.id}>
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
                            <div className="text-muted-foreground text-sm">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadges(user)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {user.lastLoginMethod &&
                            getLoginMethodBadge(user.lastLoginMethod)}
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
                            <span className="text-muted-foreground text-xs">
                              Never
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.emailVerified ? (
                          <Badge
                            variant="outline"
                            className="text-xs text-green-600"
                          >
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
                        <div className="text-muted-foreground flex items-center gap-1 text-sm">
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
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="flex items-center gap-2"
                              >
                                <UserCog className="h-4 w-4" />
                                Manage User
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              {!usersLoading && users?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground py-8 text-center"
                  >
                    {userSearch ? "No users found" : "No users yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
