"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
    setLinkType((item.linkType ?? "OTHER") as typeof linkType);
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>DJ</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`loading-${i}`}>
                  <TableCell colSpan={6}>
                    <div className="bg-muted h-8 w-full animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
              : contentItems?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.dj || "-"}</TableCell>
                  <TableCell>{item.platform || "-"}</TableCell>
                  <TableCell>{item.date.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Delete item",
                            description: "Are you sure you want to delete this item? This action cannot be undone.",
                            confirmLabel: "Delete",
                            variant: "destructive",
                          });
                          if (ok) {
                            deleteItem.mutate({ id: item.id });
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && contentItems?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  {search ? "No content items found" : "No content items yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
