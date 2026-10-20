"use client";

import {
  Check,
  CircleAlert,
  Loader2,
  PencilLine,
  Save,
  Undo2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type SaveStatusPillProps = {
  status: SaveStatus;
  className?: string;
  errorMessage?: string | null;
};

/**
 * The save indicator shared by the admin editors, so "unsaved changes" looks and
 * reads the same everywhere. Silent when there is nothing to say.
 */
export function SaveStatusPill({
  status,
  className,
  errorMessage,
}: SaveStatusPillProps) {
  if (status === "idle") return null;

  const config = {
    dirty: {
      icon: <PencilLine className="h-3.5 w-3.5" />,
      label: "Unsaved changes",
      classes:
        "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    saving: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: "Saving…",
      classes: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    saved: {
      icon: <Check className="h-3.5 w-3.5" />,
      label: "Saved",
      classes:
        "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    error: {
      icon: <CircleAlert className="h-3.5 w-3.5" />,
      label: errorMessage ?? "Save failed",
      classes: "border-destructive/40 bg-destructive/10 text-destructive",
    },
  }[status];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        config.classes,
        className,
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

type SaveBarProps = {
  status: SaveStatus;
  errorMessage?: string | null;
  /** Said beside the pill. A phone has room for one or the other, so it is hidden there while the pill shows. */
  message?: React.ReactNode;
  saveLabel: string;
  isSaving: boolean;
  disabled?: boolean;
  onSave: () => void;
  /** Offered only when given, so pass it only while there is something to discard. */
  onDiscard?: () => void;
  /** The fields the bar saves. */
  children: React.ReactNode;
};

/**
 * An admin editor's one and only Save, wrapped around the fields it saves.
 *
 * From `sm` up it sits above the fields and sticks under the header. On a
 * phone that put a two-line bar over the middle of the form, so there it moves
 * below the fields and sticks to the bottom of the screen as one compact line.
 * Being last in the flow means it reserves its own room, so the final field is
 * never hidden behind it.
 *
 * Expects to be the last thing in an `AdminSection`: the negative margins meet
 * that section's mobile padding so the bar runs edge to edge.
 */
export function SaveBar({
  status,
  errorMessage,
  message,
  saveLabel,
  isSaving,
  disabled,
  onSave,
  onDiscard,
  children,
}: SaveBarProps) {
  return (
    <div className="flex flex-col">
      <div className="bg-background/95 sticky top-20 z-20 -mx-2 mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 backdrop-blur max-sm:top-auto max-sm:bottom-0 max-sm:order-last max-sm:-mx-4 max-sm:mt-6 max-sm:-mb-5 max-sm:flex-nowrap max-sm:gap-2 max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pt-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <SaveStatusPill
          status={status}
          errorMessage={errorMessage}
          className="min-w-0 max-sm:[&>span]:truncate"
        />
        {message ? (
          <span
            className={cn(
              "text-muted-foreground min-w-0 text-sm max-sm:truncate",
              status !== "idle" && "max-sm:hidden",
            )}
          >
            {message}
          </span>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {onDiscard ? (
            <Button
              variant="ghost"
              disabled={isSaving || disabled}
              onClick={onDiscard}
            >
              <Undo2 className="size-4" />
              Discard<span className="max-sm:hidden"> changes</span>
            </Button>
          ) : null}
          <Button onClick={onSave} disabled={isSaving || disabled}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isSaving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
