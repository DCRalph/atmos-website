"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { DataTableCell } from "./cells";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import type { BulkAction, DataTableColumn } from "./types";
import { useDataTable, type DataTableApi } from "./use-data-table";

export interface DataTableProps<TRow> {
  api?: DataTableApi<TRow>;
  columns: DataTableColumn<TRow>[];
  data: TRow[];
  getRowId: (row: TRow) => string;
  total?: number;
  isLoading?: boolean;
  isFetching?: boolean;
  onRowClick?: (row: TRow) => void;
  rowClassName?: (row: TRow) => string | undefined;
  bulkActions?: BulkAction<TRow>[];
  enableSelection?: boolean;
  enableSearch?: boolean;
  enablePagination?: boolean;
  searchPlaceholder?: string;
  toolbarActions?: ReactNode;
  emptyMessage?: string;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  storageKey?: string;
  loadingRows?: number;
}

function alignClass(align?: "left" | "right" | "center") {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<TRow>({
  api: suppliedApi,
  columns,
  data,
  getRowId,
  total = data.length,
  isLoading = false,
  isFetching = false,
  onRowClick,
  rowClassName,
  bulkActions,
  enableSelection = Boolean(bulkActions),
  enableSearch = false,
  enablePagination = false,
  searchPlaceholder,
  toolbarActions,
  emptyMessage = "No results.",
  title,
  description,
  className,
  storageKey = "admin-table",
  loadingRows = 5,
}: DataTableProps<TRow>) {
  const localApi = useDataTable({
    columns,
    getRowId,
    storageKey,
  });
  const api = suppliedApi ?? localApi;
  const visibleColumns = columns.filter((column) =>
    api.isColumnVisible(column.id),
  );
  const pageIds = data.map((row) => api.getRowId(row));
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => api.isSelected(id));
  const someSelected = pageIds.some((id) => api.isSelected(id));
  const selectedCount = api.selected.size;
  const colSpan = Math.max(
    visibleColumns.length + (enableSelection ? 1 : 0),
    1,
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {(title != null || description != null) && (
        <div className="flex flex-col gap-0.5">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      )}

      <DataTableToolbar
        columns={columns}
        api={api}
        enableSearch={enableSearch}
        searchPlaceholder={searchPlaceholder}
        isFetching={isFetching}
        actions={toolbarActions}
      />

      <div className="border-border bg-card relative overflow-hidden rounded-2xl border">
        {enableSelection && selectedCount > 0 && (
          <div className="border-border bg-accent/40 flex items-center gap-2 border-b px-3 py-2 text-sm">
            <span className="font-medium">{selectedCount} selected</span>
            <div className="ml-auto flex items-center gap-2">
              {bulkActions?.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant={action.variant ?? "outline"}
                  onClick={() => action.onClick(api.getSelectedRows(data))}
                >
                  {action.icon && (
                    <HugeiconsIcon icon={action.icon} strokeWidth={2} />
                  )}
                  {action.label}
                </Button>
              ))}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Clear selection"
                onClick={api.clearSelection}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {enableSelection && (
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Select all on this page"
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(value) =>
                      api.setPageSelection(pageIds, value === true)
                    }
                  />
                </TableHead>
              )}
              {visibleColumns.map((column) => {
                const sortState = api.sort[0];
                const isSorted = sortState?.id === column.id;
                return (
                  <TableHead
                    key={column.id}
                    className={cn(
                      "text-foreground/80",
                      alignClass(column.align),
                      column.sortable &&
                        "hover:text-foreground cursor-pointer transition-colors select-none",
                      column.headerClassName,
                    )}
                    onClick={
                      column.sortable
                        ? () => api.toggleSort(column.id)
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "group/th inline-flex items-center gap-1.5",
                        column.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {column.icon && (
                        <HugeiconsIcon
                          icon={column.icon}
                          strokeWidth={2}
                          className="text-muted-foreground size-4"
                        />
                      )}
                      {column.header}
                      {column.sortable &&
                        (isSorted ? (
                          sortState?.desc ? (
                            <HugeiconsIcon
                              icon={ArrowDown01Icon}
                              strokeWidth={2}
                            />
                          ) : (
                            <HugeiconsIcon
                              icon={ArrowUp01Icon}
                              strokeWidth={2}
                            />
                          )
                        ) : (
                          <HugeiconsIcon
                            icon={ArrowUpDownIcon}
                            strokeWidth={2}
                            className="text-muted-foreground/40 opacity-0 transition-opacity group-hover/th:opacity-100"
                          />
                        ))}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody
            className={cn(isFetching && "opacity-60 transition-opacity")}
          >
            {isLoading &&
              Array.from({ length: loadingRows }).map((_, index) => (
                <TableRow key={`skeleton-${index}`} className="border-border">
                  {enableSelection && (
                    <TableCell className="pl-4">
                      <Skeleton className="size-4 rounded-[5px]" />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading &&
              data.map((row) => {
                const id = api.getRowId(row);
                const selected = api.isSelected(id);
                return (
                  <TableRow
                    key={id}
                    data-state={selected ? "selected" : undefined}
                    className={cn(
                      "border-border",
                      onRowClick && "cursor-pointer",
                      rowClassName?.(row),
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {enableSelection && (
                      <TableCell
                        className="pl-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          aria-label="Select row"
                          checked={selected}
                          onCheckedChange={() => api.toggleRow(id)}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          alignClass(column.align),
                          column.className,
                        )}
                      >
                        <DataTableCell column={column} row={row} />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}

            {!isLoading && data.length === 0 && (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell
                  colSpan={colSpan}
                  className="text-muted-foreground py-12 text-center text-sm"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && <DataTablePagination api={api} total={total} />}
    </div>
  );
}
