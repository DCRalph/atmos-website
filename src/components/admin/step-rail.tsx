"use client";

import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

export type RailStep<Key extends string> = {
  readonly key: Key;
  readonly label: string;
};

/**
 * Where the admin is in a wizard, and how to get back to a step they have
 * finished.
 *
 * Steps behind the current one are links because reviewing is not linear: a
 * checklist on the last step can point at a field two steps back, and it has
 * to be possible to go and fix it. Steps ahead are not, because they have not
 * been reached yet.
 */
export function StepRail<Key extends string>({
  steps,
  current,
  furthest,
  onSelect,
}: {
  steps: readonly RailStep<Key>[];
  current: Key;
  /** The furthest step reached, which is how far back-navigation goes. */
  furthest: Key;
  onSelect: (step: Key) => void;
}) {
  const indexOf = (step: Key) => steps.findIndex((entry) => entry.key === step);
  const currentIndex = indexOf(current);
  const furthestIndex = indexOf(furthest);

  return (
    <ol className="bg-card border-border mb-6 flex flex-col overflow-hidden rounded-lg border sm:flex-row">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex;
        const canGo = index <= furthestIndex && !isCurrent;

        return (
          <li
            key={step.key}
            className="border-border min-w-0 flex-1 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0"
          >
            <button
              type="button"
              disabled={!canGo}
              onClick={() => onSelect(step.key)}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm",
                isCurrent
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground",
                canGo && "hover:text-foreground cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[11px]",
                  isCurrent &&
                    "bg-primary text-primary-foreground border-primary font-semibold",
                  isDone &&
                    "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                  !isCurrent && !isDone && "border-input",
                )}
              >
                {isDone ? <Check className="size-3" aria-hidden /> : index + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
