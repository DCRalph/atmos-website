"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
            onClick={() =>
              createMut.mutate({ name: "New admin theme" })
            }
            disabled={createMut.isPending}
          >
            <Plus className="mr-1 h-4 w-4" /> New theme
          </Button>
        </div>
      </div>

      {listQ.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading themes...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Preview</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Used by</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="w-44">Flags</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(listQ.data ?? []).map((t) => {
                const tokens = parseTokens(t.tokens);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div
                        className="h-7 w-10 overflow-hidden rounded border"
                        style={{ background: tokens.pageBg }}
                      >
                        <div className="flex h-full">
                          <div
                            className="w-1/3"
                            style={{ background: tokens.accent }}
                          />
                          <div
                            className="flex-1"
                            style={{ background: tokens.blockBg }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/creator-themes/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                      {t.description && (
                        <div className="text-muted-foreground line-clamp-1 text-xs">
                          {t.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.owner ? (
                        <Link
                          href={`/admin/users/${t.owner.id}`}
                          className="hover:underline"
                        >
                          {t.owner.name ?? t.owner.email ?? t.owner.id}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {t._count.profiles}
                      </span>
                    </TableCell>
                    <TableCell>
                      {t.isSystem ? (
                        <Badge variant="secondary">Starter</Badge>
                      ) : t.isPublic ? (
                        <Badge variant="secondary">Public</Badge>
                      ) : (
                        <Badge variant="outline">Private</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <label className="flex items-center gap-2">
                          <Switch
                            checked={t.isPublic}
                            onCheckedChange={(v) =>
                              setVisibilityMut.mutate({
                                id: t.id,
                                isPublic: v,
                              })
                            }
                          />
                          Public
                        </label>
                        <label className="flex items-center gap-2">
                          <Switch
                            checked={t.isSystem}
                            onCheckedChange={(v) =>
                              setSystemMut.mutate({
                                id: t.id,
                                isSystem: v,
                              })
                            }
                          />
                          System
                        </label>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/creator-themes/${t.id}`}>
                            Edit
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleDelete(t.id, t.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(listQ.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-8 text-center text-sm"
                  >
                    No themes match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
