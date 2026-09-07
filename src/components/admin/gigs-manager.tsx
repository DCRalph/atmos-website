"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { formatDateTime, isGigUpcoming } from "~/lib/date-utils";

export function GigsManager() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();
  const {
    data: gigs,
    isLoading,
    isFetching,
  } = api.gigs.getAll.useQuery(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  );

  const rows = gigs ?? [];
  type GigRow = (typeof rows)[number];

  const columns: DataTableColumn<GigRow>[] = [
    {
      id: "start",
      header: "Starts",
      sortable: true,
      accessor: (gig) => gig.gigStartTime,
      cell: (gig) => formatDateTime(gig.gigStartTime),
    },
    {
      id: "title",
      header: "Title",
      sortable: true,
      accessor: (row) => row.title,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      accessor: (gig) =>
        isGigUpcoming({
          gigStartTime: gig.gigStartTime,
          gigEndTime: gig.gigEndTime,
        })
          ? "Upcoming"
          : "Past",
    },
    {
      id: "media",
      header: "Media",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (gig) => gig.media.length,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (gig) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/gigs/${gig.id}`}>Manage</Link>
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-2">
            <CardTitle>Gigs</CardTitle>
            <CardDescription>
              Every gig, newest first. Editing opens on its own page.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/admin/gigs/new">
              <Plus className="h-4 w-4" aria-hidden />
              Add gig
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4 max-w-sm">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            placeholder="Search by title, subtitle, or description…"
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
          storageKey="admin-gigs"
          emptyMessage={search ? "No gigs found" : "No gigs yet"}
        />
      </CardContent>
    </Card>
  );
}
