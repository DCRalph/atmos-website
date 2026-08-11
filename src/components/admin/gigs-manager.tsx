"use client";

import { useState } from "react";
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
import { formatDateInUserTimezone, isGigUpcoming } from "~/lib/date-utils";
import Link from "next/link";

export function GigsManager() {
  const [search, setSearch] = useState("");
  const { data: gigs, isLoading } = api.gigs.getAll.useQuery(
    search ? { search } : undefined,
  );
  const rows = (gigs ?? []).filter((gig) => gig.gigStartTime);
  type GigRow = (typeof rows)[number];
  const columns: DataTableColumn<GigRow>[] = [
    {
      id: "start",
      header: "Start Time",
      cell: (gig) =>
        formatDateInUserTimezone(gig.gigStartTime, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
    },
    { id: "title", header: "Title", accessor: (row) => row.title },
    {
      id: "status",
      header: "Status",
      cell: (gig) =>
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
      accessor: (gig) => (gig.media as Array<{ id: string }>).length,
    },
    {
      id: "actions",
      header: "Actions",
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
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Gigs</CardTitle>
            <CardDescription>Manage upcoming and past gigs</CardDescription>
          </div>
          <Link href="/admin/gigs/new">
            <Button>Create New Gig</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by title, subtitle, or short/long description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
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
