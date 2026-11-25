"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  VenuePicker,
  type PickedVenue,
} from "~/components/admin/venues/venue-picker";
import { wizardHref } from "./catalog";
import { EventGate } from "./gates";
import { eventEditorHref, eventLabel, type AdminEvent } from "./event-common";
import {
  Caution,
  changedRows,
  DiffList,
  Field,
  Loading,
  shown,
  shownWhen,
} from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
] as const;

/** Change an event's name, times, venue or short description, then Save. */
export function EventBasicsWizard() {
  return (
    <EventGate wizard="event-basics">
      {(eventId) => <Loaded eventId={eventId} />}
    </EventGate>
  );
}

function Loaded({ eventId }: { eventId: string }) {
  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  if (event.isPending) {
    return (
      <WizardShell wizard="event-basics">
        <Loading />
      </WizardShell>
    );
  }
  if (!event.data) {
    return (
      <WizardShell wizard="event-basics">
        <p className="text-sm">That event is gone.</p>
      </WizardShell>
    );
  }
  return <Steps event={event.data} />;
}

type Draft = {
  name: string;
  doorsAt: Date | undefined;
  startsAt: Date | undefined;
  endsAt: Date | undefined;
  venue: PickedVenue | null;
  venueName: string;
  venueAddress: string;
  shortDescription: string;
};

const draftFrom = (event: AdminEvent): Draft => ({
  name: event.name,
  doorsAt: event.doorsAt ?? undefined,
  startsAt: event.startsAt,
  endsAt: event.endsAt ?? undefined,
  venue: event.venue,
  venueName: event.venueName ?? "",
  venueAddress: event.venueAddress ?? "",
  shortDescription: event.shortDescription ?? "",
});

const time = (date: Date | undefined | null) => date?.getTime() ?? null;

/** What is wrong with the draft, if anything, for the Next button. */
function problem(draft: Draft): string | null {
  if (!draft.name.trim()) return "Give the event a name.";
  if (!draft.startsAt) return "It needs a start time.";
  if (draft.endsAt && draft.endsAt < draft.startsAt) {
    return "It can't end before it starts.";
  }
  if (draft.doorsAt && draft.doorsAt > draft.startsAt) {
    return "Doors can't open after it starts.";
  }
  return null;
}

