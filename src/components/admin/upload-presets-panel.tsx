"use client";

import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { describeAcceptedTypes, formatBytes } from "~/lib/uploads/validate";

/**
 * Read-only view of every upload target in the app, straight from the preset
 * registry in `src/lib/uploads/presets.ts`, plus how much each one has stored.
 * Constraints are code, not settings — this is where you check what is
 * actually enforced and where.
 */
export function UploadPresetsPanel() {
  const { data: presets, isLoading } = api.uploads.presets.useQuery();
  const utils = api.useUtils();

  const sweep = api.uploads.sweepStale.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.removed === 0
          ? "No abandoned uploads to clean up"
          : `Cleared ${result.removed} abandoned upload${result.removed === 1 ? "" : "s"}`,
      );
      void utils.uploads.presets.invalidate();
      void utils.files.getAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading upload targets...
      </div>
    );
  }

  const totalStored = presets?.reduce((sum, p) => sum + p.storedBytes, 0) ?? 0;
  const totalOriginal =
    presets?.reduce((sum, p) => sum + p.originalBytes, 0) ?? 0;
  const saved = Math.max(0, totalOriginal - totalStored);
  const rows = presets ?? [];
  type PresetRow = (typeof rows)[number];
  const columns: DataTableColumn<PresetRow>[] = [
    {
      id: "target",
      header: "Target",
      cell: (preset) => (
        <div>
          <div className="font-medium">{preset.label}</div>
          <div className="text-muted-foreground text-xs">
            {preset.description}
          </div>
          <code className="text-muted-foreground text-[11px]">
            {preset.name}
          </code>
        </div>
      ),
    },
    {
      id: "who",
      header: "Who",
      cell: (preset) => (
        <Badge variant="outline" className="capitalize">
          {preset.access}
        </Badge>
      ),
    },
    {
      id: "accepted",
      header: "Accepted",
      cell: (preset) => describeAcceptedTypes(preset.accept),
      className: "max-w-56 text-xs",
    },
    {
      id: "perFile",
      header: "Per file",
      align: "right",
      cell: (preset) => formatBytes(preset.maxFileSize),
      className: "text-xs whitespace-nowrap",
    },
    {
      id: "perBatch",
      header: "Per batch",
      align: "right",
      cell: (preset) => (
        <>
          {preset.maxFiles} file{preset.maxFiles === 1 ? "" : "s"}
          <div className="text-muted-foreground">
            {formatBytes(preset.maxTotalSize)}
          </div>
        </>
      ),
      className: "text-xs whitespace-nowrap",
    },
    {
      id: "processing",
      header: "Image processing",
      className: "text-xs",
      cell: (preset) =>
        preset.image ? (
          <div className="space-y-0.5">
            {preset.image.maxDimension && (
              <div>Max {preset.image.maxDimension}px</div>
            )}
            <div className="text-muted-foreground">
              {(preset.image.format ?? "webp").toUpperCase()} q
              {preset.image.quality ?? 82}
            </div>
            {preset.image.maxOutputSize && (
              <div className="text-muted-foreground">
                Target ≤ {formatBytes(preset.image.maxOutputSize)}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">Stored as-is</span>
        ),
    },
    {
      id: "stored",
      header: "Stored",
      align: "right",
      className: "text-xs whitespace-nowrap",
      cell: (preset) => (
        <>
          {formatBytes(preset.storedBytes)}
          <div className="text-muted-foreground">
            {preset.fileCount} file{preset.fileCount === 1 ? "" : "s"}
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Upload targets</CardTitle>
              <CardDescription>
                Every place the app accepts a file, with the limits enforced
                there. Defined in{" "}
                <code className="text-xs">src/lib/uploads/presets.ts</code> —
                edit that file to change a limit or add a new target.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sweep.mutate({ olderThanHours: 24 })}
              disabled={sweep.isPending}
            >
              {sweep.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Clean up abandoned uploads
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Targets" value={String(presets?.length ?? 0)} />
            <Stat label="Stored" value={formatBytes(totalStored)} />
            <Stat
              label="Saved by processing"
              value={formatBytes(saved)}
              hint={
                totalOriginal > 0
                  ? `${Math.round((saved / totalOriginal) * 100)}% smaller than the originals`
                  : undefined
              }
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.name}
        storageKey="admin-upload-presets"
        emptyMessage="No upload targets found."
      />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint ? (
        <div className="text-muted-foreground text-[11px]">{hint}</div>
      ) : null}
    </div>
  );
}
