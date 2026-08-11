"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, Search, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

type TagsFieldProps = {
  tagIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
};

/**
 * Tag picker over the whole tag list. Every tag is fetched once and filtered in
 * the browser: there are few enough of them that a request per keystroke bought
 * nothing but latency, and having them all to hand is what lets an assigned tag
 * render as a coloured chip.
 */
export function TagsField({ tagIds, onChange, disabled }: TagsFieldProps) {
  const [search, setSearch] = useState("");
  const { data: allTags, isLoading } = api.gigTags.getAll.useQuery();

  const byId = useMemo(
    () => new Map((allTags ?? []).map((tag) => [tag.id, tag])),
    [allTags],
  );

  const assigned = tagIds.map((id) => ({ id, tag: byId.get(id) ?? null }));

  const available = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const selected = new Set(tagIds);
    return (allTags ?? []).filter(
      (tag) =>
        !selected.has(tag.id) &&
        (!needle ||
          tag.name.toLowerCase().includes(needle) ||
          (tag.description?.toLowerCase().includes(needle) ?? false)),
    );
  }, [allTags, search, tagIds]);

  const add = (id: string) => onChange([...tagIds, id]);
  const remove = (id: string) => onChange(tagIds.filter((t) => t !== id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>
          Categorise this gig. Changes save with the rest of the page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-2 block text-xs tracking-wide uppercase">
            Assigned
          </Label>
          <div className="flex flex-wrap gap-2">
            {assigned.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tags yet.</p>
            ) : (
              assigned.map(({ id, tag }) => (
                <span
                  key={id}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium"
                  style={
                    tag
                      ? {
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                          color: tag.color,
                        }
                      : undefined
                  }
                >
                  <span>{tag?.name ?? "Unknown tag"}</span>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    disabled={disabled}
                    className="hover:opacity-70 disabled:opacity-50"
                    aria-label={`Remove ${tag?.name ?? "tag"}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="border-t pt-4">
          <Label
            htmlFor="tag-search"
            className="mb-2 block text-xs tracking-wide uppercase"
          >
            Add tags
          </Label>
          <div className="relative mb-3">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="tag-search"
              placeholder="Filter tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={disabled}
              className="w-full pl-9"
            />
          </div>

          {isLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tags...
            </p>
          ) : available.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {available.map((tag) => (
                <Button
                  key={tag.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => add(tag.id)}
                  className="flex items-center gap-2"
                >
                  <span
                    className="h-3 w-3 rounded border"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                  <Plus className="h-3 w-3" />
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {search.trim()
                ? "No tags match that."
                : "Every tag is already assigned."}
            </p>
          )}

          <p className="text-muted-foreground mt-3 text-xs">
            Need a new tag?{" "}
            <Link
              href="/admin/gig-tags"
              target="_blank"
              className="hover:text-foreground inline-flex items-center gap-1 underline"
            >
              Manage gig tags
              <ExternalLink className="h-3 w-3" />
            </Link>{" "}
            — opens in a new tab so you keep your unsaved changes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
