"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Download, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

export function NewsletterManager() {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const {
    data: subscriptions,
    isLoading,
    refetch,
  } = api.newsletter.getAll.useQuery({
    search: search || undefined,
    includeRemoved: true,
  });
  const toggleRemoved = api.newsletter.toggleRemoved.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });
  const deleteSubscription = api.newsletter.delete.useMutation({
    onSuccess: () => {
      setDeleteTarget(null);
      void refetch();
    },
  });

  const exportToCSV = () => {
    if (!subscriptions || subscriptions.length === 0) {
      alert("No subscriptions to export");
      return;
    }

    // Create CSV header
    const headers = ["Email", "Subscribed Date", "Status"];
    const rows = subscriptions.map((sub) => [
      sub.email,
      sub.createdAt.toISOString(),
      sub.removed ? "Removed" : "Active",
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `newsletter-subscriptions-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const rows = subscriptions ?? [];
  type SubscriptionRow = (typeof rows)[number];
  const columns: DataTableColumn<SubscriptionRow>[] = [
    {
      id: "email",
      header: "Email",
      accessor: (row) => row.email,
      className: "font-medium",
    },
    {
      id: "subscribedAt",
      header: "Subscribed Date",
      cell: (row) => row.createdAt.toLocaleDateString(),
    },
    {
      id: "active",
      header: "Active",
      cell: (subscription) => (
        <Switch
          checked={!subscription.removed}
          onCheckedChange={(checked) => {
            toggleRemoved.mutate({ id: subscription.id, removed: !checked });
          }}
          disabled={toggleRemoved.isPending}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      hideable: false,
      cell: (subscription) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() =>
            setDeleteTarget({ id: subscription.id, email: subscription.email })
          }
          aria-label={`Delete ${subscription.email}`}
          disabled={deleteSubscription.isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Newsletter Subscriptions</CardTitle>
            <CardDescription>
              View and manage newsletter email subscriptions
            </CardDescription>
          </div>
          <Button
            onClick={exportToCSV}
            variant="outline"
            disabled={isLoading || !subscriptions || subscriptions.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by email..."
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
          storageKey="admin-newsletter-subscriptions"
          emptyMessage={
            search ? "No subscriptions found" : "No subscriptions yet"
          }
        />

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete subscription?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <span className="text-foreground font-medium">
                  {deleteTarget?.email ?? "this email"}
                </span>{" "}
                from the newsletter list. This action can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteSubscription.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!deleteTarget) return;
                  deleteSubscription.mutate({ id: deleteTarget.id });
                }}
                disabled={deleteSubscription.isPending}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                {deleteSubscription.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
