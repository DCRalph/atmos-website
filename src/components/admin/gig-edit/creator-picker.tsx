"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { api } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { buildMediaUrl } from "~/lib/media-url";
import { cn } from "~/lib/utils";
import { CreatorQuickCreateDialog } from "./creator-quick-create-dialog";
import type { PickedCreator } from "./types";

/**
 * Putting somebody on the bill.
 *
 * Lifted out of the old line-up card unchanged, because the searching was the
 * good part of it: prefix matches first, arrow keys, and a way to create a
 * profile without leaving the gig. What changed is where it lives — a popover
 * hung off "Add artist" rather than a permanent search box, so the run sheet
 * stays a run sheet and does not carry an empty search field down the page.
 */

/** The "create a new profile" entry, treated as one more row for the keyboard. */
const CREATE_ROW = "__create__";

export function CreatorPicker({
  excludeIds,
  onPick,
  disabled,
  label = "Add artist",
  compact = false,
}: {
  /** Profiles to keep out of the results and the count. */
  excludeIds: string[];
  onPick: (creator: PickedCreator) => void;
  disabled?: boolean;
  label?: string;
  /** The inline "b2b" trigger inside a slot, rather than a button of its own. */
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query);
  const search = api.lineUp.searchProfiles.useQuery(
    { query: debouncedQuery, excludeIds, limit: 20 },
    {
      enabled: isOpen,
      // Keep the previous page on screen while the next one loads, so the list
      // does not blink empty between keystrokes.
      placeholderData: (previous) => previous,
    },
  );

  const assigned = new Set(excludeIds);
  const results = (search.data?.profiles ?? []).filter(
    (profile) => !assigned.has(profile.id),
  );
  const total = search.data?.total ?? 0;
  const isRecent = search.data?.isRecent ?? false;
  const canCreate = query.trim().length > 0;

  /** Rows the keyboard walks: profile ids, then the create action. */
  const rows: string[] = [
    ...results.map((profile) => profile.id),
    ...(canCreate ? [CREATE_ROW] : []),
  ];
  const safeIndex = Math.min(activeIndex, Math.max(rows.length - 1, 0));

  const pick = (creator: PickedCreator) => {
    onPick(creator);
    setQuery("");
    setActiveIndex(0);
    searchRef.current?.focus();
  };

  const commitRow = (row: string) => {
    if (row === CREATE_ROW) {
      setIsCreateOpen(true);
      return;
    }
    const profile = results.find((candidate) => candidate.id === row);
    if (!profile) return;
    pick({
      creatorProfileId: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarFileId: profile.avatarFileId,
      claimStatus: profile.claimStatus,
      isPublished: profile.isPublished,
    });
  };

  const onSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (safeIndex + delta + rows.length) % rows.length;
      setActiveIndex(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[safeIndex];
      if (row) commitRow(row);
      return;
    }
    if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={compact ? "ghost" : "outline"}
            disabled={disabled}
            className={cn(compact && "text-muted-foreground h-6 px-1.5 text-xs")}
          >
            <Plus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-96 p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              ref={searchRef}
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="creator-search-results"
              aria-autocomplete="list"
              placeholder="Search by name or handle..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              className="w-full pr-9 pl-9"
            />
            {search.isFetching ? (
              <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
            ) : null}
          </div>

          <div
            ref={listRef}
            id="creator-search-results"
            role="listbox"
            className="mt-2 max-h-72 overflow-y-auto"
          >
            {isRecent && results.length > 0 ? (
              <p className="text-muted-foreground px-2 py-1.5 text-xs">
                Recently updated profiles
              </p>
            ) : null}

            {results.map((profile, index) => (
              <div
                key={profile.id}
                data-index={index}
                role="option"
                aria-selected={index === safeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitRow(profile.id)}
                onPointerEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm",
                  index === safeIndex && "bg-accent",
                )}
              >
                <CreatorAvatar
                  fileId={profile.avatarFileId}
                  name={profile.displayName}
                  size={28}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {profile.displayName}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    @{profile.handle}
                  </span>
                </span>
                <CreatorStatusBadges
                  claimStatus={profile.claimStatus}
                  isPublished={profile.isPublished}
                />
              </div>
            ))}

            {results.length === 0 && !search.isFetching ? (
              <p className="text-muted-foreground px-2 py-3 text-sm">
                {query.trim()
                  ? `No profile matches "${query.trim()}".`
                  : "No profiles yet."}
              </p>
            ) : null}

            {canCreate ? (
              <div
                data-index={rows.length - 1}
                role="option"
                aria-selected={safeIndex === rows.length - 1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitRow(CREATE_ROW)}
                onPointerEnter={() => setActiveIndex(rows.length - 1)}
                className={cn(
                  "mt-1 flex cursor-pointer items-center gap-2 rounded-sm border-t px-2 py-2 text-sm",
                  safeIndex === rows.length - 1 && "bg-accent",
                )}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Create{" "}
                  <span className="font-medium">
                    &quot;{query.trim()}&quot;
                  </span>{" "}
                  as a new profile
                </span>
              </div>
            ) : null}

            {/* `total` already excludes who is on the bill. */}
            {total > results.length ? (
              <p className="text-muted-foreground border-t px-2 py-2 text-xs">
                Showing {results.length} of {total}. Keep typing to narrow it
                down.
              </p>
            ) : null}
          </div>

          <p className="text-muted-foreground border-t px-2 pt-2 text-xs">
            Profiles are managed on the{" "}
            <Link
              href="/admin/creator-profiles"
              target="_blank"
              className="hover:text-foreground underline"
            >
              creator profiles
            </Link>{" "}
            page.
          </p>
        </PopoverContent>
      </Popover>

      <CreatorQuickCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        initialName={query.trim()}
        onCreated={(creator) => {
          pick(creator);
          void search.refetch();
        }}
      />
    </>
  );
}

export function CreatorAvatar({
  fileId,
  name,
  size,
}: {
  fileId: string | null;
  name: string;
  size: number;
}) {
  return (
    <span
      className="bg-muted relative shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {fileId ? (
        // A plain img on purpose: these are small, already-cached /api/media
        // responses, so the image optimiser adds a hop and an allowlist to keep
        // in sync for no gain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={buildMediaUrl(fileId)}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-bold">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function CreatorStatusBadges({
  claimStatus,
  isPublished,
}: {
  claimStatus: PickedCreator["claimStatus"] | null;
  isPublished: boolean;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {claimStatus === "UNCLAIMED" ? (
        <MiniBadge>unclaimed</MiniBadge>
      ) : claimStatus === "PENDING_CLAIM" ? (
        <MiniBadge>claim pending</MiniBadge>
      ) : null}
      {!isPublished ? <MiniBadge>draft</MiniBadge> : null}
    </span>
  );
}

const MiniBadge = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground rounded border px-1 text-[10px] uppercase">
    {children}
  </span>
);
