"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Plus, Search, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { api, type RouterOutputs } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import { cn } from "~/lib/utils";
import { VenueDialog } from "./venue-dialog";

/** A venue as the editors hold it: enough to draw it without another fetch. */
export type PickedVenue = Pick<
  RouterOutputs["venues"]["list"][number],
  "id" | "name" | "address" | "logoFileId"
>;

/**
 * Picks the venue for a gig or event, or creates one without leaving the
 * editor. Every venue is fetched once and filtered in the browser, like tags:
 * there are few enough that a request per keystroke would buy nothing.
 */
export function VenuePicker({
  value,
  onChange,
  disabled,
  createLabel,
}: {
  value: PickedVenue | null;
  onChange: (venue: PickedVenue | null) => void;
  disabled?: boolean;
  /** The create dialog's button, e.g. "Create & use for this gig". */
  createLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const venues = api.venues.list.useQuery(undefined, { enabled: isOpen });

  const needle = query.trim().toLowerCase();
  const results = (venues.data ?? []).filter(
    (venue) =>
      venue.id !== value?.id &&
      (!needle ||
        venue.name.toLowerCase().includes(needle) ||
        (venue.address?.toLowerCase().includes(needle) ?? false)),
  );

  // The dialog takes over from the popover, rather than opening over it.
  const startCreate = () => {
    setIsOpen(false);
    setIsCreateOpen(true);
  };

  const pick = (venue: PickedVenue) => {
    onChange({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      logoFileId: venue.logoFileId,
    });
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-md border p-2">
          <VenueLogo venue={value} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{value.name}</div>
            {value.address ? (
              <div className="text-muted-foreground truncate text-xs">
                {value.address}
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Remove venue"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={disabled}>
            <MapPin className="h-3.5 w-3.5" />
            {value ? "Change venue" : "Choose venue"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              autoFocus
              placeholder="Search venues..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const [first] = results;
                if (first) pick(first);
                else if (needle) startCreate();
              }}
              className="w-full pl-9"
            />
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto">
            {results.map((venue) => (
              <button
                key={venue.id}
                type="button"
                onClick={() => pick(venue)}
                className="hover:bg-accent flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left text-sm"
              >
                <VenueLogo venue={venue} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {venue.name}
                  </span>
                  {venue.address ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {venue.address}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
            {results.length === 0 && !venues.isLoading ? (
              <p className="text-muted-foreground px-2 py-3 text-sm">
                {needle
                  ? `No venue matches "${query.trim()}".`
                  : "No venues yet."}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={startCreate}
            className="hover:bg-accent mt-1 flex w-full items-center gap-2 rounded-sm border-t px-2 py-2 text-left text-sm"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {needle ? (
                <>
                  Create{" "}
                  <span className="font-medium">
                    &quot;{query.trim()}&quot;
                  </span>{" "}
                  as a new venue
                </>
              ) : (
                "New venue"
              )}
            </span>
          </button>

          <p className="text-muted-foreground border-t px-2 pt-2 text-xs">
            Venues are managed on the{" "}
            <Link
              href="/admin/venues"
              target="_blank"
              className="hover:text-foreground underline"
            >
              venues
            </Link>{" "}
            page.
          </p>
        </PopoverContent>
      </Popover>

      <VenueDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        initialName={query.trim()}
        createLabel={createLabel}
        onSaved={pick}
      />
    </div>
  );
}

/** A venue's logo on a square, or its initial when it has none. */
export function VenueLogo({
  venue,
  size,
  className,
}: {
  venue: Pick<PickedVenue, "name" | "logoFileId">;
  size: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted relative flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {venue.logoFileId ? (
        // A plain img for the same reason as `ArtistAvatar`: small, already
        // cached /api/media responses.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={buildMediaUrl(venue.logoFileId)}
          alt=""
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-xs font-bold">
          {venue.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
