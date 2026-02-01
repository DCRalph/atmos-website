"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DatePicker } from "~/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function ContentManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [linkType, setLinkType] = useState<
    "SOUNDCLOUD_TRACK" | "SOUNDCLOUD_PLAYLIST" | "OTHER"
  >("OTHER");
  const [title, setTitle] = useState("");
  const [dj, setDj] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [link, setLink] = useState("");
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
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>Add Content</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit" : "Add"} Content Item
                </DialogTitle>
                <DialogDescription>
                  {editingId ? "Update" : "Create"} a new content item
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Input
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="mix, video, playlist"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="platform">Platform (optional)</Label>
                  <Input
                    id="platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    placeholder="SoundCloud, Spotify, YouTube, etc."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="dj">DJ (optional)</Label>
                  <Input
                    id="dj"
                    value={dj}
                    onChange={(e) => setDj(e.target.value)}
                    placeholder="DJ name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="date">Date</Label>
                  <DatePicker
                    date={date}
                    onDateChange={setDate}
                    placeholder="Select a date"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Link type</Label>
                  <Select
                    value={linkType}
                    onValueChange={(v) => setLinkType(v as typeof linkType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select link type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OTHER">Other</SelectItem>
                      <SelectItem value="SOUNDCLOUD_TRACK">
                        SoundCloud track
                      </SelectItem>
                      <SelectItem value="SOUNDCLOUD_PLAYLIST">
                        SoundCloud playlist
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="link">Link</Label>
                  <Input
                    id="link"
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createItem.isPending || updateItem.isPending}
                >
                  {editingId ? "Update" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this item?",
                            )
                          ) {
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
