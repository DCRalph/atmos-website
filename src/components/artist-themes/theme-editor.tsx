"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { useConfirm } from "~/components/confirm-provider";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import {
  DEFAULT_THEME,
  parseTheme,
  type ArtistTheme,
} from "~/lib/artist-theme";
import { ProfilePreviewFrame } from "./profile-preview-frame";
import { ThemeControls } from "./theme-controls";

type Mode = "self" | "admin";

/**
 * Edit an artist theme: its layout and five looks, with the profile previewed
 * live beside the controls. Changes autosave. Artists preview their own
 * profile; admins (and artists without a profile yet) preview the sample.
 */
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
  const themeQ = api.artistThemes.getById.useQuery({ id: themeId });
  const mineQ = api.artistProfiles.getMine.useQuery(undefined, {
    enabled: mode === "self",
  });
  const theme = themeQ.data;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokens, setTokens] = useState<ArtistTheme>(DEFAULT_THEME);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!theme || initializedRef.current) return;
    setName(theme.name);
    setDescription(theme.description ?? "");
    setTokens(parseTheme(theme.tokens));
    initializedRef.current = true;
  }, [theme]);

  const updateMut = api.artistThemes.update.useMutation({
    onSuccess: () => {
      void utils.artistThemes.getById.invalidate({ id: themeId });
      void utils.artistThemes.listMine.invalidate();
      void utils.artistThemes.listAll.invalidate();
      void utils.artistThemes.listPublic.invalidate();
    },
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || !initializedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const save = async () => {
      setSaving(true);
      try {
        await updateMut.mutateAsync({
          id: themeId,
          data: { name, description: description || null, tokens },
        });
        setLastSavedAt(new Date());
        setDirty(false);
      } catch {
        // error rendered below
      } finally {
        setSaving(false);
      }
    };
    saveTimerRef.current = setTimeout(() => void save(), 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, description, tokens, themeId]);

  useUnsavedChangesWarning({ enabled: dirty });

  const setVisibilityMut = api.artistThemes.setVisibility.useMutation({
    onSuccess: () => {
      void utils.artistThemes.getById.invalidate({ id: themeId });
    },
  });
  const setSystemMut = api.artistThemes.setSystem.useMutation({
    onSuccess: () => {
      void utils.artistThemes.getById.invalidate({ id: themeId });
    },
  });
  const deleteMut = api.artistThemes.delete.useMutation({
    onSuccess: () => {
      void utils.artistThemes.listMine.invalidate();
      void utils.artistThemes.listAll.invalidate();
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
      mode === "admin" ? "/admin/artist-themes" : "/dashboard/themes",
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

  function patch(next: Partial<ArtistTheme>) {
    setTokens((prev) => ({ ...prev, ...next }));
    setDirty(true);
  }

  const ownHandle = mode === "self" ? mineQ.data?.handle : undefined;
  const previewSrc = ownHandle ? `/artist/${ownHandle}` : "/artist-preview";

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
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
            <div className="space-y-1">
              <Label htmlFor="theme-name">Name</Label>
              <Input
                id="theme-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="theme-description">Description</Label>
              <Textarea
                id="theme-description"
                rows={2}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
                maxLength={500}
              />
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
                Public (anyone can use it)
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
                  Starter theme
                </label>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive ml-auto"
                onClick={() => void handleDelete()}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </div>
            {updateMut.error && (
              <p className="text-destructive text-xs">
                {updateMut.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        <ThemeControls value={tokens} onChange={patch} />
      </div>

      <div className="xl:sticky xl:top-4">
        <ProfilePreviewFrame
          src={previewSrc}
          theme={tokens}
          label={
            ownHandle
              ? `Previewing @${ownHandle} with this theme`
              : "Previewing a sample profile with this theme"
          }
        />
      </div>
    </div>
  );
}
