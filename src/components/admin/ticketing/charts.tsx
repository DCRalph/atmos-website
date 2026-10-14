"use client";

import { useCallback, useId, useMemo, useState, type ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Charts for the ticketing dashboards.
 *
 * Hand-rolled SVG rather than a charting library: every chart here is a single
 * series, which is the case libraries add the most weight for and deliver the
 * least. Single series also means no legend — the title names the series — and
 * no categorical palette to get wrong.
 *
 * Series colours come from `--ticket-series-*` in globals.css; revenue is the
 * site accent. Marks are thin, the grid is recessive, and every plot carries a
 * hover layer.
 */

type Series = "revenue" | "arrivals";

const PAD = { top: 12, right: 12, bottom: 22, left: 44 };

function niceCeil(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * The width the plot is actually drawn at, so a chart in a wide card keeps
 * 10px labels instead of scaling its text up with the card.
 */
function useWidth() {
  const [width, setWidth] = useState(720);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function StatTile({
  label,
  value,
  sub,
  accent,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: Series;
  /** Money made or lost, like profit. */
  tone?: "gain" | "loss";
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "gain" && "text-emerald-600 dark:text-emerald-400",
          tone === "loss" && "text-destructive",
        )}
        style={accent ? { color: `var(--ticket-series-${accent})` } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-muted-foreground mt-0.5 text-sm">{sub}</p>}
    </div>
  );
}

/**
 * Headline numbers without the boxes: label over value, four across, the same
 * information as a row of `StatTile`s in a fraction of the height.
 */
export function StatStrip({
  items,
}: {
  items: { label: string; value: string; sub?: string; accent?: Series }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-wrap items-baseline gap-x-2"
        >
          <dt className="text-muted-foreground w-full text-xs tracking-wide uppercase">
            {item.label}
          </dt>
          <dd
            className="text-xl font-semibold tabular-nums"
            style={
              item.accent
                ? { color: `var(--ticket-series-${item.accent})` }
                : undefined
            }
          >
            {item.value}
          </dd>
          {item.sub ? (
            <dd className="text-muted-foreground text-sm">{item.sub}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** A bordered card around one chart or list: title left, a control right. */
export function ChartCard({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn("min-w-0 rounded-lg border p-3", className)}>
      <figcaption className="mb-2 flex min-h-6 items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm font-medium">
          {title}
        </span>
        {action}
      </figcaption>
      {children}
    </figure>
  );
}

/** What every chart shares: the card unless `bare`, and the empty state. */
type PlotFrame = {
  title: string;
  /** A control for the card's top right, like a range switch. */
  action?: ReactNode;
  /** Just the plot, for stacking inside a card that's already there. */
  bare?: boolean;
  height?: number;
};

function Framed({
  title,
  action,
  bare,
  children,
}: Omit<PlotFrame, "height"> & { children: ReactNode }) {
  return bare ? (
    children
  ) : (
    <ChartCard title={title} action={action}>
      {children}
    </ChartCard>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div
      className="text-muted-foreground grid place-items-center text-sm"
      style={{ height }}
    >
      Nothing to show yet.
    </div>
  );
}

/**
 * The hover readout. Pinned to the top right corner, or beside the pointer
 * when given `at` (relative to the positioned parent), on whichever side has
 * more room.
 */
function Tooltip({
  value,
  label,
  at,
}: {
  value: string;
  label: string;
  at?: { x: number; y: number; flip: boolean };
}) {
  return (
    <div
      className={cn(
        "bg-popover text-popover-foreground pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm",
        !at && "top-0 right-0",
      )}
      style={
        at
          ? {
              left: at.x,
              top: at.y,
              transform: `translate(${at.flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
            }
          : undefined
      }
    >
      <p className="font-medium tabular-nums">{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}

export type SeriesPoint = { x: Date; y: number };

/**
 * Cumulative line + area. Used for the sales curve, where the shape — a spike
 * on announcement, a flat middle, a rush in the last week — is the whole point.
 * Points sit at their time, not evenly spaced, and the line steps: a quiet
 * week is a long flat stretch rather than a slope between two busy hours.
 * `target` draws a dashed line to climb to, like break even, and the scale
 * always reaches it. `series` picks the colour: revenue unless told otherwise.
 */
const NO_MARKS: { at: Date; label: string }[] = [];

export function TimeSeriesChart({
  points,
  formatValue,
  formatX,
  target,
  reference,
  marks = NO_MARKS,
  series = "revenue",
  height = 200,
  ...frame
}: PlotFrame & {
  points: SeriesPoint[];
  formatValue: (value: number) => string;
  formatX: (date: Date) => string;
  target?: { value: number; label: string };
  /**
   * A second line to measure against, like the average past event: dashed,
   * in the muted colour, labelled at its end, never hovered. Its points are
   * clipped to the main series' span.
   */
  reference?: { points: SeriesPoint[]; label: string };
  /** Moments worth a tick on the axis, like a campaign going live. */
  marks?: { at: Date; label: string }[];
  /** Which `--ticket-series-*` colour to draw in. */
  series?: Series;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth();

  const geometry = useMemo(() => {
    if (points.length === 0) return null;

    const maxY = niceCeil(
      Math.max(
        ...points.map((p) => p.y),
        ...(reference?.points.map((p) => p.y) ?? []),
        target?.value ?? 0,
        1,
      ),
    );
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const start = points[0]!.x.getTime();
    const span = points.at(-1)!.x.getTime() - start;
    const xOf = (date: Date) =>
      PAD.left +
      (span === 0
        ? innerW / 2
        : Math.min(
            Math.max(((date.getTime() - start) / span) * innerW, 0),
            innerW,
          ));
    const xAt = (index: number) => xOf(points[index]!.x);
    const yAt = (value: number) => PAD.top + innerH - (value / maxY) * innerH;

    // Steps rather than slopes: a quiet week is a flat stretch.
    const stepPath = (steps: SeriesPoint[]) =>
      steps
        .map((point, i) =>
          i === 0
            ? `M${xOf(point.x)},${yAt(point.y)}`
            : `H${xOf(point.x)} V${yAt(point.y)}`,
        )
        .join(" ");
    const line = stepPath(points);
    const area = `${line} L${xAt(points.length - 1)},${PAD.top + innerH} L${xAt(0)},${PAD.top + innerH} Z`;

    const referenceEnd = reference?.points.at(-1);
    const marked = marks
      .filter((mark) => {
        const at = mark.at.getTime();
        return at >= start && at <= start + span;
      })
      .map((mark) => ({ x: xOf(mark.at), label: mark.label }));

    return {
      maxY,
      innerH,
      xAt,
      yAt,
      line,
      area,
      referenceLine: referenceEnd ? stepPath(reference!.points) : null,
      referenceEnd: referenceEnd
        ? { x: xOf(referenceEnd.x), y: yAt(referenceEnd.y) }
        : null,
      marked,
    };
  }, [points, reference, marks, width, height, target?.value]);

  const active = hover !== null ? points[hover] : null;

  return (
    <Framed {...frame}>
      <div ref={ref} className="relative">
        {!geometry ? (
          <Empty height={height} />
        ) : (
          <svg
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block w-full"
            role="img"
            aria-label={frame.title}
            onPointerMove={(event) => {
              // The nearest point to the pointer, in viewBox units.
              const box = event.currentTarget.getBoundingClientRect();
              const x = ((event.clientX - box.left) / box.width) * width;
              let nearest = 0;
              for (let i = 1; i < points.length; i++) {
                if (
                  Math.abs(geometry.xAt(i) - x) <
                  Math.abs(geometry.xAt(nearest) - x)
                ) {
                  nearest = i;
                }
              }
              setHover(nearest);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={`var(--ticket-series-${series})`}
                  stopOpacity="0.22"
                />
                <stop
                  offset="100%"
                  stopColor={`var(--ticket-series-${series})`}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {[0, 0.5, 1].map((fraction) => {
              const tick = geometry.maxY * fraction;
              return (
                <g key={fraction}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={geometry.yAt(tick)}
                    y2={geometry.yAt(tick)}
                    className="stroke-border"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 8}
                    y={geometry.yAt(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {formatValue(tick)}
                  </text>
                </g>
              );
            })}

            {target && (
              <g>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={geometry.yAt(target.value)}
                  y2={geometry.yAt(target.value)}
                  className="stroke-foreground"
                  strokeOpacity={0.6}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <text
                  x={PAD.left + 6}
                  y={geometry.yAt(target.value) - 6}
                  className="fill-foreground text-[10px]"
                >
                  {target.label}
                </text>
              </g>
            )}

            {geometry.marked.map((mark) => (
              <g key={`${mark.x}-${mark.label}`}>
                <line
                  x1={mark.x}
                  x2={mark.x}
                  y1={PAD.top}
                  y2={PAD.top + geometry.innerH}
                  className="stroke-foreground"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <text
                  x={mark.x + 4}
                  y={PAD.top + 10}
                  className="fill-muted-foreground text-[10px]"
                >
                  {mark.label}
                </text>
              </g>
            ))}

            {geometry.referenceLine && (
              <path
                d={geometry.referenceLine}
                fill="none"
                className="stroke-muted-foreground"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeLinejoin="round"
              />
            )}

            <path d={geometry.area} fill={`url(#${gradientId})`} />
            <path
              d={geometry.line}
              fill="none"
              stroke={`var(--ticket-series-${series})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {reference && geometry.referenceEnd && (
              <text
                x={geometry.referenceEnd.x - 4}
                y={geometry.referenceEnd.y - 6}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {reference.label}
              </text>
            )}

            {active && hover !== null && (
              <>
                <line
                  x1={geometry.xAt(hover)}
                  x2={geometry.xAt(hover)}
                  y1={PAD.top}
                  y2={PAD.top + geometry.innerH}
                  className="stroke-muted-foreground"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={geometry.xAt(hover)}
                  cy={geometry.yAt(active.y)}
                  r={5}
                  fill={`var(--ticket-series-${series})`}
                  className="stroke-background"
                  strokeWidth={2}
                />
              </>
            )}

            <text
              x={PAD.left}
              y={height - 6}
              className="fill-muted-foreground text-[10px]"
            >
              {formatX(points[0]!.x)}
            </text>
            {points.length > 1 && (
              <text
                x={width - PAD.right}
                y={height - 6}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatX(points.at(-1)!.x)}
              </text>
            )}
          </svg>
        )}

        {active && (
          <Tooltip value={formatValue(active.y)} label={formatX(active.x)} />
        )}
      </div>
    </Framed>
  );
}

/**
 * Counts per bucket: arrivals, clicks, sales per hour. Bars because each
 * bucket is a discrete count, and the question is "how hard is it coming".
 */
export function BucketBarChart({
  buckets,
  formatX,
  formatValue,
  formatAxis = String,
  unit = ["person", "people"],
  series = "arrivals",
  height = 160,
  ...frame
}: PlotFrame & {
  buckets: SeriesPoint[];
  formatX: (date: Date) => string;
  /** How a bar's value reads in the hover label. Defaults to a count of `unit`. */
  formatValue?: (value: number) => string;
  /** The scale's top label, which has room for a number and no more. */
  formatAxis?: (value: number) => string;
  /** What one bar counts, singular and plural, for the hover label. */
  unit?: [string, string];
  series?: Series;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth();

  const maxY = niceCeil(Math.max(...buckets.map((b) => b.y), 1));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(buckets.length, 1);
  // A surface gap between bars where there's room for one, so adjacent fills
  // never merge into one block; dense ranges get hairline bars instead.
  const barW = slot >= 4 ? slot - 2 : Math.max(1, slot - 0.5);

  const active = hover !== null ? buckets[hover] : null;
  const valueLabel = (value: number) =>
    formatValue
      ? formatValue(value)
      : `${value} ${value === 1 ? unit[0] : unit[1]}`;

  return (
    <Framed {...frame}>
      <div ref={ref} className="relative">
        {buckets.length === 0 ? (
          <Empty height={height} />
        ) : (
          <svg
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block w-full"
            role="img"
            aria-label={frame.title}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const x = ((event.clientX - box.left) / box.width) * width;
              const index = Math.floor((x - PAD.left) / slot);
              setHover(index >= 0 && index < buckets.length ? index : null);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={PAD.top + innerH}
              y2={PAD.top + innerH}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={PAD.top}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {formatAxis(maxY)}
            </text>

            {buckets.map((bucket, i) => {
              if (bucket.y <= 0) return null;
              const barH = Math.max((bucket.y / maxY) * innerH, 2);
              return (
                <rect
                  key={bucket.x.getTime()}
                  x={PAD.left + i * slot + (slot - barW) / 2}
                  y={PAD.top + innerH - barH}
                  width={barW}
                  height={barH}
                  rx={barW >= 4 ? 2 : 0}
                  fill={`var(--ticket-series-${series})`}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              );
            })}

            {hover !== null && (
              <rect
                x={PAD.left + hover * slot}
                y={PAD.top}
                width={slot}
                height={innerH}
                className="fill-foreground"
                opacity={0.06}
              />
            )}

            <text
              x={PAD.left}
              y={height - 6}
              className="fill-muted-foreground text-[10px]"
            >
              {formatX(buckets[0]!.x)}
            </text>
            {buckets.length > 1 && (
              <text
                x={width - PAD.right}
                y={height - 6}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatX(buckets.at(-1)!.x)}
              </text>
            )}
          </svg>
        )}

        {active && (
          <Tooltip value={valueLabel(active.y)} label={formatX(active.x)} />
        )}
      </div>
    </Framed>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS: Record<number, string> = {
  0: "12a",
  6: "6a",
  12: "12p",
  18: "6p",
};

const hourName = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? " am" : " pm"}`;

/**
 * When in the week something happens: a day by hour grid, one hue getting
 * stronger with the count. `cells` are sparse, `day` 1 being Monday.
 */
export function WeekHeatmap({
  cells,
  unit,
  formatValue,
  series = "revenue",
}: {
  cells: { day: number; hour: number; n: number }[];
  unit: [string, string];
  /** How a cell reads in the hover, instead of a count of `unit`. */
  formatValue?: (n: number) => string;
  series?: Series;
}) {
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(
    null,
  );
  const [pointer, setPointer] = useState<{
    x: number;
    y: number;
    flip: boolean;
  } | null>(null);
  const counts = new Map(
    cells.map((cell) => [`${cell.day}:${cell.hour}`, cell.n]),
  );
  const max = Math.max(1, ...cells.map((cell) => cell.n));
  const active = hover ? (counts.get(`${hover.day}:${hover.hour}`) ?? 0) : null;

  return (
    <div
      className="relative"
      onPointerMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - box.left;
        setPointer({ x, y: e.clientY - box.top, flip: x > box.width / 2 });
      }}
      onPointerLeave={() => setHover(null)}
    >
      <div className="grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-0.5">
        {WEEKDAYS.map((name, row) => (
          <div key={name} className="contents">
            <span className="text-muted-foreground self-center text-[10px]">
              {name}
            </span>
            {Array.from({ length: 24 }, (_, hour) => {
              const n = counts.get(`${row + 1}:${hour}`) ?? 0;
              return (
                <span
                  key={hour}
                  onPointerEnter={() => setHover({ day: row + 1, hour })}
                  className={cn(
                    "aspect-square rounded-[3px]",
                    n === 0 && "bg-muted",
                    hover?.day === row + 1 &&
                      hover.hour === hour &&
                      "ring-foreground ring-1",
                  )}
                  style={
                    n > 0
                      ? {
                          background: `var(--ticket-series-${series})`,
                          // A square root keeps one busy hour from washing
                          // every other cell out to near nothing.
                          opacity: 0.25 + 0.75 * Math.sqrt(n / max),
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span
            key={hour}
            className="text-muted-foreground text-[10px] leading-4 whitespace-nowrap"
          >
            {HOUR_LABELS[hour] ?? ""}
          </span>
        ))}
      </div>

      {hover && active !== null && (
        <Tooltip
          value={
            formatValue
              ? formatValue(active)
              : `${active} ${active === 1 ? unit[0] : unit[1]}`
          }
          label={`${WEEKDAYS[hover.day - 1]} ${hourName(hover.hour)}`}
          at={pointer ?? undefined}
        />
      )}
    </div>
  );
}

/**
 * Direct-labelled bars: a label, a number on the right, and a bar for its
 * share of `max` (the largest row unless given). The label carries identity,
 * so the colour is only doing magnitude.
 */
export function BarList({
  rows,
  max,
  series = "revenue",
  empty = "Nothing yet.",
}: {
  rows: { key: string; label: string; value: number; detail: string }[];
  max?: number;
  series?: Series;
  empty?: string;
}) {
  const scale = max ?? Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {row.detail}
            </span>
          </div>
          <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (row.value / scale) * 100)}%`,
                background: `var(--ticket-series-${series})`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Counts across two dimensions as a table: rows down, columns across, each
 * cell tinted by its share of the busiest one so the pattern reads before the
 * numbers do. Rows and columns run busiest first, totals at the end.
 */
export function CrossTab({
  cells,
  rowHeading,
  series = "revenue",
}: {
  cells: { row: string; column: string; n: number }[];
  /** What the rows are, over their labels: "Paid with". */
  rowHeading: string;
  series?: Series;
}) {
  const totals = (key: "row" | "column") => {
    const sums = new Map<string, number>();
    for (const cell of cells) {
      sums.set(cell[key], (sums.get(cell[key]) ?? 0) + cell.n);
    }
    return [...sums].sort((a, b) => b[1] - a[1]);
  };
  const rows = totals("row");
  const columns = totals("column");
  const count = new Map<string, number>();
  for (const cell of cells) {
    const key = `${cell.row}\u0000${cell.column}`;
    count.set(key, (count.get(key) ?? 0) + cell.n);
  }
  const max = Math.max(1, ...count.values());

  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-muted-foreground text-xs">
          <th className="w-full pb-1 text-left font-normal">{rowHeading}</th>
          {columns.map(([column]) => (
            <th key={column} className="pb-1 pl-3 text-right font-normal">
              {column}
            </th>
          ))}
          <th className="pb-1 pl-2 text-right font-normal">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([row, rowTotal]) => (
          <tr key={row}>
            <td className="py-0.5 pr-2 whitespace-nowrap">{row}</td>
            {columns.map(([column]) => {
              const n = count.get(`${row}\u0000${column}`) ?? 0;
              return (
                <td key={column} className="py-0.5 pl-1.5 text-right">
                  <span
                    className={cn(
                      "block rounded px-1.5 py-0.5",
                      n === 0 && "text-muted-foreground",
                    )}
                    style={
                      n > 0
                        ? {
                            background: `color-mix(in oklab, var(--ticket-series-${series}) ${Math.round(18 + 52 * (n / max))}%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    {n}
                  </span>
                </td>
              );
            })}
            <td className="text-muted-foreground py-0.5 pl-2 text-right">
              {rowTotal}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Tier progress: each tier's sales against its own allocation. */
export function TierBars({
  tiers,
  formatMoney,
}: {
  tiers: {
    id: string;
    name: string;
    sold: number;
    allocation: number;
    revenueCents: number;
  }[];
  formatMoney: (cents: number) => string;
}) {
  return (
    <ChartCard title="Sales by tier">
      <BarList
        empty="No tiers yet."
        max={100}
        rows={tiers.map((tier) => ({
          key: tier.id,
          label: tier.name,
          value: tier.allocation > 0 ? (tier.sold / tier.allocation) * 100 : 0,
          detail: `${tier.sold}/${tier.allocation} · ${formatMoney(tier.revenueCents)}`,
        }))}
      />
    </ChartCard>
  );
}
