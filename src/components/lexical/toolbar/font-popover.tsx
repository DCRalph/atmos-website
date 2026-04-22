"use client";

import { useState } from "react";
import { Check, Type } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type FontFamilyOption = {
  id: string;
  label: string;
  stack: string;
};

export const FONT_FAMILIES: FontFamilyOption[] = [
  {
    id: "sans",
    label: "Sans serif",
    stack:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "serif",
    label: "Serif",
    stack: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    id: "script",
    label: "Script",
    stack:
      '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive',
  },
  {
    id: "display",
    label: "Display",
    stack:
      'Impact, "Arial Black", "Helvetica Neue", Haettenschweiler, "Franklin Gothic Bold", sans-serif',
  },
  {
    id: "mono",
    label: "Mono",
    stack:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
];

export function findFontFamilyMatch(raw: string): FontFamilyOption | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/\s+/g, "");
  for (const f of FONT_FAMILIES) {
    const stackNormalized = f.stack.toLowerCase().replace(/\s+/g, "");
    if (normalized === stackNormalized) return f;
    const firstFamily = f.stack
      .split(",")[0]
      ?.trim()
      .replace(/^["']|["']$/g, "")
      .toLowerCase();
    if (firstFamily && raw.toLowerCase().includes(firstFamily)) return f;
  }
  return null;
}

type FontFamilyPopoverProps = {
  active: FontFamilyOption | null;
  onSelect: (stack: string) => void;
  onClear: () => void;
};

export function FontFamilyPopover({
  active,
  onSelect,
  onClear,
}: FontFamilyPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Font family"
          aria-label="Font family"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "h-8 gap-1.5 px-2 text-xs",
            active && "bg-accent text-accent-foreground",
          )}
        >
          <Type className="h-4 w-4" />
          <span className="hidden max-w-22 truncate sm:inline">
            {active?.label ?? "Font"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-1"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className={cn(
              "hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs",
              !active && "bg-accent text-accent-foreground",
            )}
          >
            <span className="text-muted-foreground">Default</span>
            {!active ? <Check className="h-3.5 w-3.5" /> : null}
          </button>
          <div className="bg-border my-1 h-px" aria-hidden />
          {FONT_FAMILIES.map((f) => {
            const isActive = active?.id === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onSelect(f.stack);
                  setOpen(false);
                }}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  isActive && "bg-accent text-accent-foreground",
                )}
                style={{ fontFamily: f.stack }}
              >
                <span>{f.label}</span>
                {isActive ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
