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
import {
  ContentItemDialog,
  type ContentLinkType,
} from "~/components/admin/content-item-dialog";
import { useConfirm } from "~/components/confirm-provider";

export function ContentManager() {
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [linkType, setLinkType] = useState<ContentLinkType>("OTHER");
  const [title, setTitle] = useState("");
  const [dj, setDj] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [link, setLink] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [search, setSearch] = useState("");

  const {
    data: contentItems,
    isLoading,
    refetch,
  } = api.content.getAll.useQuery(search ? { search } : undefined);
  const createItem = api.content.create.useMutation({
    onSuccess: async () => {
      await refetch();
      setIsOpen(false);
      resetForm();
    },
  });
  const updateItem = api.content.update.useMutation({
    onSuccess: async () => {
      await refetch();
      setIsOpen(false);
      resetForm();
    },
  });
  const deleteItem = api.content.delete.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setType("");
    setLinkType("OTHER");
    setTitle("");
    setDj("");
    setDescription("");
    setDate(undefined);
    setLink("");
    setEmbedUrl("");
    setPlatform("");
  };

  const handleEdit = (item: NonNullable<typeof contentItems>[0]) => {
    setEditingId(item.id);
    setType(item.type);
    setLinkType(item.linkType ?? "OTHER");
    setTitle(item.title);
    setDj(item.dj ?? "");
    setDescription(item.description);
    setDate(item.date);
    setLink(item.link);
    setEmbedUrl(item.embedUrl ?? "");
    setPlatform(item.platform ?? "");
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateItem.mutate({
        id: editingId,
        type,
        linkType,
        title,
        dj: dj || null,
        description,
        date: date,
        link,
        platform: platform || null,
        embedUrl: embedUrl || null,
      });
    } else {
      if (!date) return;
      createItem.mutate({
        type,
        linkType,
        title,
        dj: dj || undefined,
        description,
        date,
        link,
        platform: platform || undefined,
        embedUrl: embedUrl || undefined,
      });
    }
  };
  const rows = contentItems ?? [];
  type ContentRow = (typeof rows)[number];
  const columns: DataTableColumn<ContentRow>[] = [
    { id: "type", header: "Type", accessor: (row) => row.type },
    { id: "title", header: "Title", accessor: (row) => row.title },
    { id: "dj", header: "DJ", cell: (row) => row.dj ?? "—" },
    { id: "platform", header: "Platform", cell: (row) => row.platform ?? "—" },
    {
      id: "date",
      header: "Date",
      cell: (row) => row.date.toLocaleDateString(),
    },
    {
      id: "actions",
      header: "Actions",
      hideable: false,
      cell: (item) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete item",
                description:
                  "Are you sure you want to delete this item? This action cannot be undone.",
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
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Content Items</CardTitle>
            <CardDescription>
              Manage content items (mixes, videos, playlists)
            </CardDescription>
          </div>
          <ContentItemDialog
            open={isOpen}
            editingId={editingId}
            type={type}
            linkType={linkType}
            title={title}
            dj={dj}
            description={description}
            date={date}
            link={link}
            embedUrl={embedUrl}
            platform={platform}
            isPending={createItem.isPending || updateItem.isPending}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
            onResetForm={resetForm}
            onSubmit={handleSubmit}
            onTypeChange={setType}
            onLinkTypeChange={setLinkType}
            onTitleChange={setTitle}
            onDjChange={setDj}
            onDescriptionChange={setDescription}
            onDateChange={setDate}
            onLinkChange={setLink}
            onEmbedUrlChange={setEmbedUrl}
            onPlatformChange={setPlatform}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by type, title, description, DJ, or platform..."
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
          storageKey="admin-content-items"
          emptyMessage={
            search ? "No content items found" : "No content items yet"
          }
        />
      </CardContent>
    </Card>
  );
}
