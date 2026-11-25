"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { AdminSection } from "~/components/admin/admin-section";
import { StepRail, type RailStep } from "~/components/admin/step-rail";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { WIZARDS, wizardHref, type WizardKey } from "./catalog";

/**
 * Which step a wizard is on, and how far it has been. Steps are walked in
 * order; the rail can jump back to any step already reached.
 */
export function useSteps<Key extends string>(
  steps: readonly RailStep<Key>[],
  /** Where to open, when the URL already answered the steps before it. */
  start?: Key,
) {
  const [index, setIndex] = useState(() =>
    Math.max(0, start ? steps.findIndex((step) => step.key === start) : 0),
  );
  const [reached, setReached] = useState(index);

  const goToIndex = useCallback((next: number) => {
    setIndex(next);
    setReached((current) => Math.max(current, next));
  }, []);

  const goTo = useCallback(
    (key: Key) => goToIndex(steps.findIndex((step) => step.key === key)),
    [goToIndex, steps],
  );

  const first = steps[0]!.key;
  return {
    steps,
    step: steps[index]?.key ?? first,
    furthest: steps[Math.max(index, reached)]?.key ?? first,
    isFirst: index === 0,
    isLast: index === steps.length - 1,
    goTo,
    next: () => goToIndex(Math.min(index + 1, steps.length - 1)),
    back: () => goToIndex(Math.max(index - 1, 0)),
  };
}

export type Steps<Key extends string> = ReturnType<typeof useSteps<Key>>;

/**
 * The frame every wizard sits in: its title, what it is working on, the step
 * rail, and once saved, the done screen in place of the steps.
 *
 * Leaving with unsaved work asks first, as the full editors do.
 */
export function WizardShell<Key extends string>({
  wizard,
  subtitle,
  editorHref,
  steps,
  isDirty = false,
  done,
  children,
}: {
  wizard: WizardKey;
  /** What it is working on, e.g. the gig's title and date. */
  subtitle?: string;
  /** The full editor for the same thing, for anyone who wants every field. */
  editorHref?: string;
  /** Omitted on a single screen, such as the "which gig?" step. */
  steps?: Steps<Key>;
  isDirty?: boolean;
  /** Shown instead of the steps once the wizard has saved. */
  done?: ReactNode;
  children?: ReactNode;
}) {
  useUnsavedChangesWarning({ enabled: isDirty && !done });

  return (
    <AdminSection
      title={WIZARDS[wizard].title}
      subtitle={subtitle}
      backLink={{ href: "/admin/do", label: "Quick actions" }}
      maxWidth="max-w-4xl"
      actions={
        editorHref ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={editorHref}>
              <ExternalLink className="size-4" aria-hidden />
              Full editor
            </Link>
          </Button>
        ) : null
      }
    >
      {done ?? (
        <>
          {steps && steps.steps.length > 1 ? (
            <StepRail
              steps={steps.steps}
              current={steps.step}
              furthest={steps.furthest}
              onSelect={steps.goTo}
            />
          ) : null}
          {children}
        </>
      )}
    </AdminSection>
  );
}

/**
 * Back and the main action, under a step. The main action is Next until the
 * last step, where the wizard names what it does ("Save 2 changes").
 */
export function WizardFooter({
  onBack,
  backLabel = "Back",
  label = "Next",
  onNext,
  disabled,
  isPending,
  hint,
  secondary,
}: {
  onBack?: () => void;
  backLabel?: string;
  label?: string;
  onNext: () => void;
  disabled?: boolean;
  isPending?: boolean;
  /** Why the main action is off, or what it will do. */
  hint?: ReactNode;
  /** A second way to finish, beside the main one, e.g. "Save and publish". */
  secondary?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  const isNext = label === "Next";
  return (
    <div className="border-border mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div>
        {onBack ? (
          <Button variant="outline" onClick={onBack} disabled={isPending}>
            <ArrowLeft className="size-4" aria-hidden />
            {backLabel}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
        {secondary ? (
          <Button
            variant="outline"
            onClick={secondary.onClick}
            disabled={Boolean(secondary.disabled) || isPending}
          >
            {secondary.label}
          </Button>
        ) : null}
        <Button onClick={onNext} disabled={Boolean(disabled) || isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {label}
          {isNext ? <ArrowRight className="size-4" aria-hidden /> : null}
        </Button>
      </div>
    </div>
  );
}

/** A suggestion on the done screen: another wizard, already pointed at the same thing. */
export type NextWizard = {
  key: WizardKey;
  gigId?: string | null;
  eventId?: string | null;
};

/**
 * What the wizard did, and where to go from here: the next obvious job on the
 * same gig, the full editor, or back to the list.
 */
export function DonePanel({
  title,
  description,
  next = [],
  links = [],
}: {
  title: string;
  description?: ReactNode;
  next?: NextWizard[];
  /** Extra places worth going, e.g. the public page. */
  links?: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <CircleCheck
            className="mt-0.5 size-5 shrink-0 text-emerald-400"
            aria-hidden
          />
          <div className="space-y-1.5">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {next.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Next up</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {next.map((suggestion) => {
                const wizard = WIZARDS[suggestion.key];
                const Icon = wizard.icon;
                return (
                  <Link
                    key={suggestion.key}
                    href={wizardHref(suggestion.key, suggestion)}
                    className="border-border hover:bg-secondary/60 flex items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <Icon
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {wizard.title}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {wizard.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Button key={link.href} variant="outline" asChild>
              {link.external ? (
                <a href={link.href} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  {link.label}
                </a>
              ) : (
                <Link href={link.href}>{link.label}</Link>
              )}
            </Button>
          ))}
          <Button variant="ghost" asChild>
            <Link href="/admin/do">Back to quick actions</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
