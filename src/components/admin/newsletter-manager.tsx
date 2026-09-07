"use client";

import { useState } from "react";
import { Download, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Card, CardContent } from "~/components/ui/card";
import { useConfirm } from "~/components/confirm-provider";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { formatDate } from "~/lib/date-utils";

export function NewsletterManager() {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();

  const {
    data: subscriptions,
    isLoading,
    isFetching,
    refetch,
  } = api.newsletter.getAll.useQuery({
    search: debouncedSearch || undefined,
    includeRemoved: true,
  });

  const toggleRemoved = api.newsletter.toggleRemoved.useMutation({
    onSuccess: () => void refetch(),
    onError: (error) => toast.error(error.message),
  });

  const deleteSubscription = api.newsletter.delete.useMutation({
    onSuccess: () => {
      toast.success("Subscriber deleted");
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = subscriptions ?? [];
  type SubscriptionRow = (typeof rows)[number];

  const exportToCSV = () => {
    if (rows.length === 0) {
      toast.error("No subscriptions to export");
      return;
    }

    const cells = [
      ["Email", "Subscribed", "Status"],
      ...rows.map((sub) => [
        sub.email,
        sub.createdAt.toISOString(),
        sub.removed ? "Removed" : "Active",
      ]),
    ];
    const csv = cells
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `newsletter-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // The blob stays in memory until it is let go of, and this runs on every
    // export.
    URL.revokeObjectURL(url);
  };

  const columns: DataTableColumn<SubscriptionRow>[] = [
    {
      id: "email",
      header: "Email",
      type: "email",
      sortable: true,
      accessor: (row) => row.email,
      className: "font-medium",
    },
    {
      id: "subscribedAt",
      header: "Subscribed",
      sortable: true,
      accessor: (row) => row.createdAt,
      cell: (row) => formatDate(row.createdAt, "short"),
    },
    {
      id: "active",
      header: "Active",
      sortable: true,
      accessor: (row) => !row.removed,
      cell: (subscription) => (
        <Switch
          checked={!subscription.removed}
          aria-label={`${subscription.removed ? "Resubscribe" : "Unsubscribe"} ${subscription.email}`}
          onCheckedChange={(checked) =>
            toggleRemoved.mutate({ id: subscription.id, removed: !checked })
          }
          disabled={toggleRemoved.isPending}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (subscription) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${subscription.email}`}
          disabled={deleteSubscription.isPending}
          onClick={async () => {
            const ok = await confirm({
              title: "Delete subscription?",
              description: `This permanently removes ${subscription.email} from the newsletter list. Switch them off under Active instead if you only want to stop sending.`,
              confirmLabel: "Delete",
              variant: "destructive",
            });
            if (ok) deleteSubscription.mutate({ id: subscription.id });
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              placeholder="Search by email…"
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
          <Button
            onClick={exportToCSV}
            variant="outline"
            disabled={isLoading || rows.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          storageKey="admin-newsletter-subscriptions"
          emptyMessage={
            search ? "No subscriptions found" : "No subscriptions yet"
          }
        />
      </CardContent>
    </Card>
  );
}
