"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import {
  DEFAULT_THEME_TOKENS,
  parseTokens,
  type ThemeTokens,
} from "~/lib/creator-theme";

type ThemeCardRow = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isSystem: boolean;
  ownerUserId: string | null;
  tokens: unknown;
};

export function ThemePicker({
  selectedThemeId,
  onSelect,
  currentUserId,
}: {
  selectedThemeId: string | null;
  onSelect: (themeId: string | null) => void;
  /** Used to tell "my themes" apart from public ones in the "All" list if we ever merge. */
  currentUserId?: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const mineQ = api.creatorThemes.listMine.useQuery();
  const publicQ = api.creatorThemes.listPublic.useQuery({ includeSystem: true });
  const duplicateMut = api.creatorThemes.duplicate.useMutation({
    onSuccess: (created) => {
      void utils.creatorThemes.listMine.invalidate();
      router.push(`/dashboard/themes/${created.id}`);
    },
  });
  const [search, setSearch] = useState("");

  const lowerSearch = search.trim().toLowerCase();
  const filterFn = (rows: ThemeCardRow[] | undefined) =>
    (rows ?? []).filter(
      (t) =>
        !lowerSearch ||
        t.name.toLowerCase().includes(lowerSearch) ||
        (t.description ?? "").toLowerCase().includes(lowerSearch),
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search themes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={() => onSelect(null)}>
          Clear
        </Button>
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My themes</TabsTrigger>
          <TabsTrigger value="public">Public</TabsTrigger>
          <TabsTrigger value="system">Starters</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="pt-3">
          {mineQ.isLoading ? (
            <LoadingRow />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Link href="/dashboard/themes/new">
                <div className="hover:bg-accent/40 flex h-full min-h-[84px] items-center justify-center gap-2 rounded-md border border-dashed text-sm">
                  <Plus className="h-4 w-4" /> New theme
                </div>
              </Link>
              {filterFn(mineQ.data as ThemeCardRow[] | undefined).map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  selected={t.id === selectedThemeId}
                  onSelect={() => onSelect(t.id)}
                  canEdit
                />
              ))}
              {mineQ.data && mineQ.data.length === 0 && (
                <p className="text-muted-foreground col-span-full text-xs">
                  You don't have any themes yet.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="public" className="pt-3">
          {publicQ.isLoading ? (
            <LoadingRow />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filterFn(
                (publicQ.data as ThemeCardRow[] | undefined)?.filter(
                  (t) => !t.isSystem,
                ),
              ).map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  selected={t.id === selectedThemeId}
                  onSelect={() => onSelect(t.id)}
                  onDuplicate={() =>
                    duplicateMut.mutate({ id: t.id })
                  }
                  duplicating={duplicateMut.isPending}
                />
              ))}
              {(publicQ.data ?? []).filter((t) => !t.isSystem).length === 0 && (
                <p className="text-muted-foreground col-span-full text-xs">
                  No public themes yet.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="pt-3">
          {publicQ.isLoading ? (
            <LoadingRow />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filterFn(
                (publicQ.data as ThemeCardRow[] | undefined)?.filter(
                  (t) => t.isSystem,
                ),
              ).map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  selected={t.id === selectedThemeId}
                  onSelect={() => onSelect(t.id)}
                  onDuplicate={() =>
                    duplicateMut.mutate({ id: t.id })
                  }
                  duplicating={duplicateMut.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-3 text-xs">
      <Loader2 className="h-3 w-3 animate-spin" /> Loading...
    </div>
  );
}

function ThemeCard({
  theme,
  selected,
  onSelect,
  onDuplicate,
  duplicating,
  canEdit,
}: {
  theme: ThemeCardRow;
  selected: boolean;
  onSelect: () => void;
  onDuplicate?: () => void;
  duplicating?: boolean;
  canEdit?: boolean;
}) {
  const tokens = parseTokens(theme.tokens);
  return (
    <div
      className={`relative flex flex-col gap-2 rounded-md border p-2 transition ${
        selected
          ? "border-primary ring-primary/30 ring-2"
          : "hover:border-foreground/30"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 flex-col items-stretch gap-2 text-left"
      >
        <Swatch tokens={tokens} />
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{theme.name}</div>
            {theme.description && (
              <div className="text-muted-foreground line-clamp-1 text-[11px]">
                {theme.description}
              </div>
            )}
          </div>
          {selected && <Check className="text-primary h-4 w-4" />}
        </div>
        <div className="flex flex-wrap gap-1">
          {theme.isSystem && <Badge variant="secondary">Starter</Badge>}
          {theme.isPublic && !theme.isSystem && (
            <Badge variant="secondary">Public</Badge>
          )}
          {!theme.isPublic && !theme.isSystem && (
            <Badge variant="outline">Private</Badge>
          )}
        </div>
      </button>
      <div className="flex items-center gap-1">
        {canEdit && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/themes/${theme.id}`}>Edit</Link>
          </Button>
        )}
        {onDuplicate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            disabled={duplicating}
          >
            <Copy className="mr-1 h-3 w-3" /> Duplicate & customize
          </Button>
        )}
      </div>
    </div>
  );
}

function Swatch({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div
      className="h-12 w-full overflow-hidden rounded border"
      style={{
        background: tokens.pageBg,
        color: tokens.pageFg,
      }}
    >
      <div className="flex h-full items-stretch">
        <div
          className="w-1/3"
          style={{ background: tokens.accent }}
          aria-hidden="true"
        />
        <div className="flex-1 p-1.5">
          <div
            className="mb-1 h-2 w-10 rounded"
            style={{ background: tokens.blockBg, opacity: 0.9 }}
          />
          <div
            className="h-1.5 w-16 rounded"
            style={{ background: tokens.blockBorder }}
          />
        </div>
      </div>
    </div>
  );
}
