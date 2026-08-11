"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowLeftDoubleIcon,
  ArrowRight01Icon,
  ArrowRightDoubleIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { DataTableApi } from "./use-data-table";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DataTablePagination<TRow>({
  api,
  total,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: {
  api: DataTableApi<TRow>;
  total: number;
  pageSizeOptions?: number[];
}) {
  const { page, pageSize, setPage, setPageSize } = api;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {from.toLocaleString()}–{to.toLocaleString()} of{" "}
          {total.toLocaleString()}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
              {pageSize} / page
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-32 gap-0.5 p-1">
            {pageSizeOptions.map((size) => (
              <Button
                key={size}
                variant={size === pageSize ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => setPageSize(size)}
              >
                {size} / page
              </Button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-2 tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="First page"
          onClick={() => setPage(1)}
          disabled={page <= 1}
        >
          <HugeiconsIcon icon={ArrowLeftDoubleIcon} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          onClick={() => setPage(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Last page"
          onClick={() => setPage(pageCount)}
          disabled={page >= pageCount}
        >
          <HugeiconsIcon icon={ArrowRightDoubleIcon} />
        </Button>
      </div>
    </div>
  );
}
