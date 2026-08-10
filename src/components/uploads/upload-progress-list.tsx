"use client";

import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatBytes } from "~/lib/uploads/validate";
import type { UploadItem } from "~/hooks/use-upload";

const STATUS_LABEL: Record<UploadItem["status"], string> = {
  queued: "Waiting",
  preparing: "Preparing",
  uploading: "Uploading",
  processing: "Processing",
  done: "Done",
  error: "Failed",
  cancelled: "Cancelled",
};

/** Per-file progress rows, shared by every upload surface. */
export function UploadProgressList({
  items,
  onCancel,
  className,
}: {
  items: UploadItem[];
  onCancel?: (itemId: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item) => {
        const inFlight =
          item.status === "preparing" ||
          item.status === "uploading" ||
          item.status === "processing";

        return (
          <li key={item.id} className="rounded-md border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              {item.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : item.status === "error" ? (
                <AlertCircle className="text-destructive h-4 w-4 shrink-0" />
              ) : inFlight ? (
                <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <span className="bg-muted-foreground/40 h-2 w-2 shrink-0 rounded-full" />
              )}

              <span className="min-w-0 flex-1 truncate" title={item.file.name}>
                {item.file.name}
              </span>

              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {item.status === "done" && item.result?.isDuplicate
                  ? "Already uploaded"
                  : item.status === "done"
                    ? formatBytes(item.result?.size ?? item.file.size)
                    : STATUS_LABEL[item.status]}
              </span>

              {onCancel && inFlight ? (
                <button
                  type="button"
                  onClick={() => onCancel(item.id)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label={`Cancel upload of ${item.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {inFlight ? (
              <div
                className="bg-muted mt-2 h-1 overflow-hidden rounded-full"
                role="progressbar"
                aria-valuenow={item.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Upload progress for ${item.file.name}`}
              >
                <div
                  className="bg-primary h-full transition-all duration-200"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            ) : null}

            {item.error ? (
              <p className="text-destructive mt-1 text-xs">{item.error}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
