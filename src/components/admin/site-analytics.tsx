"use client";

import { useState, type ReactNode } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { RangeSwitch } from "~/components/admin/range-switch";
import {
  BarList,
  BucketBarChart,
  ChartCard,
  StatStrip,
  WeekHeatmap,
} from "~/components/admin/ticketing/charts";
import {
  bucketSeries,
  bucketUnit,
  type AnalyticsRange,
} from "~/lib/analytics-range";
import {
  PAGE_GROUPS,
  PAGE_GROUP_LABELS,
  sourceLabel,
  type PageGroup,
} from "~/lib/page-views";
import { deviceKindLabel } from "~/lib/ticketing/devices";
import { formatEventDate, formatEventDateTime } from "~/lib/ticketing/dates";
import { cn } from "~/lib/utils";

type Report = RouterOutputs["pageViews"]["report"];
type PageRow = Report["pages"][number];

type Filters = { paths: string[]; sources: string[]; devices: string[] };
type Facet = keyof Filters;
const NO_FILTERS: Filters = { paths: [], sources: [], devices: [] };

const RANGE_TITLES: Record<AnalyticsRange, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

const RANGE_COLUMNS: Record<AnalyticsRange, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-NZ")} ${n === 1 ? one : many}`;

/**
 * The Site tab on Analytics: views of every public page. Pages, sources and
 * devices filter everything, from the dropdowns or by clicking a row in their
 * lists; the range switch scopes it all but today and this week. `tabs` leads
 * the controls: the page's Events / Site switch.
 */
export function SiteAnalytics({ tabs }: { tabs?: ReactNode }) {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // The previous answer stays drawn, dimmed, while the next loads.
  const report = api.pageViews.report.useQuery(
    { range, ...filters },
    { placeholderData: keepPreviousData },
  );

  const set = (facet: Facet) => (keys: string[]) =>
    setFilters((current) => ({ ...current, [facet]: keys }));
  const toggle = (facet: Facet) => (key: string) =>
    setFilters((current) => ({
      ...current,
      [facet]: current[facet].includes(key)
        ? current[facet].filter((picked) => picked !== key)
        : [...current[facet], key],
    }));
  const filtered = Object.values(filters).some((keys) => keys.length > 0);
  const data = report.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {tabs}
        <PagePicker
          pages={data?.pages ?? []}
          picked={filters.paths}
          onChange={set("paths")}
        />
        <Picker
          every="Every source"
          noun="sources"
          options={(data?.sources ?? []).map((row) => ({
            key: row.source,
            label: sourceLabel(row.source),
            detail: row.views.toLocaleString("en-NZ"),
          }))}
          picked={filters.sources}
          onChange={set("sources")}
        />
        <Picker
          every="Any device"
          noun="devices"
          options={(data?.devices ?? []).map((row) => ({
            key: row.device,
            label: deviceKindLabel(row.device),
            detail: row.views.toLocaleString("en-NZ"),
          }))}
          picked={filters.devices}
          onChange={set("devices")}
        />
        {filtered ? (
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground h-8 px-1"
            onClick={() => setFilters(NO_FILTERS)}
          >
            Clear filters
          </Button>
        ) : null}
        <div className="ml-auto">
          <RangeSwitch value={range} onChange={setRange} />
        </div>
      </div>

      {!data ? (
        report.isPending ? (
          <Skeleton className="h-96 w-full" />
        ) : null
      ) : (
        <div
          className={cn(
            "space-y-3 transition-opacity",
            report.isPlaceholderData && "opacity-60",
          )}
        >
          <Headline data={data} range={range} filtered={filtered} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <PerDay data={data} />
            <ChartCard title="When people visit">
              <WeekHeatmap
                cells={data.weekHours}
                unit={["view", "views"]}
                series="views"
              />
            </ChartCard>

            <ChartCard title="Where they came from">
              <BarList
                series="views"
                empty="No views in this range."
                rows={breakdown(
                  data.sources.map((row) => ({
                    key: row.source,
                    label: sourceLabel(row.source),
                    views: row.views,
                  })),
                )}
                selected={filters.sources}
                onToggle={toggle("sources")}
              />
            </ChartCard>
            <ChartCard title="Device">
              <BarList
                series="views"
                empty="No views in this range."
                rows={breakdown(
                  data.devices.map((row) => ({
                    key: row.device,
                    label: deviceKindLabel(row.device),
                    views: row.views,
                  })),
                )}
                selected={filters.devices}
                onToggle={toggle("devices")}
              />
            </ChartCard>

            <ChartCard title="Pages" className="lg:col-span-2">
              <PagesTable
                pages={data.pages}
                rangeColumn={RANGE_COLUMNS[range]}
                picked={filters.paths}
                onToggle={toggle("paths")}
              />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

/** Rows for a clickable `BarList`: the count, and its share of the list. */
function breakdown(rows: { key: string; label: string; views: number }[]) {
  const total = rows.reduce((sum, row) => sum + row.views, 0);
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.views,
    detail: `${row.views.toLocaleString("en-NZ")} · ${pct(row.views, total)}%`,
  }));
}

