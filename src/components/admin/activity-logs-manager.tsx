"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Loader2 } from "lucide-react";

import { api } from "~/trpc/react";
import UserAvatar from "~/components/UserAvatar";
import { Button } from "~/components/ui/button";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { FilterSelect, ListFilters } from "./list-filters";
import {
  ACTIVITY_TYPE_VALUES,
  activityTypeLabel,
  type ActivityType,
} from "~/lib/activity-types";
import { formatDateTime } from "~/lib/date-utils";
import { ActivityDetails, ActivityTypeCell } from "./activity-badge";

const TYPE_OPTIONS = ACTIVITY_TYPE_VALUES.map((type) => ({
  value: type,
  label: activityTypeLabel(type),
}));

export function ActivityLogsManager() {
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.activityLogs.getAll.useInfiniteQuery(
    { limit: 50, type: selectedType ?? undefined },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const logs = data?.pages.flatMap((page) => page.logs) ?? [];
  type LogRow = (typeof logs)[number];

  const userCell = (user: LogRow["user"]) =>
    user ? (
      <Link
        href={`/admin/users/${user.id}`}
        className="flex items-center gap-2 hover:underline"
      >
        <UserAvatar
          className="size-6 shrink-0"
          size={12}
          src={user.image}
          name={user.name}
        />
        <div>
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground text-xs">{user.email}</p>
        </div>
      </Link>
    ) : (
      <span className="text-muted-foreground text-sm">—</span>
    );

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
      header: "User",
      cell: (log) =>
        log.user ? (
          userCell(log.user)
        ) : (
          <span className="text-muted-foreground text-sm">System</span>
        ),
    },
    { id: "target", header: "Target", cell: (log) => userCell(log.targetUser) },
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
    <div className="space-y-4">
      <ListFilters
        activeCount={selectedType ? 1 : 0}
        onClear={() => setSelectedType(null)}
      >
        <FilterSelect
          label="Type"
          value={selectedType}
          onChange={setSelectedType}
          options={TYPE_OPTIONS}
          anyLabel="All activity"
        />
      </ListFilters>

      <DataTable
        columns={columns}
        data={logs}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isFetching={isFetching && !isFetchingNextPage}
        storageKey="admin-activity-logs"
        emptyMessage="No activity logs found"
      />

      {hasNextPage && (
        <div className="flex justify-center">
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
    </div>
  );
}
