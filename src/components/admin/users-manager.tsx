"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, Loader2, Search, XCircle } from "lucide-react";

import { api } from "~/trpc/react";
import UserAvatar from "~/components/UserAvatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { formatDate, formatDateTime } from "~/lib/date-utils";
import { LoginMethodBadge, PermissionBadges } from "./user-badges";

export function UsersManager() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();

  const {
    data: users,
    isLoading,
    isFetching,
  } = api.users.getAll.useQuery(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  );

  const rows = users ?? [];
  type UserRow = (typeof rows)[number];
  const columns: DataTableColumn<UserRow>[] = [
    {
      id: "user",
      header: "User",
      sortable: true,
      accessor: (user) => user.name,
      cell: (user) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            className="size-8 shrink-0"
            src={user.image}
            name={user.name}
          />
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground text-sm">{user.email}</div>
          </div>
        </div>
      ),
    },
    {
      id: "permissions",
      header: "Permissions",
      cell: (user) => <PermissionBadges permissions={user.permissions} />,
    },
    {
      id: "lastLogin",
      header: "Last login",
      sortable: true,
      accessor: (user) => user.lastLoginAt,
      cell: (user) => (
        <div className="flex flex-col gap-1">
          <LoginMethodBadge method={user.lastLoginMethod} />
          {user.lastLoginAt ? (
            <span className="text-muted-foreground text-xs">
              {formatDateTime(user.lastLoginAt)}
            </span>
          ) : user.lastLoginMethod ? null : (
            <span className="text-muted-foreground text-xs">Never</span>
          )}
        </div>
      ),
    },
    {
      id: "verified",
      header: "Verified",
      sortable: true,
      accessor: (user) => user.emailVerified,
      cell: (user) =>
        user.emailVerified ? (
          <Badge variant="outline" className="text-xs text-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
            Verified
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            <XCircle className="mr-1 h-3 w-3" aria-hidden />
            Unverified
          </Badge>
        ),
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      accessor: (user) => user.createdAt,
      cell: (user) => (
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3" aria-hidden />
          {formatDate(user.createdAt, "short")}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (user) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/users/${user.id}`}>Manage</Link>
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="relative mb-4 max-w-sm">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            placeholder="Search users by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {isFetching ? (
            <Loader2
              className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin"
              aria-hidden
            />
          ) : null}
        </div>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          storageKey="admin-users"
          emptyMessage={search ? "No users found" : "No users yet"}
        />
      </CardContent>
    </Card>
  );
}
