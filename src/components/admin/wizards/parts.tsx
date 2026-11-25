"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Loader2, Search } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Segmented } from "~/components/admin/segmented";
import { formatEventDate, formatEventDateTime } from "~/lib/ticketing/dates";
import { cn } from "~/lib/utils";

/** A labelled input, as the gig editor lays them out. */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

/** One line of a review: what a field was, and what it will be. */
export type DiffRow = {
  label: string;
  before: string;
  after: string;
};

/** "Not set" for a blank, so a diff never shows an empty cell. */
export const shown = (value: string | null | undefined): string =>
  value?.trim() ? value.trim() : "Not set";

export const shownWhen = (date: Date | null | undefined): string =>
  date ? formatEventDateTime(date) : "Not set";

/** Only the rows that change. */
export const changedRows = (rows: DiffRow[]): DiffRow[] =>
  rows.filter((row) => row.before !== row.after);

/**
 * The review step: the old value struck through beside the new one, for each
 * field that changes. This is where people see they did not break anything.
 */
export function DiffList({
  title = "Review",
  rows,
  empty = "Nothing has changed yet.",
  children,
}: {
  title?: string;
  rows: DiffRow[];
  empty?: string;
  /** Warnings and notes under the list. */
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {rows.length === 0
            ? empty
            : `${rows.length} change${rows.length === 1 ? "" : "s"}. Nothing is saved until you press Save.`}
        </CardDescription>
      </CardHeader>
      {rows.length > 0 || children ? (
        <CardContent className="space-y-4">
          {rows.length > 0 ? (
            <dl className="divide-border divide-y text-sm">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3"
                >
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="text-muted-foreground break-words line-through">
                      {row.before}
                    </span>
                    <span className="break-words">{row.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}

/** A warning line under a review, in the amber the dashboard uses. */
export function Caution({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
      {children}
    </p>
  );
}

/** The gig or event a wizard is pointed at, from `?gig=` or `?event=`. */
export function useWizardTarget(param: "gig" | "event") {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get(param);
  const choose = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, next);
    router.replace(`?${params.toString()}`);
  };
  return [id, choose] as const;
}

type Choice = {
  id: string;
  title: string;
  isDraft: boolean;
  startsAt: Date;
  venue: string | null;
  isPast: boolean;
  /** Why this one might want the wizard, e.g. "No poster". */
  hint?: string | null;
};

/**
 * "Which gig?": everything coming up, soonest first, with the past couple of
 * months behind a switch. Each row can say why it might be the one ("No
 * poster"), which is usually how people decide.
 */
export function ChoiceList({
  title,
  description,
  choices,
  isLoading,
  onPick,
  emptyText,
}: {
  title: string;
  description?: string;
  choices: Choice[];
  isLoading: boolean;
  onPick: (id: string) => void;
  emptyText: string;
}) {
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = choices.filter(
      (choice) =>
        choice.isPast === (when === "past") &&
        (!needle ||
          choice.title.toLowerCase().includes(needle) ||
          (choice.venue?.toLowerCase().includes(needle) ?? false)),
    );
    // Upcoming reads soonest first; past reads most recent first.
    return when === "past" ? list.reverse() : list;
  }, [choices, query, when]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          <Segmented
            label="When"
            value={when}
            onChange={setWhen}
            options={[
              { value: "upcoming", label: "Coming up" },
              { value: "past", label: "Past" },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or venue"
            className="pl-9"
            aria-label="Search"
          />
        </div>
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading...
          </div>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {query ? "Nothing matches." : emptyText}
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {visible.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  onClick={() => onPick(choice.id)}
                  className="hover:bg-secondary/60 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                >
                  <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">
                    {formatEventDate(choice.startsAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {choice.title}
                      {choice.isDraft ? (
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          Draft
                        </span>
                      ) : null}
                    </span>
                    {choice.venue ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {choice.venue}
                      </span>
                    ) : null}
                  </span>
                  {choice.hint ? (
                    <span className="hidden shrink-0 text-xs text-amber-200 sm:inline">
                      {choice.hint}
                    </span>
                  ) : null}
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export type GigChoice = RouterOutputs["wizards"]["gigChoices"][number];

/** The gig picker, with each row's hint chosen by the wizard asking. */
export function GigChoiceList({
  title = "Which gig?",
  hint,
  onPick,
}: {
  title?: string;
  hint?: (gig: GigChoice) => string | null;
  onPick: (gig: GigChoice) => void;
}) {
  const gigs = api.wizards.gigChoices.useQuery();
  const byId = useMemo(
    () => new Map((gigs.data ?? []).map((gig) => [gig.id, gig])),
    [gigs.data],
  );
  return (
    <ChoiceList
      title={title}
      choices={(gigs.data ?? []).map((gig) => ({
        ...gig,
        hint: hint?.(gig) ?? null,
      }))}
      isLoading={gigs.isPending}
      onPick={(id) => {
        const gig = byId.get(id);
        if (gig) onPick(gig);
      }}
      emptyText="No gigs here yet."
    />
  );
}

export type EventChoice = RouterOutputs["wizards"]["eventChoices"][number];

export function EventChoiceList({
  title = "Which event?",
  hint,
  onPick,
}: {
  title?: string;
  hint?: (event: EventChoice) => string | null;
  onPick: (id: string) => void;
}) {
  const events = api.wizards.eventChoices.useQuery();
  return (
    <ChoiceList
      title={title}
      choices={(events.data ?? []).map((event) => ({
        ...event,
        hint: hint?.(event) ?? null,
      }))}
      isLoading={events.isPending}
      onPick={onPick}
      emptyText="No ticketed events here yet."
    />
  );
}

/** The loading line every wizard shows while its gig or event arrives. */
export function Loading({ what = "Loading..." }: { what?: string }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {what}
    </div>
  );
}

/** A plain bordered box for things that are not a whole card. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-border rounded-lg border p-4", className)}>
      {children}
    </div>
  );
}

/**
 * One of a few big choices, bordered and filled when picked. Put a row of them
 * inside an element with `role="radiogroup"`.
 */
export function Choice({
  selected,
  onSelect,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-secondary"
          : "border-border hover:bg-secondary/60",
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      {detail ? (
        <span className="text-muted-foreground mt-0.5 block text-xs">
          {detail}
        </span>
      ) : null}
    </button>
  );
}

/** One line of a summary: a label and what it is set to. Put rows inside a `<dl>`. */
export function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
