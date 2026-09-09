"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";

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
import { GigStatusBadge } from "~/components/admin/gig-status-badge";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { formatDateTime } from "~/lib/date-utils";

/**
 * The gigs list.
 *
 * Drafts live in the same table as everything else rather than in a separate
 * screen, and the tab is a filter over it. An imported gig that was never
 * finished should be one click from where gigs are, not somewhere it can be
 * forgotten about.
 */
export function GigsManager({
  /** The Drafts tab. Everything else about the table is identical. */
  onlyDrafts = false,
}: {
  onlyDrafts?: boolean;
} = {}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();
  const {
    data: gigs,
    isLoading,
    isFetching,
  } = api.gigs.getAll.useQuery(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  );

  const all = gigs ?? [];
  const rows = useMemo(
    () => (onlyDrafts ? all.filter((gig) => gig.status === "DRAFT") : all),
    [all, onlyDrafts],
  );
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
      accessor: (gig) => gig.status,
      cell: (gig) => (
        <GigStatusBadge
          status={gig.status}
          startsAt={gig.gigStartTime}
          endsAt={gig.gigEndTime}
        />
      ),
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
            <CardTitle>{onlyDrafts ? "Drafts" : "Gigs"}</CardTitle>
            <CardDescription>
              {onlyDrafts
                ? "Imported gigs that have not been published. Nobody but an admin can see these."
                : "Every gig, newest first. Editing opens on its own page."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/gigs/import">
                <FaInstagram className="h-4 w-4" aria-hidden />
                Import from Instagram
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/gigs/new">
                <Plus className="h-4 w-4" aria-hidden />
                Add gig
              </Link>
            </Button>
          </div>
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
          storageKey={onlyDrafts ? "admin-gig-drafts" : "admin-gigs"}
          emptyMessage={
            search
              ? "No gigs found"
              : onlyDrafts
                ? "Nothing waiting to be published"
                : "No gigs yet"
          }
        />
      </CardContent>
    </Card>
  );
}
