"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import type {
  ColumnFilter,
  FilterOperator,
} from "~/server/api/list/list-input";
import { OPERATOR_LABELS, OPERATORS_BY_TYPE } from "./types";
import type { DataTableColumn } from "./types";
import type { DataTableApi } from "./use-data-table";

function operatorsFor<TRow>(column: DataTableColumn<TRow>): FilterOperator[] {
  return OPERATORS_BY_TYPE[column.type ?? "text"];
}

function describeFilter<TRow>(
  column: DataTableColumn<TRow>,
  filter: ColumnFilter,
): string {
  const label = OPERATOR_LABELS[filter.operator];
  const value = filter.value;
  if (filter.operator === "isTrue" || filter.operator === "isFalse") {
    return `${column.header} ${label}`;
  }
  if (filter.operator === "in" && Array.isArray(value)) {
    const values = value.map((item) =>
      String(
        column.options?.find((option) => option.value === String(item))
          ?.label ?? item,
      ),
    );
    return `${column.header}: ${values.join(", ")}`;
  }
  if (filter.operator === "between" && Array.isArray(value)) {
    return `${column.header} ${label} ${String(value[0])} – ${String(value[1])}`;
  }
  return `${column.header} ${label} ${String(value ?? "")}`;
}

function FilterEditor<TRow>({
  column,
  current,
  onApply,
  onCancel,
}: {
  column: DataTableColumn<TRow>;
  current?: ColumnFilter;
  onApply: (filter: ColumnFilter) => void;
  onCancel: () => void;
}) {
  const operators = operatorsFor(column);
  const [operator, setOperator] = useState<FilterOperator>(
    current?.operator ?? operators[0]!,
  );
  const [text, setText] = useState(
    typeof current?.value === "string" || typeof current?.value === "number"
      ? String(current.value)
      : "",
  );
  const [text2, setText2] = useState(
    Array.isArray(current?.value) && current.value.length === 2
      ? String(current.value[1])
      : "",
  );
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(current?.value) && column.type === "badge"
      ? current.value.map(String)
      : [],
  );
  const isNumber = column.type === "number";
  const isBetween = operator === "between";

  function apply() {
    if (column.type === "boolean") {
      onApply({ id: column.id, operator, value: null });
      return;
    }
    if (column.type === "badge") {
      if (selected.length) {
        onApply({ id: column.id, operator: "in", value: selected });
      }
      return;
    }
    if (isBetween) {
      if (!text || !text2) return;
      onApply({
        id: column.id,
        operator,
        value: isNumber ? [Number(text), Number(text2)] : [text, text2],
      });
      return;
    }
    if (!text) return;
    onApply({
      id: column.id,
      operator,
      value: isNumber ? Number(text) : text,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          aria-label="Back"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>
        <span className="text-sm font-medium">{column.header}</span>
      </div>
      {operators.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {operators.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={operator === item ? "secondary" : "ghost"}
              onClick={() => setOperator(item)}
            >
              {OPERATOR_LABELS[item]}
            </Button>
          ))}
        </div>
      )}
      {column.type === "boolean" ? null : column.type === "badge" ? (
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {column.options?.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    setSelected((currentItems) =>
                      value
                        ? [...currentItems, option.value]
                        : currentItems.filter((item) => item !== option.value),
                    )
                  }
                />
                {option.dotClassName && (
                  <span
                    className={cn("size-2 rounded-full", option.dotClassName)}
                  />
                )}
                <span className="text-sm">{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            type={
              column.type === "date" ? "date" : isNumber ? "number" : "text"
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && apply()}
            placeholder="Value"
            className="h-8"
          />
          {isBetween && (
            <>
              <span className="text-muted-foreground text-xs">and</span>
              <Input
                type={column.type === "date" ? "date" : "number"}
                value={text2}
                onChange={(event) => setText2(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && apply()}
                placeholder="Value"
                className="h-8"
              />
            </>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {current && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onApply({ id: column.id, operator, value: null })}
          >
            Remove
          </Button>
        )}
        <Button size="sm" onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

export function DataTableFilters<TRow>({
  columns,
  api,
}: {
  columns: DataTableColumn<TRow>[];
  api: DataTableApi<TRow>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const filterable = columns.filter((column) => column.filterable);
  if (!filterable.length) return null;

  const editingColumn = filterable.find(({ id }) => id === editing);
  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setEditing(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Filter"
          className="relative"
        >
          <HugeiconsIcon icon={FilterIcon} />
          {api.filters.length > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[9px] font-semibold">
              {api.filters.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-0 p-2">
        {editingColumn ? (
          <FilterEditor
            column={editingColumn}
            current={api.filters.find(({ id }) => id === editingColumn.id)}
            onApply={(filter) => {
              if (
                filter.value === null &&
                filter.operator !== "isTrue" &&
                filter.operator !== "isFalse"
              ) {
                api.removeFilter(filter.id);
              } else {
                api.upsertFilter(filter);
              }
              close();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            <Label className="text-muted-foreground px-2 py-1.5 text-xs">
              Filter by
            </Label>
            {filterable.map((column) => (
              <button
                key={column.id}
                type="button"
                onClick={() => setEditing(column.id)}
                className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
              >
                <span className="flex-1">{column.header}</span>
                {api.filters.some(({ id }) => id === column.id) && (
                  <span className="bg-primary size-1.5 rounded-full" />
                )}
              </button>
            ))}
            {api.filters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 justify-start"
                onClick={() => {
                  api.clearFilters();
                  close();
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function DataTableActiveFilters<TRow>({
  columns,
  api,
}: {
  columns: DataTableColumn<TRow>[];
  api: DataTableApi<TRow>;
}) {
  if (!api.filters.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {api.filters.map((filter) => {
        const column = columns.find(({ id }) => id === filter.id);
        if (!column) return null;
        return (
          <Badge
            key={filter.id}
            variant="secondary"
            className="h-6 gap-1 pr-1 pl-2.5"
          >
            <span className="max-w-52 truncate">
              {describeFilter(column, filter)}
            </span>
            <button
              type="button"
              aria-label={`Remove ${column.header} filter`}
              onClick={() => api.removeFilter(filter.id)}
              className="hover:bg-foreground/10 rounded-full p-0.5"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
            </button>
          </Badge>
        );
      })}
      <Button variant="ghost" size="sm" onClick={api.clearFilters}>
        Clear
      </Button>
    </div>
  );
}
