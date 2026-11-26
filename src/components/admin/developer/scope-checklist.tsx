"use client";

import {
  ALL_SCOPES,
  SCOPE_RESOURCE_LABELS,
  type ApiScope,
  type ScopeResource,
} from "~/lib/developer/scopes";
import { Checkbox } from "~/components/ui/checkbox";

/**
 * Every scope as a checkbox, grouped by what it is about. Dangerous ones say
 * so in amber. Used to make a key, and to pick a playground key's scopes.
 */
export function ScopeChecklist({
  selected,
  onToggle,
  idPrefix = "scope",
}: {
  selected: readonly ApiScope[];
  onToggle: (scope: ApiScope, on: boolean) => void;
  idPrefix?: string;
}) {
  const resources = Object.keys(SCOPE_RESOURCE_LABELS) as ScopeResource[];

  return (
    <div className="divide-border max-h-[50vh] divide-y overflow-y-auto rounded-md border">
      {resources.map((resource) => (
        <div key={resource}>
          <div className="bg-muted/30 text-muted-foreground px-3 py-1.5 text-xs font-medium">
            {SCOPE_RESOURCE_LABELS[resource]}
          </div>
          {ALL_SCOPES.filter((entry) => entry.resource === resource).map(
            (entry) => {
              const id = `${idPrefix}-${entry.scope}`;
              return (
                <label
                  key={entry.scope}
                  htmlFor={id}
                  className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 px-3 py-2"
                >
                  <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={selected.includes(entry.scope)}
                    onCheckedChange={(checked) =>
                      onToggle(entry.scope, checked === true)
                    }
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{entry.label}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {entry.scope}
                      </span>
                    </span>
                    <span
                      className={`block text-xs ${entry.dangerous ? "text-amber-500" : "text-muted-foreground"}`}
                    >
                      {entry.description}
                    </span>
                  </span>
                </label>
              );
            },
          )}
        </div>
      ))}
    </div>
  );
}
