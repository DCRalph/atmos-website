"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useConfirm } from "~/components/confirm-provider";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { findPlatform } from "~/lib/content-platforms";
import { formatDate } from "~/lib/date-utils";

/**
 * The content list. Editing lives on its own page (`/admin/content/[id]`), so
 * this is a table and nothing else — no form state, no dialog plumbing.
 */
export function ContentManager() {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const {
    data: contentItems,
    isLoading,
    isFetching,
    refetch,
  } = api.content.getAll.useQuery(
    debouncedSearch.trim() ? { search: debouncedSearch.trim() } : undefined,
  );

  const deleteItem = api.content.delete.useMutation({
    onSuccess: async () => {
      toast.success("Deleted");
      await refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = contentItems ?? [];
  type ContentRow = (typeof rows)[number];
  const columns: DataTableColumn<ContentRow>[] = [
    {
      id: "type",
      header: "Type",
      sortable: true,
      accessor: (row) => row.type,
    },
    {
      id: "title",
      header: "Title",
      sortable: true,
      accessor: (row) => row.title,
      cell: (row) => (
        <Link
          href={`/admin/content/${row.id}`}
          className="text-primary font-medium hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      id: "dj",
      header: "DJ",
      sortable: true,
      accessor: (row) => row.dj,
      cell: (row) => row.dj ?? "—",
    },
    {
      id: "platform",
      header: "Platform",
      sortable: true,
      accessor: (row) => row.platform,
      cell: (row) =>
        row.platform ? (
          <span className="flex items-center gap-1.5">
            {row.platform}
            {findPlatform(row.platform) ? null : (
              // The public card looks the icon up by this exact string, so a
              // typo or wrong casing silently renders nothing. Surface it here
              // rather than leaving it to be spotted on the live site.
              <Tooltip>
                <TooltipTrigger asChild>
                  <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  No icon or colour matches &quot;{row.platform}&quot;
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "date",
      header: "Date",
      sortable: true,
      accessor: (row) => row.date,
      cell: (row) => formatDate(row.date, "short"),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (item) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              title="Open link"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/content/${item.id}`}>Edit</Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteItem.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: "Delete item",
                description: `Delete "${item.title}"? This also removes it from any Home placements and cannot be undone.`,
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) deleteItem.mutate({ id: item.id });
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-2">
            <CardTitle>Content items</CardTitle>
            <CardDescription>
              Mixes, videos and playlists. Editing opens on its own page.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/admin/content/new">
              <Plus className="h-4 w-4" />
              Add content
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4 max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by type, title, description, DJ, or platform..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {isFetching ? (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
          ) : null}
        </div>
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          isFetching={isFetching}
          storageKey="admin-content-items"
          emptyMessage={
            search ? "No content items found" : "No content items yet"
          }
        />
      </CardContent>
    </Card>
  );
}
