"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { FilterSelect, ListFilters } from "~/components/admin/list-filters";
import { useConfirm } from "~/components/confirm-provider";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { parseTokens } from "~/lib/creator-theme";

type Visibility = "private" | "public" | "system";

const VISIBILITIES = [
  { value: "system", label: "Starters (system)" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
] as const satisfies readonly { value: Visibility; label: string }[];

export function AdminCreatorThemesList() {
  const router = useRouter();
  const utils = api.useUtils();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<Visibility | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();
  const listQ = api.creatorThemes.listAll.useQuery({
    search: debouncedSearch || undefined,
    visibility: visibility ?? "all",
  });

  const refresh = () => void utils.creatorThemes.listAll.invalidate();
  const onError = (error: { message: string }) => toast.error(error.message);

  const setVisibilityMut = api.creatorThemes.setVisibility.useMutation({
    onSuccess: refresh,
    onError,
  });
  const setSystemMut = api.creatorThemes.setSystem.useMutation({
    onSuccess: refresh,
    onError,
  });
  const deleteMut = api.creatorThemes.delete.useMutation({
    onSuccess: () => {
      toast.success("Theme deleted");
      refresh();
    },
    onError,
  });
  const createMut = api.creatorThemes.create.useMutation({
    onSuccess: (created) => {
      router.push(`/admin/creator-themes/${created.id}`);
    },
    onError,
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
      sortable: true,
      accessor: (theme) => theme.name,
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
      sortable: true,
      accessor: (theme) => theme.owner?.name ?? theme.owner?.email,
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
      type: "number",
      align: "right",
      sortable: true,
      accessor: (theme) => theme._count.profiles,
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
      header: "",
      align: "right",
      hideable: false,
      cell: (theme) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/creator-themes/${theme.id}`}>Edit</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${theme.name}`}
            disabled={deleteMut.isPending}
            className="text-destructive hover:text-destructive"
            onClick={() => void handleDelete(theme.id, theme.name)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            placeholder="Search themes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {listQ.isFetching ? (
            <Loader2
              className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin"
              aria-hidden
            />
          ) : null}
        </div>
        <ListFilters
          activeCount={visibility ? 1 : 0}
          onClear={() => setVisibility(null)}
        >
          <FilterSelect
            label="Visibility"
            value={visibility}
            onChange={setVisibility}
            options={VISIBILITIES}
            anyLabel="All"
          />
        </ListFilters>
        <div className="ml-auto">
          <Button
            onClick={() => createMut.mutate({ name: "New admin theme" })}
            disabled={createMut.isPending}
          >
            <Plus className="h-4 w-4" aria-hidden /> New theme
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
