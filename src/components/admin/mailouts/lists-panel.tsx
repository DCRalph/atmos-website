"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

type Row = RouterOutputs["mailingLists"]["list"][number];

/** The mailing lists, with who is on each. A row opens it to edit. */
export function ListsPanel() {
  const lists = api.mailingLists.list.useQuery();
  const [editing, setEditing] = useState<Row | "new" | null>(null);

  const columns: DataTableColumn<Row>[] = [
    {
      id: "name",
      header: "List",
      sortable: true,
      accessor: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium">
            {row.name}
            {row.archivedAt && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · archived
              </span>
            )}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {row.public ? "Public" : "Private"}
            {row.description && ` · ${row.description}`}
          </p>
        </div>
      ),
    },
    {
      id: "subscribed",
      header: "Subscribed",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.subscribed,
    },
    {
      id: "joined30",
      header: "Joined, 30 days",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.joined30,
    },
    {
      id: "left",
      header: "Left",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.left,
    },
    {
      id: "suppressed",
      header: "Suppressed",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.suppressed,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> New list
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={lists.data ?? []}
        getRowId={(row) => row.id}
        isLoading={lists.isPending}
        onRowClick={setEditing}
        storageKey="admin-mailing-lists"
        emptyMessage="No lists yet."
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          {editing !== null && (
            <ListForm
              list={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListForm({ list, onDone }: { list: Row | null; onDone: () => void }) {
  const utils = api.useUtils();
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [isPublic, setIsPublic] = useState(list?.public ?? true);

  const onSuccess = () => {
    void utils.mailingLists.list.invalidate();
    onDone();
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const create = api.mailingLists.create.useMutation({ onSuccess, onError });
  const update = api.mailingLists.update.useMutation({ onSuccess, onError });
  const archive = api.mailingLists.archive.useMutation({ onSuccess, onError });
  const pending = create.isPending || update.isPending || archive.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const fields = {
      name,
      description: description.trim() || null,
      public: isPublic,
    };
    if (list) update.mutate({ id: list.id, ...fields });
    else create.mutate(fields);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{list ? "Edit list" : "New list"}</DialogTitle>
        <DialogDescription>
          The name and description are what people see when they choose what to
          get.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="list-name">Name</Label>
        <Input
          id="list-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wellington gigs"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="list-description">Description</Label>
        <Input
          id="list-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="When we announce a show in Wellington."
        />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="list-public">Public</Label>
          <p className="text-muted-foreground text-xs">
            Anyone can join from their preferences page. Private lists are only
            shown to people already on them.
          </p>
        </div>
        <Switch
          id="list-public"
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
      </div>
      <DialogFooter className="sm:justify-between">
        {list ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              archive.mutate({ id: list.id, archived: !list.archivedAt })
            }
          >
            {list.archivedAt ? "Restore" : "Archive"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {list ? "Save" : "Create list"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