function Headline({
  data,
  range,
  filtered,
}: {
  data: Report;
  range: AnalyticsRange;
  filtered: boolean;
}) {
  const { today, thisWeek, views, visits, allViews } = data.headline;
  const pages = data.pages.filter((page) => page.views > 0).length;
  return (
    <StatStrip
      items={[
        {
          label: "Views today",
          value: today.toLocaleString("en-NZ"),
          sub: "Since midnight",
          accent: "views",
        },
        {
          label: "This week",
          value: thisWeek.toLocaleString("en-NZ"),
          sub: "Since Monday",
        },
        {
          label: RANGE_TITLES[range],
          value: views.toLocaleString("en-NZ"),
          sub: filtered
            ? `${pct(views, allViews)}% of all views`
            : `On ${plural(pages, "page", "pages")}`,
        },
        {
          label: "Visits",
          value: visits.toLocaleString("en-NZ"),
          sub:
            visits > 0
              ? `${(views / visits).toFixed(1)} pages a visit`
              : "None yet",
        },
      ]}
    />
  );
}

/** Views per hour up to a week, per day beyond, quiet stretches included. */
function PerDay({ data }: { data: Report }) {
  const hourly = bucketUnit(data.from, data.to) === "hour";
  const buckets = bucketSeries(data.hours, data.from, data.to, data.timezone);
  return (
    <BucketBarChart
      title={hourly ? "Views per hour" : "Views per day"}
      buckets={buckets}
      height={150}
      series="views"
      unit={["view", "views"]}
      formatX={(date) =>
        hourly
          ? formatEventDateTime(date, data.timezone)
          : formatEventDate(date, data.timezone)
      }
    />
  );
}

/** Each group's busiest pages show; the rest are one click away. */
const PAGES_SHOWN = 12;

/**
 * Every page with views, grouped: site pages, gigs, ticketed events. A row
 * is a filter: click it to narrow everything else to that page.
 */
