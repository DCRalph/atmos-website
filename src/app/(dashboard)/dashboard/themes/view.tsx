"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { parseTokens } from "~/lib/creator-theme";

export function DashboardThemesView() {
  const router = useRouter();
  const mineQ = api.creatorThemes.listMine.useQuery();
  const publicQ = api.creatorThemes.listPublic.useQuery({
    includeSystem: true,
  });
  const createMut = api.creatorThemes.create.useMutation({
    onSuccess: (created) => {
      router.push(`/dashboard/themes/${created.id}`);
    },
  });

  return (
    <div className="bg-background min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Themes</h1>
          <div className="ml-auto">
            <Button
              onClick={() =>
                createMut.mutate({ name: "New theme" })
              }
              disabled={createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              New theme
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">My themes</CardTitle>
          </CardHeader>
          <CardContent>
            {mineQ.isLoading ? (
              <Loading />
            ) : mineQ.data && mineQ.data.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mineQ.data.map((t) => (
                  <ThemeSummaryCard
                    key={t.id}
                    theme={t}
                    href={`/dashboard/themes/${t.id}`}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                You don't have any themes yet. Create one or duplicate a public
                theme below.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Browse public & starters</CardTitle>
          </CardHeader>
          <CardContent>
            {publicQ.isLoading ? (
              <Loading />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(publicQ.data ?? []).map((t) => (
                  <ThemeSummaryCard
                    key={t.id}
                    theme={t}
                    // public themes aren't editable; link to your profile with
                    // themeId query to select
                    href={`/dashboard/themes?browse=${t.id}`}
                    disableEdit
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
    </div>
  );
}

function ThemeSummaryCard({
  theme,
  href,
  disableEdit,
}: {
  theme: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    isSystem: boolean;
    tokens: unknown;
  };
  href: string;
  disableEdit?: boolean;
}) {
  const tokens = parseTokens(theme.tokens);
  return (
    <Link
      href={href}
      className="hover:border-foreground/30 block rounded-md border p-3 transition"
    >
      <div
        className="mb-2 h-14 w-full overflow-hidden rounded border"
        style={{ background: tokens.pageBg, color: tokens.pageFg }}
      >
        <div className="flex h-full">
          <div
            className="w-1/4"
            style={{ background: tokens.accent }}
            aria-hidden="true"
          />
          <div className="flex-1 p-2">
            <div
              className="mb-1 h-2 w-12 rounded"
              style={{ background: tokens.blockBg, opacity: 0.9 }}
            />
            <div
              className="h-1.5 w-20 rounded"
              style={{ background: tokens.blockBorder }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{theme.name}</div>
          {theme.description && (
            <div className="text-muted-foreground line-clamp-1 text-[11px]">
              {theme.description}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {theme.isSystem && <Badge variant="secondary">Starter</Badge>}
          {theme.isPublic && !theme.isSystem && (
            <Badge variant="secondary">Public</Badge>
          )}
          {!theme.isPublic && !theme.isSystem && (
            <Badge variant="outline">Private</Badge>
          )}
        </div>
      </div>
      {disableEdit && (
        <p className="text-muted-foreground mt-2 text-[11px]">
          Read-only · use the picker in your profile or duplicate from there.
        </p>
      )}
    </Link>
  );
}
