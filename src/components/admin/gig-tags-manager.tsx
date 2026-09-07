"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Card, CardContent } from "~/components/ui/card";
import { useConfirm } from "~/components/confirm-provider";

const DEFAULT_COLOUR = "#FFFFFF";
const isHexColour = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export function GigTagsManager() {
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colour, setColour] = useState(DEFAULT_COLOUR);

  const {
    data: tags,
    isLoading,
    isFetching,
    refetch,
  } = api.gigTags.getAll.useQuery();

  const onSaved = async (message: string) => {
    toast.success(message);
    await refetch();
    setIsOpen(false);
    resetForm();
  };

  const createTag = api.gigTags.create.useMutation({
    onSuccess: () => onSaved("Tag created"),
    onError: (error) => toast.error(error.message),
  });
  const updateTag = api.gigTags.update.useMutation({
    onSuccess: () => onSaved("Tag updated"),
    onError: (error) => toast.error(error.message),
  });
  const deleteTag = api.gigTags.delete.useMutation({
    onSuccess: async () => {
      toast.success("Tag deleted");
      await refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setColour(DEFAULT_COLOUR);
  };

  const handleEdit = (tag: NonNullable<typeof tags>[number]) => {
    setEditingId(tag.id);
    setName(tag.name);
    setDescription(tag.description ?? "");
    setColour(tag.color);
    setIsOpen(true);
  };

  const canSubmit = name.trim().length > 0 && isHexColour(colour);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (editingId) {
      updateTag.mutate({
        id: editingId,
        name,
        description: description || null,
        color: colour,
      });
    } else {
      createTag.mutate({
        name,
        description: description || undefined,
        color: colour,
      });
    }
  };

  const rows = tags ?? [];
  type TagRow = (typeof rows)[number];
  const columns: DataTableColumn<TagRow>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      accessor: (row) => row.name,
      className: "font-medium",
    },
    {
      id: "description",
      header: "Description",
      sortable: true,
      accessor: (row) => row.description,
      cell: (row) => row.description ?? "—",
    },
    {
      id: "colour",
      header: "Colour",
      sortable: true,
      accessor: (row) => row.color,
      cell: (tag) => (
        <div className="flex items-center gap-2">
          <div
            className="border-border size-6 rounded border"
            style={{ backgroundColor: tag.color }}
          />
          <span className="text-muted-foreground font-mono text-sm">
            {tag.color}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (tag) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => handleEdit(tag)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteTag.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${tag.name}?`,
                description:
                  "The tag comes off every gig carrying it. This cannot be undone.",
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) deleteTag.mutate({ id: tag.id });
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
      <CardContent className="space-y-4 pt-6">
        <div className="flex justify-end">
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4" aria-hidden />
                Add tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit gig tag" : "Add gig tag"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Changes apply everywhere this tag is already used."
                    : "Tags group gigs together and carry a colour used wherever they are shown."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tag-name">Name</Label>
                  <Input
                    id="tag-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tag-description">Description</Label>
                  <Textarea
                    id="tag-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                  <p className="text-muted-foreground text-xs">Optional.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tag-colour">Colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Colour picker"
                      value={isHexColour(colour) ? colour : DEFAULT_COLOUR}
                      onChange={(e) => setColour(e.target.value.toUpperCase())}
                      className="border-border size-9 shrink-0 cursor-pointer rounded border bg-transparent p-1"
                    />
                    <Input
                      id="tag-colour"
                      value={colour}
                      onChange={(e) => setColour(e.target.value)}
                      placeholder={DEFAULT_COLOUR}
                      className={`font-mono ${isHexColour(colour) ? "" : "border-destructive"}`}
                      required
                    />
                  </div>
                  {!isHexColour(colour) && (
                    <p className="text-destructive text-xs">
                      Six-digit hex, like {DEFAULT_COLOUR}.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit || createTag.isPending || updateTag.isPending
                    }
                  >
                    {editingId ? "Save" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          isFetching={isFetching}
          storageKey="admin-gig-tags"
          emptyMessage="No gig tags yet"
        />
      </CardContent>
    </Card>
  );
}
