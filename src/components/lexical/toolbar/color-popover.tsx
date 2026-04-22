"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

type ColorPreset = { label: string; value: string };

const COLOR_PRESETS: ColorPreset[] = [
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Yellow", value: "#eab308" },
  { label: "Lime", value: "#84cc16" },
  { label: "Green", value: "#22c55e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Fuchsia", value: "#d946ef" },
  { label: "Pink", value: "#ec4899" },
  { label: "Rose", value: "#f43f5e" },
  { label: "White", value: "#ffffff" },
  { label: "Gray", value: "#9ca3af" },
  { label: "Black", value: "#000000" },
];

const LIGHT_SWATCHES = new Set(["#ffffff", "#eab308", "#f59e0b"]);

function normalizeColor(value: string): string {
  return value.trim().toLowerCase();
}

type TextColorPopoverProps = {
  activeColor: string;
  onSelect: (color: string) => void;
  onClear: () => void;
};

export function TextColorPopover({
  activeColor,
  onSelect,
  onClear,
}: TextColorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [customColor, setCustomColor] = useState<string>(
    activeColor || "#ffffff",
  );

  useEffect(() => {
    if (activeColor) setCustomColor(activeColor);
  }, [activeColor]);

  const active = normalizeColor(activeColor);
  const matchedPreset = COLOR_PRESETS.find(
    (p) => normalizeColor(p.value) === active,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Text color"
          aria-label="Text color"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "relative h-8 w-8",
            activeColor && "bg-accent text-accent-foreground",
          )}
        >
          <Palette className="h-4 w-4" />
          <span
            aria-hidden
            className="border-background absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full border"
            style={
              activeColor
                ? { backgroundColor: activeColor }
                : {
                    backgroundImage:
                      "linear-gradient(45deg, #ef4444 0 25%, #f59e0b 25% 50%, #22c55e 50% 75%, #3b82f6 75%)",
                  }
            }
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-60 p-3"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Text color
            </span>
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {COLOR_PRESETS.map((preset) => {
              const isActive = matchedPreset?.value === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  onClick={() => {
                    onSelect(preset.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "ring-border hover:ring-foreground/40 relative h-5 w-5 rounded-full ring-1 transition-all",
                    isActive && "ring-foreground ring-2",
                  )}
                  style={{ backgroundColor: preset.value }}
                >
                  {isActive ? (
                    <Check
                      className={cn(
                        "absolute inset-0 m-auto h-3 w-3",
                        LIGHT_SWATCHES.has(preset.value)
                          ? "text-black"
                          : "text-white",
                      )}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Custom</span>
            <input
              type="color"
              value={customColor || "#ffffff"}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onSelect(e.target.value);
              }}
              className="border-input h-7 w-10 cursor-pointer rounded border bg-transparent p-0"
            />
            <Input
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              onBlur={() => {
                if (/^#?[0-9a-fA-F]{3,8}$/.test(customColor)) {
                  const normalized = customColor.startsWith("#")
                    ? customColor
                    : `#${customColor}`;
                  onSelect(normalized);
                }
              }}
              placeholder="#ffffff"
              className="h-7 flex-1 font-mono text-xs"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
