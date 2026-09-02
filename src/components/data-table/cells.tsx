import { HugeiconsIcon } from "@hugeicons/react";
import { MinusSignIcon, Tick02Icon } from "@hugeicons/core-free-icons";

import { Badge } from "~/components/ui/badge";
import { formatDate as formatAdminDate } from "~/lib/date-utils";
import { cn } from "~/lib/utils";
import type { DataTableColumn } from "./types";

export function getCellValue<TRow>(
  column: DataTableColumn<TRow>,
  row: TRow,
): unknown {
  if (column.accessor) return column.accessor(row);
  return (row as Record<string, unknown>)[column.id];
}

function formatDate(value: unknown): string {
  if (value == null || value === "") return "—";
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) return formatValue(value);
  // The shared formatter, so a date in a table reads the same as a date
  // anywhere else in the admin — user's timezone, "15 Jan 2024".
  return formatAdminDate(date, "short");
}

function formatValue(value: unknown): string {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

export function DataTableCell<TRow>({
  column,
  row,
}: {
  column: DataTableColumn<TRow>;
  row: TRow;
}) {
  if (column.cell) return <>{column.cell(row)}</>;

  const value = getCellValue(column, row);

  switch (column.type) {
    case "badge": {
      const meta = column.badge?.(value, row) ?? {};
      const label = meta.label ?? formatValue(value);
      if (!label) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge
          variant={meta.variant ?? "outline"}
          className="gap-1.5 font-medium"
        >
          {meta.dotClassName && (
            <span className={cn("size-1.5 rounded-full", meta.dotClassName)} />
          )}
          {label}
        </Badge>
      );
    }
    case "email":
      return value ? (
        <a
          href={`mailto:${formatValue(value)}`}
          onClick={(event) => event.stopPropagation()}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          {formatValue(value)}
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "number":
      return (
        <span className="tabular-nums">
          {value == null || value === "" ? "—" : formatValue(value)}
        </span>
      );
    case "date":
      return <span className="text-muted-foreground">{formatDate(value)}</span>;
    case "boolean":
      return value ? (
        <HugeiconsIcon icon={Tick02Icon} className="text-success size-4" />
      ) : (
        <HugeiconsIcon
          icon={MinusSignIcon}
          className="text-muted-foreground size-4"
        />
      );
    default:
      return (
        <span>
          {value == null || value === "" ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            formatValue(value)
          )}
        </span>
      );
  }
}
