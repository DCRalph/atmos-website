"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  Rocket,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

export type ChecklistEntry = {
  /** What was checked, written as the thing itself rather than as a question. */
  label: string;
  ok: boolean;
  /** The answer: the value when it passed, what is missing when it did not. */
  detail: string;
  /** Where to go and fix it. */
  step?: "review" | "lineup";
};

/**
 * Step four: the only screen that can make a gig public.
 *
 * Nothing here blocks. Everything import could not be sure of is already a real
 * gig field with a real value in it, so the honest thing is to list what was
 * guessed and let the admin decide, rather than invent a rule that pretends a
 * missing end time is worse than a wrong one.
 */
export function StepPublish({
  gigId,
  gigPath,
  checklist,
  isPublishing,
  onPublish,
  onGoToStep,
}: {
  gigId: string;
  /** The public URL, for the preview link. */
  gigPath: string;
  checklist: ChecklistEntry[];
  isPublishing: boolean;
  onPublish: () => void;
  onGoToStep: (step: "review" | "lineup") => void;
}) {
  const warnings = checklist.filter((entry) => !entry.ok);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Before it goes live</CardTitle>
          <CardDescription>
            {warnings.length === 0
              ? "Everything the post said came through cleanly."
              : `${warnings.length} thing${warnings.length === 1 ? "" : "s"} the import had to guess at or could not find.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border divide-y">
          {checklist.map((entry) => (
            <div
              key={entry.label}
              className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span
                className={cn(
                  "grid size-[17px] shrink-0 place-items-center rounded border text-[10px] font-bold",
                  entry.ok
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400",
                )}
              >
                {entry.ok ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <AlertTriangle className="size-2.5" aria-hidden />
                )}
              </span>
              <span className="text-sm">{entry.label}</span>
              <span className="text-muted-foreground ml-auto text-xs">
                {entry.detail}
              </span>
              {!entry.ok && entry.step ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => onGoToStep(entry.step!)}
                >
                  Fix
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publish</CardTitle>
          <CardDescription>
            It appears on the gigs page and in the app straight away.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={onPublish} disabled={isPublishing}>
            {isPublishing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Rocket className="size-4" aria-hidden />
            )}
            Publish gig
          </Button>
          <Button variant="outline" asChild>
            <a href={gigPath} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              Preview the public page
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/admin/gigs/${gigId}`}>Open in the full editor</Link>
          </Button>
          <p className="text-muted-foreground pt-1 text-xs">
            A draft stays out of every public list until this is pressed. Only
            admins can see the preview.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
