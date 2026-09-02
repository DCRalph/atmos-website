"use client";

import Link from "next/link";
import { Activity, ChevronRight, Clock, Loader2 } from "lucide-react";

import { api } from "~/trpc/react";
import UserAvatar from "~/components/UserAvatar";
import { Button } from "~/components/ui/button";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatDateTime } from "~/lib/date-utils";
import { ActivityDetails, ActivityTypeCell } from "./activity-badge";

export function UserActivityLogs({ userId }: { userId: string }) {
  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.activityLogs.getByUser.useInfiniteQuery(
    { userId, limit: 50 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const logs = data?.pages.flatMap((page) => page.logs) ?? [];
  type LogRow = (typeof logs)[number];
  const columns: DataTableColumn<LogRow>[] = [
    {
      id: "type",
      header: "Type",
      sortable: true,
      accessor: (log) => log.type,
      cell: (log) => <ActivityTypeCell type={log.type} />,
    },
    {
      id: "action",
      header: "Action",
      sortable: true,
      accessor: (log) => log.action,
      cell: (log) => (
        <div className="max-w-md whitespace-normal">
          <p className="text-sm font-medium">{log.action}</p>
          <ActivityDetails details={log.details} />
        </div>
      ),
    },
    {
      id: "user",
      header: "Performed by",
      cell: (log) =>
        log.user ? (
          <Link
            href={`/admin/users/${log.user.id}`}
            className="flex items-center gap-2 hover:underline"
          >
            <UserAvatar
              className="size-6 shrink-0"
              size={12}
              src={log.user.image}
              name={log.user.name}
            />
            <div>
              <p className="text-sm font-medium">{log.user.name}</p>
              <p className="text-muted-foreground text-xs">{log.user.email}</p>
            </div>
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">System</span>
        ),
    },
    {
      id: "time",
      header: "Time",
      sortable: true,
      accessor: (log) => log.createdAt,
      cell: (log) => (
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <Clock className="h-3 w-3" aria-hidden />
          {formatDateTime(log.createdAt)}
        </div>
      ),
    },
    {
      id: "ip",
      header: "IP address",
      cell: (log) => (
        <span className="text-muted-foreground font-mono text-xs">
          {log.ipAddress ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" aria-hidden />
            Activity
          </CardTitle>
          <CardDescription>
            Activities performed by or affecting this user
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={logs}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          isFetching={isFetching && !isFetchingNextPage}
          storageKey="admin-user-activity"
          emptyMessage="No activity logs found for this user"
        />

        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                <>
                  Load more
                  <ChevronRight className="ml-2 h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