function Steps({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [baseline] = useState(() => draftFrom(event));
  const [draft, setDraft] = useState(baseline);
  const [isDone, setIsDone] = useState(false);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = api.ticketEvents.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ticketEvents.byId.invalidate({ id: event.id }),
        utils.wizards.eventChoices.invalidate(),
      ]);
      toast.success("Event updated");
      setIsDone(true);
    },
    onError: (error) => toast.error(error.message),
  });

  const venueText = (d: Draft) =>
    [d.venue?.name ?? d.venueName, d.venue ? d.venue.address : d.venueAddress]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ");

  const rows = changedRows([
    { label: "Name", before: shown(baseline.name), after: shown(draft.name) },
    {
      label: "Doors",
      before: shownWhen(baseline.doorsAt),
      after: shownWhen(draft.doorsAt),
    },
    {
      label: "Starts",
      before: shownWhen(baseline.startsAt),
      after: shownWhen(draft.startsAt),
    },
    {
      label: "Ends",
      before: shownWhen(baseline.endsAt),
      after: shownWhen(draft.endsAt),
    },
    {
      label: "Venue",
      before: shown(venueText(baseline)),
      after: shown(venueText(draft)),
    },
    {
      label: "Short description",
      before: shown(baseline.shortDescription),
      after: shown(draft.shortDescription),
    },
  ]);

  const timesChanged =
    time(draft.doorsAt) !== time(baseline.doorsAt) ||
    time(draft.startsAt) !== time(baseline.startsAt) ||
    time(draft.endsAt) !== time(baseline.endsAt);
  const venueChanged = venueText(draft) !== venueText(baseline);
  const hasTickets = event.totals.orders > 0 || event.counts.tickets > 0;
  const startMoved = time(draft.startsAt) !== time(baseline.startsAt);

  const submit = () => {
    if (!draft.startsAt) return;
    const venueIdBefore = baseline.venue?.id ?? null;
    const venueIdAfter = draft.venue?.id ?? null;
    save.mutate({
      id: event.id,
      ...(draft.name.trim() !== baseline.name
        ? { name: draft.name.trim() }
        : {}),
      ...(time(draft.doorsAt) !== time(baseline.doorsAt)
        ? { doorsAt: draft.doorsAt ?? null }
        : {}),
      ...(startMoved ? { startsAt: draft.startsAt } : {}),
      ...(time(draft.endsAt) !== time(baseline.endsAt)
        ? { endsAt: draft.endsAt ?? null }
        : {}),
      ...(venueChanged
        ? {
            venueId: venueIdAfter,
            ...(venueIdAfter === null || venueIdAfter !== venueIdBefore
              ? {
                  venueName: draft.venue
                    ? draft.venue.name
                    : draft.venueName.trim() || null,
                  venueAddress: draft.venue
                    ? draft.venue.address
                    : draft.venueAddress.trim() || null,
                }
              : {}),
          }
        : {}),
      ...(draft.shortDescription.trim() !== baseline.shortDescription.trim()
        ? { shortDescription: draft.shortDescription.trim() || null }
        : {}),
    });
  };

  const issue = problem(draft);

  return (
    <WizardShell
      wizard="event-basics"
      subtitle={eventLabel(event)}
      editorHref={eventEditorHref(event.id)}
      steps={steps}
      isDirty={rows.length > 0}
      done={
        isDone ? (
          <DonePanel
            title="Event updated"
            description={`${rows.length} change${rows.length === 1 ? "" : "s"} saved.`}
            next={[
              { key: "door-staff", eventId: event.id },
              { key: "ticket-prices", eventId: event.id },
            ]}
            links={[
              { href: eventEditorHref(event.id), label: "Open the event" },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "details" ? (
        <>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>The event</CardTitle>
                <CardDescription>
                  What buyers see on the ticket page and their tickets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field id="event-name" label="Name" required>
                  <Input
                    id="event-name"
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <Field
                  id="event-short-description"
                  label="Short description"
                  hint={`${draft.shortDescription.length}/300`}
                >
                  <Textarea
                    id="event-short-description"
                    value={draft.shortDescription}
                    maxLength={300}
                    rows={3}
                    onChange={(e) => update("shortDescription", e.target.value)}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>When</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <Field id="event-doors" label="Doors open">
                  <DateTimePicker
                    date={draft.doorsAt}
                    onDateChange={(date) => update("doorsAt", date)}
                    clearable
                  />
                </Field>
                <Field id="event-start" label="Starts" required>
                  <DateTimePicker
                    date={draft.startsAt}
                    onDateChange={(date) => update("startsAt", date)}
                  />
                </Field>
                <Field id="event-end" label="Ends">
                  <DateTimePicker
                    date={draft.endsAt}
                    onDateChange={(date) => update("endsAt", date)}
                    clearable
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Venue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <VenuePicker
                  value={draft.venue}
                  onChange={(venue) =>
                    setDraft((current) => ({
                      ...current,
                      venue,
                      // Taking the venue off leaves its text to edit as a one-off.
                      ...(venue
                        ? {
                            venueName: venue.name,
                            venueAddress: venue.address ?? "",
                          }
                        : {}),
                    }))
                  }
                  createLabel="Create & use for this event"
                />
                {draft.venue ? null : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field id="event-venue" label="Name">
                      <Input
                        id="event-venue"
                        value={draft.venueName}
                        onChange={(e) => update("venueName", e.target.value)}
                      />
                    </Field>
                    <Field id="event-address" label="Address">
                      <Input
                        id="event-address"
                        value={draft.venueAddress}
                        onChange={(e) => update("venueAddress", e.target.value)}
                      />
                    </Field>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <WizardFooter
            onNext={steps.next}
            disabled={issue !== null}
            hint={issue ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList rows={rows}>
            {hasTickets && (timesChanged || venueChanged) ? (
              <Caution>
                Wallet passes already on people&apos;s phones update to the new
                details, and Wallet may show them a notification. Ticket holders
                are not emailed.
              </Caution>
            ) : null}
            {event.gig && startMoved ? (
              <Caution>
                The linked gig, {event.gig.title}, keeps its own date.{" "}
                <Link
                  href={wizardHref("gig-basics", { gigId: event.gig.id })}
                  className="underline underline-offset-2"
                >
                  Move the gig too
                </Link>
              </Caution>
            ) : null}
          </DiffList>
          <WizardFooter
            onBack={steps.back}
            label={`Save ${rows.length} change${rows.length === 1 ? "" : "s"}`}
            onNext={submit}
            disabled={rows.length === 0 || issue !== null}
            isPending={save.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