function PagesTable({
  pages,
  rangeColumn,
  picked,
  onToggle,
}: {
  pages: PageRow[];
  rangeColumn: string;
  picked: string[];
  onToggle: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState<PageGroup[]>([]);
  const max = Math.max(1, ...pages.map((page) => page.views));

  if (pages.length === 0) {
    return <p className="text-muted-foreground text-sm">No views yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground border-b text-left text-xs">
          <th className="py-1.5 pr-2 pl-2 font-medium">Page</th>
          <th className="w-20 px-2 py-1.5 text-right font-medium">Today</th>
          <th className="w-24 px-2 py-1.5 text-right font-medium">This week</th>
          <th className="w-24 px-2 py-1.5 text-right font-medium">
            {rangeColumn}
          </th>
          <th className="hidden w-1/4 py-1.5 pl-2 sm:table-cell">
            <span className="sr-only">Share</span>
          </th>
        </tr>
      </thead>
      {PAGE_GROUPS.map((group) => {
        const rows = pages.filter((page) => page.group === group);
        if (rows.length === 0) return null;
        const open = expanded.includes(group);
        const shown = open ? rows : rows.slice(0, PAGES_SHOWN);
        return (
          <tbody key={group}>
            <tr>
              <td
                colSpan={5}
                className="text-muted-foreground pt-3 pb-1 pl-2 text-xs tracking-wide uppercase"
              >
                {PAGE_GROUP_LABELS[group]}
              </td>
            </tr>
            {shown.map((page) => {
              const on = picked.includes(page.path);
              return (
                // The name is the button, for the keyboard; a click anywhere
                // on the row lands on the same handler.
                <tr
                  key={page.path}
                  onClick={() => onToggle(page.path)}
                  className={cn(
                    "hover:bg-muted/50 cursor-pointer border-b border-white/5 last:border-0",
                    on &&
                      "bg-(--ticket-series-views)/10 shadow-[inset_2px_0_0_var(--ticket-series-views)]",
                    picked.length > 0 && !on && "opacity-50",
                  )}
                >
                  <td className="max-w-0 py-1.5 pr-2 pl-2">
                    <button
                      type="button"
                      aria-pressed={on}
                      title={page.path}
                      className="block max-w-full truncate text-left outline-none focus-visible:underline"
                    >
                      <span className={cn(on && "font-medium")}>
                        {page.name}
                      </span>
                      {page.date ? (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {formatEventDate(page.date, page.timezone)}
                        </span>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {page.today.toLocaleString("en-NZ")}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {page.thisWeek.toLocaleString("en-NZ")}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {page.views.toLocaleString("en-NZ")}
                  </td>
                  <td className="hidden py-1.5 pl-2 sm:table-cell">
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-(--ticket-series-views)"
                        style={{ width: `${(page.views / max) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length > PAGES_SHOWN ? (
              <tr>
                <td colSpan={5} className="pt-1">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-muted-foreground h-7 px-2"
                    onClick={() =>
                      setExpanded((current) =>
                        open
                          ? current.filter((g) => g !== group)
                          : [...current, group],
                      )
                    }
                  >
                    {open
                      ? "Show fewer"
                      : `Show all ${rows.length} ${PAGE_GROUP_LABELS[group].toLowerCase()}`}
                  </Button>
                </td>
              </tr>
            ) : null}
          </tbody>
        );
      })}
    </table>
  );
}

/** A filter's button: what's picked, in the views colour once anything is. */
function FilterTrigger({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-8 max-w-56",
          active &&
            "border-(--ticket-series-views)/60 text-(--ticket-series-views) hover:text-(--ticket-series-views)",
        )}
      >
        <span className="truncate">{children}</span>
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </Button>
    </DropdownMenuTrigger>
  );
}

/** Pick several of a list: sources, devices. Stays open while picking. */
function Picker({
  every,
  noun,
  options,
  picked,
  onChange,
}: {
  /** The label with nothing picked: "Every source". */
  every: string;
  /** What several picked are called: "3 sources". */
  noun: string;
  options: { key: string; label: string; detail: string }[];
  picked: string[];
  onChange: (keys: string[]) => void;
}) {
  const only =
    picked.length === 1
      ? options.find((option) => option.key === picked[0])
      : undefined;
  return (
    <DropdownMenu>
      <FilterTrigger active={picked.length > 0}>
        {picked.length === 0
          ? every
          : (only?.label ?? `${picked.length} ${noun}`)}
      </FilterTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuItem onSelect={() => onChange([])}>
          {every}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <p className="text-muted-foreground px-2 py-1.5 text-sm">
            No views in this range.
          </p>
        ) : null}
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.key}
            checked={picked.includes(option.key)}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...picked, option.key]
                  : picked.filter((key) => key !== option.key),
              )
            }
            onSelect={(event) => event.preventDefault()}
          >
            <span className="truncate">{option.label}</span>
            <span className="text-muted-foreground ml-auto pl-3 text-xs tabular-nums">
              {option.detail}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Pick pages, grouped as the table is: a whole group at once, or single
 * pages. The button names what's picked: one page, one whole group, or a
 * count.
 */
function PagePicker({
  pages,
  picked,
  onChange,
}: {
  pages: PageRow[];
  picked: string[];
  onChange: (paths: string[]) => void;
}) {
  const groups = PAGE_GROUPS.map((group) => ({
    group,
    paths: pages.filter((page) => page.group === group).map((p) => p.path),
  })).filter(({ paths }) => paths.length > 0);
  const whole = groups.find(
    ({ paths }) =>
      paths.length === picked.length &&
      paths.every((path) => picked.includes(path)),
  );
  const label =
    picked.length === 0
      ? "Every page"
      : picked.length === 1
        ? (pages.find((page) => page.path === picked[0])?.name ?? "1 page")
        : whole
          ? `${PAGE_GROUP_LABELS[whole.group]} (${picked.length} pages)`
          : `${picked.length} pages`;

  return (
    <DropdownMenu>
      <FilterTrigger active={picked.length > 0}>{label}</FilterTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-96 w-72 overflow-y-auto"
      >
        <DropdownMenuItem onSelect={() => onChange([])}>
          Every page
        </DropdownMenuItem>
        {groups.map(({ group, paths }) => {
          const all = paths.every((path) => picked.includes(path));
          return (
            <div key={group}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal tracking-wide uppercase">
                {PAGE_GROUP_LABELS[group]}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={all}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...new Set([...picked, ...paths])]
                      : picked.filter((path) => !paths.includes(path)),
                  )
                }
                onSelect={(event) => event.preventDefault()}
              >
                All {PAGE_GROUP_LABELS[group].toLowerCase()}
              </DropdownMenuCheckboxItem>
              {pages
                .filter((page) => page.group === group)
                .map((page) => (
                  <DropdownMenuCheckboxItem
                    key={page.path}
                    checked={picked.includes(page.path)}
                    onCheckedChange={(checked) =>
                      onChange(
                        checked
                          ? [...picked, page.path]
                          : picked.filter((path) => path !== page.path),
                      )
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span className="truncate">{page.name}</span>
                    {page.date ? (
                      <span className="text-muted-foreground ml-auto pl-3 text-xs whitespace-nowrap">
                        {formatEventDate(page.date, page.timezone)}
                      </span>
                    ) : null}
                  </DropdownMenuCheckboxItem>
                ))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
