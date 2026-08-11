import type { ReactNode } from "react";
import type { IconSvgElement } from "@hugeicons/react";

import type { FilterOperator } from "~/server/api/list/list-input";

export type DataTableColumnType =
  "text" | "number" | "date" | "badge" | "email" | "boolean";

export type DataTableBadgeVariant =
  "default" | "secondary" | "destructive" | "outline";

export interface DataTableBadge {
  label?: string;
  variant?: DataTableBadgeVariant;
  dotClassName?: string;
}

export interface DataTableFilterOption {
  label: string;
  value: string;
  dotClassName?: string;
}

export interface DataTableColumn<TRow> {
  id: string;
  header: string;
  icon?: IconSvgElement;
  type?: DataTableColumnType;
  accessor?: (row: TRow) => unknown;
  cell?: (row: TRow) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  options?: DataTableFilterOption[];
  badge?: (value: unknown, row: TRow) => DataTableBadge;
  align?: "left" | "right" | "center";
  hideable?: boolean;
  defaultHidden?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface BulkAction<TRow> {
  label: string;
  icon?: IconSvgElement;
  onClick: (rows: TRow[]) => void;
  variant?: "default" | "outline" | "ghost" | "destructive";
}

export const OPERATORS_BY_TYPE: Record<DataTableColumnType, FilterOperator[]> =
  {
    text: ["contains", "eq", "ne"],
    number: ["eq", "gt", "gte", "lt", "lte", "between"],
    date: ["before", "after", "between"],
    badge: ["in"],
    email: ["contains", "eq"],
    boolean: ["isTrue", "isFalse"],
  };

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: "contains",
  eq: "is",
  ne: "is not",
  gt: "greater than",
  gte: "≥",
  lt: "less than",
  lte: "≤",
  in: "is any of",
  between: "between",
  before: "before",
  after: "after",
  isTrue: "is true",
  isFalse: "is false",
};
