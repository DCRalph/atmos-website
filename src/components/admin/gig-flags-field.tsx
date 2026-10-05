"use client";

import { Switch } from "~/components/ui/switch";
import { GIG_FLAGS, type GigFlags } from "~/lib/gig-flags";

/**
 * The gig's flags as a stack of switches, one per flag with what it does
 * underneath. Used by the gig editor and the import wizard's review step.
 * `id` goes on the first switch so a surrounding label can point at it.
 */
export function GigFlagsField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: GigFlags;
  onChange: (key: keyof GigFlags, checked: boolean) => void;
}) {
  return (
    <div className="border-input divide-input divide-y rounded-md border px-3">
      {GIG_FLAGS.map((flag, index) => (
        <label
          key={flag.key}
          className="flex cursor-pointer items-start gap-3 py-3"
        >
          <Switch
            id={index === 0 ? id : undefined}
            checked={value[flag.key]}
            onCheckedChange={(checked) => onChange(flag.key, checked)}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{flag.label}</span>
            <span className="text-muted-foreground text-xs">
              {flag.summary}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
