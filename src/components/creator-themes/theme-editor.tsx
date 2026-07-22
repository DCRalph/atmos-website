"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { useConfirm } from "~/components/confirm-provider";
import {
  DEFAULT_BLOCK_OVERRIDES,
  DEFAULT_THEME_TOKENS,
  parseBlockOverrides,
  parseTokens,
  type BlockOverride,
  type BlockOverrides,
  type ThemeTokens,
} from "~/lib/creator-theme";
import { ThemeCanvas } from "./theme-canvas";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { type CreatorBlockTypeName } from "~/components/creator/block-types";
import { useRouter } from "next/navigation";

type Mode = "self" | "admin";

type ThemeLike = {
  id: string;
  name: string;
  description: string | null;
  ownerUserId: string | null;
  isPublic: boolean;
  isSystem: boolean;
  tokens: unknown;
  blockOverrides: unknown;
};

export function ThemeEditor({
  themeId,
  mode,
}: {
  themeId: string;
  mode: Mode;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const confirm = useConfirm();
  const themeQ = api.creatorThemes.getById.useQuery({ id: themeId });
  const theme = themeQ.data as ThemeLike | null | undefined;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [overrides, setOverrides] =
    useState<BlockOverrides>(DEFAULT_BLOCK_OVERRIDES);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!theme || initializedRef.current) return;
    setName(theme.name);
    setDescription(theme.description ?? "");
    setTokens(parseTokens(theme.tokens));
    setOverrides(parseBlockOverrides(theme.blockOverrides));
    initializedRef.current = true;
  }, [theme]);

  const updateMut = api.creatorThemes.update.useMutation({
    onSuccess: () => {
      void utils.creatorThemes.getById.invalidate({ id: themeId });
      void utils.creatorThemes.listMine.invalidate();
      void utils.creatorThemes.listAll.invalidate();
      void utils.creatorThemes.listPublic.invalidate();
    },
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || !initializedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateMut.mutateAsync({
          id: themeId,
          data: {
            name,
            description: description || null,
            tokens,
            blockOverrides: overrides,
          },
        });
        setLastSavedAt(new Date());
        setDirty(false);
      } catch {
        // error rendered below
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, description, tokens, overrides, themeId]);

  useUnsavedChangesWarning({ enabled: dirty });

  const setVisibilityMut = api.creatorThemes.setVisibility.useMutation({
    onSuccess: () => {
      void utils.creatorThemes.getById.invalidate({ id: themeId });
    },
  });
  const setSystemMut = api.creatorThemes.setSystem.useMutation({
    onSuccess: () => {
      void utils.creatorThemes.getById.invalidate({ id: themeId });
    },
  });
  const deleteMut = api.creatorThemes.delete.useMutation({
    onSuccess: () => {
      void utils.creatorThemes.listMine.invalidate();
      void utils.creatorThemes.listAll.invalidate();
    },
  });

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete theme?",
      description:
        "Profiles currently using this theme will fall back to the default theme.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteMut.mutateAsync({ id: themeId });
    router.push(
      mode === "admin" ? "/admin/creator-themes" : "/dashboard/themes",
    );
  }

  if (themeQ.isLoading || !theme) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading theme...
      </div>
    );
  }

  function patchTokens(patch: Partial<ThemeTokens>) {
    setTokens((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function patchOverride(
    type: CreatorBlockTypeName,
    patch: Partial<BlockOverride>,
  ) {
    setOverrides((prev) => {
      const current = prev[type] ?? {};
      const merged: BlockOverride = { ...current, ...patch };
      // Drop `undefined` keys to keep the JSON compact.
      for (const k of Object.keys(merged) as (keyof BlockOverride)[]) {
        if (merged[k] === undefined) delete merged[k];
      }
      const next: BlockOverrides = { ...prev, [type]: merged };
      if (Object.keys(merged).length === 0) {
        const { [type]: _omit, ...rest } = next;
        return rest;
      }
      return next;
    });
    setDirty(true);
  }

  function resetOverride(type: CreatorBlockTypeName) {
    setOverrides((prev) => {
      if (!prev[type]) return prev;
      const { [type]: _drop, ...rest } = prev;
      return rest;
    });
    setDirty(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Theme details</CardTitle>
            {theme.isSystem && <Badge variant="secondary">System</Badge>}
            {theme.isPublic && <Badge variant="secondary">Public</Badge>}
            {!theme.isPublic && !theme.isSystem && (
              <Badge variant="outline">Private</Badge>
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            ) : dirty ? (
              <span>Unsaved changes</span>
            ) : lastSavedAt ? (
              <span>Saved {lastSavedAt.toLocaleTimeString()}</span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
                maxLength={80}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
                maxLength={500}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={theme.isPublic}
                onCheckedChange={(v) =>
                  setVisibilityMut.mutate({ id: themeId, isPublic: v })
                }
                disabled={setVisibilityMut.isPending}
              />
              Public (anyone can use this theme)
            </label>
            {mode === "admin" && (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={theme.isSystem}
                  onCheckedChange={(v) =>
                    setSystemMut.mutate({ id: themeId, isSystem: v })
                  }
                  disabled={setSystemMut.isPending}
                />
                System theme (shown as starter)
              </label>
            )}
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void handleDelete()}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>

          {updateMut.error && (
            <p className="text-destructive text-xs">
              {updateMut.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="text-muted-foreground text-xs">
          Hover any part of the preview below to reveal edit controls.
        </div>
        <ThemeCanvas
          tokens={tokens}
          blockOverrides={overrides}
          editable
          onPatchTokens={patchTokens}
          onPatchOverride={patchOverride}
          onResetOverride={resetOverride}
          name={name || "Your creator name"}
        />
      </div>
    </div>
  );
}
