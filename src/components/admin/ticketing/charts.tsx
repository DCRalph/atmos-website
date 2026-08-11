"use client";

import { useId, useMemo, useState } from "react";

/**
 * Charts for the ticketing dashboards.
 *
 * Hand-rolled SVG rather than a charting library: every chart here is a single
 * series, which is the case libraries add the most weight for and deliver the
 * least. Single series also means no legend — the title names the series — and
 * no categorical palette to get wrong.
 *
 * Series colours come from `--ticket-series-*` in globals.css, which are
 * separately chosen and validated for light and dark. Marks are thin, the grid
 * is recessive, and every plot carries a hover layer.
 */

const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

function niceCeil(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "revenue" | "arrivals";
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p
        className="mt-1.5 text-3xl font-semibold tabular-nums"
        style={
          accent
            ? { color: `var(--ticket-series-${accent})` }
            : undefined
        }
      >
        {value}
      </p>
      {sub && <p className="text-muted-foreground mt-1 text-sm">{sub}</p>}
    </div>
  );
}

export type SeriesPoint = { x: Date; y: number };

/**
 * Cumulative line + area. Used for the sales curve, where the shape — a spike
 * on announcement, a flat middle, a rush in the last week — is the whole point.
 */
export function TimeSeriesChart({
  points,
  title,
  formatValue,
  formatX,
  height = 220,
}: {
  points: SeriesPoint[];
  title: string;
  formatValue: (value: number) => string;
  formatX: (date: Date) => string;
  height?: number;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;

  const geometry = useMemo(() => {
    if (points.length === 0) return null;

    const maxY = niceCeil(Math.max(...points.map((p) => p.y), 1));
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const xAt = (index: number) =>
      PAD.left +
      (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const yAt = (value: number) => PAD.top + innerH - (value / maxY) * innerH;

    const line = points
      .map((point, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(point.y)}`)
      .join(" ");
    const area = `${line} L${xAt(points.length - 1)},${PAD.top + innerH} L${xAt(0)},${PAD.top + innerH} Z`;

    return { maxY, innerH, xAt, yAt, line, area };
  }, [points, height]);

  if (!geometry) {
    return <EmptyPlot title={title} height={height} />;
  }

  const ticks = [0, 0.5, 1].map((fraction) => geometry.maxY * fraction);
  const active = hover !== null ? points[hover] : null;

  return (
    <figure className="rounded-lg border p-4">
      <figcaption className="text-muted-foreground mb-3 text-sm font-medium">
        {title}
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label={title}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--ticket-series-revenue)"
                stopOpacity="0.22"
              />
              <stop
                offset="100%"
                stopColor="var(--ticket-series-revenue)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
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
          ))}

          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--ticket-series-revenue)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

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
                fill="var(--ticket-series-revenue)"
                className="stroke-background"
                strokeWidth={2}
              />
            </>
          )}

          {/* Hit targets are full-height columns, much bigger than the marks. */}
          {points.map((point, i) => (
            <rect
              key={point.x.toISOString()}
              x={geometry.xAt(i) - (width - PAD.left - PAD.right) / points.length / 2}
              y={PAD.top}
              width={(width - PAD.left - PAD.right) / points.length}
              height={geometry.innerH}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
            />
          ))}

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

        {active && (
          <div className="bg-popover text-popover-foreground pointer-events-none absolute top-2 right-2 rounded-md border px-2.5 py-1.5 text-xs shadow-sm">
            <p className="font-medium tabular-nums">{formatValue(active.y)}</p>
            <p className="text-muted-foreground">{formatX(active.x)}</p>
          </div>
        )}
      </div>
    </figure>
  );
}

/**
 * Arrival buckets. Bars because each bucket is a discrete count, and the
 * question at the door is "how hard is it coming right now".
 */
export function BucketBarChart({
  buckets,
  title,
  formatX,
  height = 180,
}: {
  buckets: { x: Date; y: number }[];
  title: string;
  formatX: (date: Date) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;

  if (buckets.length === 0) {
    return <EmptyPlot title={title} height={height} />;
  }

  const maxY = niceCeil(Math.max(...buckets.map((b) => b.y), 1));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / buckets.length;
  // 2px of surface between bars, so adjacent fills never merge into one block.
  const barW = Math.max(2, slot - 2);

  const active = hover !== null ? buckets[hover] : null;

  return (
    <figure className="rounded-lg border p-4">
      <figcaption className="text-muted-foreground mb-3 text-sm font-medium">
        {title}
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label={title}
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
            {maxY}
          </text>

          {buckets.map((bucket, i) => {
            const barH = (bucket.y / maxY) * innerH;
            return (
              <g key={bucket.x.toISOString()}>
                <rect
                  x={PAD.left + i * slot + (slot - barW) / 2}
                  y={PAD.top + innerH - barH}
                  width={barW}
                  height={Math.max(barH, bucket.y > 0 ? 2 : 0)}
                  rx={2}
                  fill="var(--ticket-series-arrivals)"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                />
              </g>
            );
          })}

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

        {active && (
          <div className="bg-popover text-popover-foreground pointer-events-none absolute top-2 right-2 rounded-md border px-2.5 py-1.5 text-xs shadow-sm">
            <p className="font-medium tabular-nums">
              {active.y} {active.y === 1 ? "person" : "people"}
            </p>
            <p className="text-muted-foreground">{formatX(active.x)}</p>
          </div>
        )}
      </div>
    </figure>
  );
}

/**
 * Tier progress. Direct-labelled rather than legended, so the label carries
 * identity and the colour is only doing magnitude.
 */
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
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-muted-foreground text-sm font-medium">Sales by tier</p>

      {tiers.length === 0 && (
        <p className="text-muted-foreground text-sm">No tiers yet.</p>
      )}

      {tiers.map((tier) => {
        const percent =
          tier.allocation > 0
            ? Math.min(100, Math.round((tier.sold / tier.allocation) * 100))
            : 0;
        return (
          <div key={tier.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{tier.name}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {tier.sold}/{tier.allocation} · {formatMoney(tier.revenueCents)}
              </span>
            </div>
            <div className="bg-muted mt-1.5 h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percent}%`,
                  background: "var(--ticket-series-revenue)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyPlot({ title, height }: { title: string; height: number }) {
  return (
    <figure className="rounded-lg border p-4">
      <figcaption className="text-muted-foreground mb-3 text-sm font-medium">
        {title}
      </figcaption>
      <div
        className="text-muted-foreground grid place-items-center text-sm"
        style={{ height }}
      >
        Nothing to show yet.
      </div>
    </figure>
  );
}
