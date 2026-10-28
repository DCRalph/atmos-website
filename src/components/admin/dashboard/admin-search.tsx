"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "~/components/ui/input";
import { useAdminNavigation } from "~/components/admin/use-admin-navigation";

/**
 * Jump to any admin section by name. `/` focuses it from anywhere on the
 * page, Enter opens the first match, Escape clears it.
 */
export function AdminSearch() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const normalised = query.trim().toLowerCase();
  const { items } = useAdminNavigation();

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const matches = useMemo(
    () =>
      normalised
        ? items
            .filter((item) => item.url !== "/admin")
            .filter((item) =>
              [item.title, item.description, ...(item.keywords ?? [])]
                .join(" ")
                .toLowerCase()
                .includes(normalised),
            )
            .slice(0, 8)
        : [],
    [items, normalised],
  );

  return (
    <div
      className="relative w-full sm:w-60"
      // Leaving the search, other than into its own results, closes it.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setQuery("");
      }}
    >
      <label htmlFor="admin-search" className="sr-only">
        Search admin
      </label>
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        ref={input}
        id="admin-search"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setQuery("");
          if (event.key === "Enter" && matches[0]) {
            router.push(matches[0].url);
            setQuery("");
          }
        }}
        placeholder="Search admin"
        className="h-9 pr-9 pl-8"
      />
      {query ? null : (
        <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 font-sans text-xs sm:block">
          /
        </kbd>
      )}
      {normalised ? (
        <div className="bg-popover absolute top-full right-0 left-0 z-20 mt-1 rounded-md border p-1 shadow-lg sm:w-80">
          {matches.length === 0 ? (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">
              No matching section
            </p>
          ) : (
            matches.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                onClick={() => setQuery("")}
                className="hover:bg-accent focus-visible:bg-accent flex items-start gap-2.5 rounded-sm px-2 py-1.5 text-sm outline-none"
              >
                <item.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium">{item.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {item.description}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
