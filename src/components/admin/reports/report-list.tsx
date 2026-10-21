"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, FileText, Search } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FilterSelect, ListFilters } from "~/components/admin/list-filters";
import { formatDateTime } from "~/lib/date-utils";
import { useDebouncedValue } from "~/hooks/use-debounced-value";

type Report = RouterOutputs["reports"]["list"]["rows"][number];
const columns: DataTableColumn<Report>[] = [
  {
    id: "title",
    header: "Report",
    cell: (report) => (
      <Link
        href={`/admin/reports/${report.id}`}
        className="flex items-center gap-2 font-medium hover:underline"
      >
        <FileText className="text-muted-foreground size-4 shrink-0" />
        <span className="max-w-56 truncate sm:max-w-md">{report.title}</span>
      </Link>
    ),
  },
  {
    id: "user",
    header: "Created by",
    cell: (report) => report.user?.name ?? "Deleted user",
    className: "max-sm:hidden",
    headerClassName: "max-sm:hidden",
  },
  {
    id: "createdAt",
    header: "Created",
    cell: (report) => (
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {formatDateTime(report.createdAt)}
      </span>
    ),
  },
  {
    id: "open",
    header: "",
    cell: () => <ChevronRight className="text-muted-foreground size-4" />,
    hideable: false,
    className: "w-8",
  },
];

export function ReportList() {
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);
  const people = api.reports.people.useQuery();
  const list = api.reports.list.useInfiniteQuery(
    { search: debouncedSearch, userId: person ?? undefined, limit: 30 },
    { getNextPageParam: (page) => page.nextCursor },
  );
  const reports = list.data?.pages.flatMap((page) => page.rows) ?? [];
  return (
    <div className="space-y-4">
      <ListFilters
        activeCount={(search ? 1 : 0) + (person ? 1 : 0)}
        onClear={() => {
          setSearch("");
          setPerson(null);
        }}
      >
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            aria-label="Search reports"
            placeholder="Search reports"
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <FilterSelect
          label="Created by"
          value={person}
          onChange={setPerson}
          options={(people.data ?? []).map((user) => ({
            value: user.id,
            label: user.name,
          }))}
          anyLabel="Everyone"
        />
      </ListFilters>
      {list.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-destructive">Could not load reports.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void list.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={reports}
            getRowId={(row) => row.id}
            getRowHref={(row) => `/admin/reports/${row.id}`}
            isLoading={list.isPending}
            storageKey="admin-reports"
            emptyMessage={
              search || person
                ? "No reports match these filters."
                : "No reports yet. Ask Will GPT to create a report or analyse your data."
            }
          />
          {list.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {list.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
