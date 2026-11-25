"use client";

import type { ReactNode } from "react";

import type { WizardKey } from "./catalog";
import {
  EventChoiceList,
  GigChoiceList,
  useWizardTarget,
  type EventChoice,
  type GigChoice,
} from "./parts";
import { WizardShell } from "./shell";

/**
 * A gig wizard's first question. With `?gig=` in the URL it is already
 * answered and the wizard itself renders; without, the gig list does, and
 * picking one puts it in the URL so a reload keeps the place.
 */
export function GigGate({
  wizard,
  hint,
  children,
}: {
  wizard: WizardKey;
  /** Why a gig might want this wizard, shown on its row. */
  hint?: (gig: GigChoice) => string | null;
  children: (gigId: string) => ReactNode;
}) {
  const [gigId, choose] = useWizardTarget("gig");
  if (gigId) return children(gigId);
  return (
    <WizardShell wizard={wizard}>
      <GigChoiceList hint={hint} onPick={(gig) => choose(gig.id)} />
    </WizardShell>
  );
}

/** The same for wizards that work on a ticketed event, with `?event=`. */
export function EventGate({
  wizard,
  hint,
  children,
}: {
  wizard: WizardKey;
  hint?: (event: EventChoice) => string | null;
  children: (eventId: string) => ReactNode;
}) {
  const [eventId, choose] = useWizardTarget("event");
  if (eventId) return children(eventId);
  return (
    <WizardShell wizard={wizard}>
      <EventChoiceList hint={hint} onPick={choose} />
    </WizardShell>
  );
}
