"use client";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginationControlsProps {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
  showPageInput?: boolean;
  showResultsText?: boolean;
}

export function PaginationControls({
  pagination,
  onPageChange,
  isLoading = false,
  className = "",
  showPageInput = true,
  showResultsText = true,
}: PaginationControlsProps) {
  const { total, page, limit, totalPages } = pagination;

  const startResult = total === 0 ? 0 : (page - 1) * limit + 1;
  const endResult = Math.min(page * limit, total);

  const handlePrevious = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPage = parseInt(e.target.value, 10);
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  if (totalPages <= 1 && !showResultsText) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {showResultsText ? (
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{startResult}</span> to{" "}
          <span className="font-medium">{endResult}</span> of{" "}
          <span className="font-medium">{total}</span> results
        </div>
      ) : (
        <div />
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          {showPageInput ? (
            <div className="flex items-center gap-1 text-sm">
              <span>Page</span>
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={page}
                onChange={handlePageInput}
                className="w-16 h-8 text-center"
                disabled={isLoading}
              />
              <span>of {totalPages}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={page >= totalPages || isLoading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
