"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useConfirm } from "~/components/confirm-provider";
import { parseTokens } from "~/lib/creator-theme";

type Visibility = "all" | "private" | "public" | "system";

export function AdminCreatorThemesList() {
  const router = useRouter();
  const utils = api.useUtils();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");

  const listQ = api.creatorThemes.listAll.useQuery({
    search: search.trim() || undefined,
    visibility,
  });

  const setVisibilityMut = api.creatorThemes.setVisibility.useMutation({
    onSuccess: () => utils.creatorThemes.listAll.invalidate(),
  });
  const setSystemMut = api.creatorThemes.setSystem.useMutation({
    onSuccess: () => utils.creatorThemes.listAll.invalidate(),
  });
  const deleteMut = api.creatorThemes.delete.useMutation({
    onSuccess: () => utils.creatorThemes.listAll.invalidate(),
  });
  const createMut = api.creatorThemes.create.useMutation({
    onSuccess: (created) => {
      router.push(`/admin/creator-themes/${created.id}`);
    },
  });

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      description:
        "Profiles using this theme will fall back to the default theme.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteMut.mutateAsync({ id });
  }
  const themes = listQ.data ?? [];
  type ThemeRow = (typeof themes)[number];
  const columns: DataTableColumn<ThemeRow>[] = [
    {
      id: "preview",
      header: "Preview",
      cell: (theme) => {
        const tokens = parseTokens(theme.tokens);
        return (
          <div
            className="h-7 w-10 overflow-hidden rounded border"
            style={{ background: tokens.pageBg }}
          >
            <div className="flex h-full">
              <div className="w-1/3" style={{ background: tokens.accent }} />
              <div className="flex-1" style={{ background: tokens.blockBg }} />
            </div>
          </div>
        );
      },
    },
    {
      id: "name",
      header: "Name",
      cell: (theme) => (
        <>
          <Link
            href={`/admin/creator-themes/${theme.id}`}
            className="font-medium hover:underline"
          >
            {theme.name}
          </Link>
          {theme.description && (
            <div className="text-muted-foreground line-clamp-1 text-xs">
              {theme.description}
            </div>
          )}
        </>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      className: "text-sm",
      cell: (theme) =>
        theme.owner ? (
          <Link
            href={`/admin/users/${theme.owner.id}`}
            className="hover:underline"
          >
            {theme.owner.name ?? theme.owner.email ?? theme.owner.id}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "usedBy",
      header: "Used by",
      cell: (theme) => (
        <span className="font-mono text-xs">{theme._count.profiles}</span>
      ),
    },
    {
      id: "visibility",
      header: "Visibility",
      cell: (theme) =>
        theme.isSystem ? (
          <Badge variant="secondary">Starter</Badge>
        ) : theme.isPublic ? (
          <Badge variant="secondary">Public</Badge>
        ) : (
          <Badge variant="outline">Private</Badge>
        ),
    },
    {
      id: "flags",
      header: "Flags",
      cell: (theme) => (
        <div className="flex flex-col gap-1 text-xs">
          <label className="flex items-center gap-2">
            <Switch
              checked={theme.isPublic}
              onCheckedChange={(value) =>
                setVisibilityMut.mutate({ id: theme.id, isPublic: value })
              }
            />
            Public
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={theme.isSystem}
              onCheckedChange={(value) =>
                setSystemMut.mutate({ id: theme.id, isSystem: value })
              }
            />
            System
          </label>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      hideable: false,
      cell: (theme) => (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/creator-themes/${theme.id}`}>Edit</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => void handleDelete(theme.id, theme.name)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search themes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={visibility}
          onValueChange={(v) => setVisibility(v as Visibility)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="system">Starters (system)</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button
            onClick={() => createMut.mutate({ name: "New admin theme" })}
            disabled={createMut.isPending}
          >
            <Plus className="mr-1 h-4 w-4" /> New theme
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={themes}
        getRowId={(row) => row.id}
        isLoading={listQ.isLoading}
        storageKey="admin-creator-themes"
        emptyMessage="No themes match these filters."
      />
    </div>
  );
}
