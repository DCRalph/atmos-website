"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { LinkForm } from "~/components/admin/short-links/link-form";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { formatDate } from "~/lib/date-utils";

type LinkRow = RouterOutputs["shortLinks"]["list"][number];

/**
 * Short links. One path that can point anywhere, so a flyer, a story sticker
 * and a bio link all survive the destination changing, and every hit is
 * counted on the way through.
 */
export default function ShortLinksPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const utils = api.useUtils();
  const links = api.shortLinks.list.useQuery();

  const setActive = api.shortLinks.setActive.useMutation({
    onSuccess: () => void utils.shortLinks.list.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  const columns: DataTableColumn<LinkRow>[] = [
    {
      id: "link",
      header: "Link",
      sortable: true,
      accessor: (row) => `${row.domain}/${row.slug}`,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-mono font-medium">
            <span className="text-muted-foreground">{row.domain}/</span>
            {row.slug}
          </p>
          {row.label && (
            <p className="text-muted-foreground truncate text-xs">
              {row.label}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "destination",
      header: "Goes to",
      accessor: (row) => row.destination,
      cell: (row) => (
        <span className="text-muted-foreground block max-w-80 truncate text-sm">
          {row.destination}
        </span>
      ),
    },
    {
      id: "clicks",
      header: "Clicks",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.clicks,
    },
    {
      id: "visitors",
      header: "People",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.visitors,
    },
    {
      id: "lastClickAt",
      header: "Last click",
      type: "date",
      sortable: true,
      accessor: (row) => row.lastClickAt,
      cell: (row) =>
        row.lastClickAt ? formatDate(row.lastClickAt, "short") : "—",
    },
    {
      id: "active",
      header: "Live",
      sortable: true,
      accessor: (row) => row.active,
      cell: (row) => (
        // The row opens the link's page; the switch shouldn't.
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={row.active}
            aria-label={`${row.active ? "Switch off" : "Switch on"} ${row.slug}`}
            onCheckedChange={(active) =>
              setActive.mutate({ id: row.id, active })
            }
          />
        </div>
      ),
    },
  ];

  return (
    <AdminSection
      title="Links"
      description="Short links for posters, stories and bios. Change where one goes without reprinting anything."
      actions={
        <Button onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="size-4" aria-hidden /> New link
        </Button>
      }
    >
      {creating && (
        <LinkForm
          onSaved={(saved) => router.push(`/admin/links/${saved.id}`)}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="mt-4">
        <DataTable
          columns={columns}
          data={links.data ?? []}
          getRowId={(row) => row.id}
          isLoading={links.isPending}
          isFetching={links.isFetching}
          onRowClick={(row) => router.push(`/admin/links/${row.id}`)}
          storageKey="admin-short-links"
          emptyMessage="No links yet."
        />
      </div>
    </AdminSection>
  );
}
