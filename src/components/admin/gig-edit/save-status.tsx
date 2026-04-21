"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Loader2, PencilLine } from "lucide-react";
import { cn } from "~/lib/utils";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type SaveStatusPillProps = {
  status: SaveStatus;
  className?: string;
  errorMessage?: string | null;
};

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
      label: "Saving...",
      classes:
        "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
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
      classes:
        "border-destructive/40 bg-destructive/10 text-destructive",
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

type UseSaveStatusOptions = {
  autoResetMs?: number;
  onDirtyChange?: (dirty: boolean) => void;
};

type UseSaveStatusResult = {
  status: SaveStatus;
  errorMessage: string | null;
  markDirty: () => void;
  markSaving: () => void;
  markSaved: () => void;
  markError: (message?: string) => void;
  markIdle: () => void;
  isDirty: boolean;
};

export function useSaveStatus({
  autoResetMs = 2500,
  onDirtyChange,
}: UseSaveStatusOptions = {}): UseSaveStatusResult {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const setDirty = (next: boolean) => {
    if (dirtyRef.current === next) return;
    dirtyRef.current = next;
    onDirtyChange?.(next);
  };

  return {
    status,
    errorMessage,
    isDirty: status === "dirty",
    markDirty: () => {
      clearTimer();
      setErrorMessage(null);
      setStatus("dirty");
      setDirty(true);
    },
    markSaving: () => {
      clearTimer();
      setErrorMessage(null);
      setStatus("saving");
    },
    markSaved: () => {
      clearTimer();
      setErrorMessage(null);
      setStatus("saved");
      setDirty(false);
      timerRef.current = setTimeout(() => {
        setStatus("idle");
      }, autoResetMs);
    },
    markError: (message?: string) => {
      clearTimer();
      setErrorMessage(message ?? null);
      setStatus("error");
    },
    markIdle: () => {
      clearTimer();
      setErrorMessage(null);
      setStatus("idle");
      setDirty(false);
    },
  };
}
