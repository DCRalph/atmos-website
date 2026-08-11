"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Plus, Search, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { AdminSection } from "./admin-section";
import { adminNavigationGroups } from "./admin-navigation";

export function AdminDashboard() {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const normalisedQuery = query.trim().toLowerCase();

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      if (
        event.key === "/" &&
        !target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const visibleGroups = useMemo(() => {
    if (!normalisedQuery) return adminNavigationGroups;

    return adminNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          [item.title, item.description, ...(item.keywords ?? [])]
            .join(" ")
            .toLowerCase()
            .includes(normalisedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalisedQuery]);

  const resultCount = visibleGroups.reduce(
    (count, group) => count + group.items.length,
    0,
  );

  return (
    <AdminSection
      title="Admin workspace"
      description="Find a section, start something new, or manage the day-to-day running of Atmos."
    >
      <div className="space-y-10">
        <section className="from-primary/10 via-card to-card overflow-hidden rounded-2xl border bg-linear-to-br p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-xl">
              <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
                Quick actions
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                What would you like to manage?
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Search every admin area below, or jump straight into a common
                task.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/admin/gigs/new">
                  <Plus />
                  Add gig
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/events/new">
                  <CalendarPlus />
                  Create event
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative mt-6 max-w-2xl">
            <label htmlFor="admin-section-search" className="sr-only">
              Search admin sections
            </label>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              ref={searchRef}
              id="admin-section-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sections, tools, or tasks..."
              className="bg-background h-11 pr-20 pl-9 shadow-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md outline-none focus-visible:ring-2"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-2 py-0.5 font-sans text-xs sm:block">
                /
              </kbd>
            )}
          </div>
        </section>

        <div className="space-y-9">
          {normalisedQuery && (
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {resultCount === 1
                ? "1 section found"
                : `${resultCount} sections found`}
            </p>
          )}

          {visibleGroups.map((group) => {
            const headingId = `admin-group-${group.title
              .toLowerCase()
              .replaceAll(/[^a-z0-9]+/g, "-")}`;

            return (
              <section key={group.title} aria-labelledby={headingId}>
                <div className="mb-3 flex items-center gap-3">
                  <h2
                    id={headingId}
                    className="text-sm font-semibold tracking-wide"
                  >
                    {group.title}
                  </h2>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                    {group.items.length}
                  </span>
                  <div className="bg-border h-px flex-1" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item) => (
                    <Link
                      key={item.url}
                      href={item.url}
                      className="group bg-card hover:border-primary/35 hover:bg-muted/35 focus-visible:border-ring focus-visible:ring-ring/40 flex min-h-32 items-start gap-4 rounded-xl border p-4 shadow-xs transition-[background-color,border-color,box-shadow,transform] outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px]"
                    >
                      <span className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground grid size-10 shrink-0 place-items-center rounded-lg transition-colors">
                        <item.icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 font-medium">
                          {item.title}
                          <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                        </span>
                        <span className="text-muted-foreground mt-1.5 block text-sm leading-relaxed">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {visibleGroups.length === 0 && (
            <div className="rounded-xl border border-dashed py-14 text-center">
              <Search className="text-muted-foreground mx-auto size-6" />
              <h2 className="mt-3 font-medium">No matching sections</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Try a page name or task such as “tickets” or “uploads”.
              </p>
              <Button
                type="button"
                variant="link"
                className="mt-2"
                onClick={() => setQuery("")}
              >
                Clear search
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminSection>
  );
}
