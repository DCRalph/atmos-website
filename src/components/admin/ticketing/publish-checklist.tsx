"use client";

import { Check, CircleAlert, Loader2, Minus } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";

type EventStatus = RouterOutputs["ticketEvents"]["byId"]["status"];

/**
 * One line of the pre-publish checklist. `needed` blocks Publish; `advice` is
 * worth a look but never stops anything.
 */
export type ChecklistItem = {
  label: string;
  detail?: string;
  state: "ok" | "needed" | "advice";
  /** The event tab where it gets fixed, when that isn't this form. */
  tab?: "tiers" | "staff";
};

/**
 * What stands between the event and going on sale, with the Publish button
 * that only unlocks once nothing is needed. Once the event is past draft the
 * status menu in the header takes over, and this becomes a quiet health check.
 */
export function PublishChecklist({
  items,
  status,
  publishing,
  onPublish,
  onOpenTab,
}: {
  items: ChecklistItem[];
  /** Null while the event is still being created. */
  status: EventStatus | null;
  publishing: boolean;
  onPublish?: () => void;
  onOpenTab?: (tab: "tiers" | "staff") => void;
}) {
  const blocked = items.some((item) => item.state === "needed");
  const isDraft = status === "DRAFT";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isDraft || !status ? "Ready to publish?" : "Health check"}
        </CardTitle>
        <CardDescription>
          {!status
            ? "Create the event, then publish it from here."
            : isDraft
              ? "Publish unlocks once nothing is marked as needed."
              : "The event is past draft. Change its status from the menu at the top."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.label} className="flex items-start gap-3 text-sm">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                  item.state === "ok" &&
                    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  item.state === "needed" &&
                    "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                  item.state === "advice" && "bg-muted text-muted-foreground",
                )}
                aria-label={
                  item.state === "ok"
                    ? "Done"
                    : item.state === "needed"
                      ? "Needed"
                      : "Optional"
                }
              >
                {item.state === "ok" ? (
                  <Check className="size-3" />
                ) : item.state === "needed" ? (
                  <CircleAlert className="size-3" />
                ) : (
                  <Minus className="size-3" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">{item.label}</span>
                {item.detail ? (
                  <span className="text-muted-foreground block text-xs">
                    {item.detail}
                  </span>
                ) : null}
              </span>
              {item.tab && item.state !== "ok" && onOpenTab ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => item.tab && onOpenTab(item.tab)}
                >
                  Open {item.tab}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {isDraft && onPublish ? (
          <Button
            className="w-full"
            disabled={blocked || publishing}
            onClick={onPublish}
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : null}
            Publish
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
