"use client";

import { Undo2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import type { Confidence } from "~/lib/gig-import/extraction";
import { FieldMarker } from "./source-panel";
import type { MarkedField } from "./field-marks";

/**
 * A field that remembers where it came from.
 *
 * Three things have to be visible at once for a review to be worth doing: what
 * the value is, what it was read from, and whether it has been changed since.
 * Wrapping the control rather than replacing it means the wizard uses the same
 * inputs as the gig editor and only adds the receipt underneath.
 */
export function ProvenanceField({
  id,
  label,
  required,
  marker,
  confidence,
  quote,
  note,
  isEdited,
  importedLabel,
  onRevert,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  /** Ties the field to its highlight in the caption. */
  marker?: MarkedField;
  confidence: Confidence;
  /** The caption text this was read from. Empty when it was inferred. */
  quote: string;
  /** Why, when it was inferred. */
  note: string;
  isEdited: boolean;
  /** What the import put here, shown so a revert is a known quantity. */
  importedLabel: string | null;
  onRevert: () => void;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  // A field the admin has typed over needs no confidence badge: it is now
  // theirs, and saying the import was unsure about it is just noise.
  const flagged = !isEdited && confidence === "low";

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        (flagged || isEdited) && "border-l-2 pl-3",
        flagged && "border-amber-500/60",
        isEdited && "border-violet-500/60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive ml-0.5">*</span> : null}
        </Label>
        {marker ? <FieldMarker field={marker} /> : null}
        <div className="ml-auto flex items-center gap-2">
          {isEdited ? (
            <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">
              Edited
            </span>
          ) : flagged ? (
            <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
              Needs a look
            </span>
          ) : null}
        </div>
      </div>

      {children}

      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {isEdited ? (
            <>
              <span>
                Imported as{" "}
                <span className="font-mono">
                  {importedLabel ? `"${importedLabel}"` : "nothing"}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={onRevert}
              >
                <Undo2 className="size-3" aria-hidden />
                Revert
              </Button>
            </>
          ) : quote ? (
            <span>
              Read from <span className="font-mono">&ldquo;{quote}&rdquo;</span>
            </span>
          ) : note ? (
            <span>{note}</span>
          ) : hint ? (
            <span>{hint}</span>
          ) : (
            <span>The post did not say.</span>
          )}
        </div>
      )}
    </div>
  );
}
