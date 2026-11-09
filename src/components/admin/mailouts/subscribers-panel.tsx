"use client";

import { useState } from "react";
import { Download, Plus, Search, Upload } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { toCsv } from "~/lib/csv";
import { formatDate } from "~/lib/date-utils";
import { AddSubscriberDialog, ImportDialog } from "./subscriber-dialogs";
import { SubscriberSheet } from "./subscriber-sheet";

type Row = RouterOutputs["subscribers"]["list"][number];
type Status = "subscribed" | "left" | "suppressed";

const ALL = "all";

/** Everyone marketing can reach, filtered by list and status. */
export function SubscribersPanel() {
  const [search, setSearch] = useState("");
  const [listId, setListId] = useState<string>(ALL);
  const [status, setStatus] = useState<Status | typeof ALL>(ALL);
  const [open, setOpen] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);
  const debounced = useDebouncedValue(search).trim();

  const lists = api.mailingLists.list.useQuery();
  const subscribers = api.subscribers.list.useQuery({
    search: debounced || undefined,
    listId: listId === ALL ? undefined : listId,
    status: status === ALL ? undefined : status,
  });
  const rows = subscribers.data ?? [];
  const listName = (id: string) =>
    lists.data?.find((list) => list.id === id)?.name ?? "";

  const exportCsv = () => {
    const csv = toCsv([
      ["Email", "Lists", "Left", "Suppressed", "Added"],
      ...rows.map((row) => [
        row.email,
        row.memberships
          .filter((m) => !m.unsubscribedAt)
          .map((m) => listName(m.listId))
          .join("; "),
        row.memberships
          .filter((m) => m.unsubscribedAt)
          .map((m) => listName(m.listId))
          .join("; "),
        row.suppressedReason ?? "",
        row.createdAt.toISOString(),
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: DataTableColumn<Row>[] = [
    {
      id: "email",
      header: "Email",
      sortable: true,
      accessor: (row) => row.email,
      className: "font-medium",
    },
    {
      id: "lists",
      header: "Lists",
      accessor: (row) =>
        row.memberships.filter((m) => !m.unsubscribedAt).length,
      cell: (row) => {
        const on = row.memberships.filter((m) => !m.unsubscribedAt);
        const left = row.memberships.filter((m) => m.unsubscribedAt);
        return (
          <span className="text-sm">
            {on.map((m) => listName(m.listId)).join(", ")}
            {left.length > 0 && (
              <span className="text-muted-foreground">
                {on.length ? " · " : ""}left{" "}
                {left.map((m) => listName(m.listId)).join(", ")}
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: "suppressed",
      header: "Mail",
      sortable: true,
      accessor: (row) => row.suppressedReason ?? "",
      cell: (row) =>
        row.suppressedReason ? (
          <span className="text-destructive text-sm">
            {row.suppressedReason === "COMPLAINED" ? "Spam report" : "Bounced"}
          </span>
        ) : null,
    },
    {
      id: "createdAt",
      header: "Added",
      type: "date",
      sortable: true,
      accessor: (row) => row.createdAt,
      cell: (row) => formatDate(row.createdAt, "short"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            placeholder="Search by email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search by email"
          />
        </div>
        <Select value={listId} onValueChange={setListId}>
          <SelectTrigger className="w-44" aria-label="List">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Every list</SelectItem>
            {lists.data?.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status | typeof ALL)}
        >
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Anyone</SelectItem>
            <SelectItem value="subscribed">Subscribed</SelectItem>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="suppressed">Suppressed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setDialog("add")}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
        <Button variant="outline" onClick={() => setDialog("import")}>
          <Upload className="size-4" aria-hidden /> Import
        </Button>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          <Download className="size-4" aria-hidden /> Export
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        isLoading={subscribers.isPending}
        isFetching={subscribers.isFetching}
        onRowClick={(row) => setOpen(row.id)}
        enablePagination
        storageKey="admin-subscribers"
        emptyMessage={search ? "Nobody matches." : "Nobody yet."}
      />

      <SubscriberSheet id={open} onClose={() => setOpen(null)} />
      <AddSubscriberDialog
        open={dialog === "add"}
        onClose={() => setDialog(null)}
      />
      <ImportDialog
        open={dialog === "import"}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
