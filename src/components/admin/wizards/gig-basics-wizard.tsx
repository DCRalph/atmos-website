"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import {
  VenuePicker,
  type PickedVenue,
} from "~/components/admin/venues/venue-picker";
import { gigPath } from "~/lib/gig-url";
import { rebaseSchedule } from "~/lib/run-sheet/night";
import { GigGate } from "./gates";
import { gigEditorHref, gigLabel, type EditorGig } from "./gig-common";
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

type Draft = {
  title: string;
  venue: PickedVenue | null;
  /** The venue line under the title. Picking a venue fills it in. */
  subtitle: string;
  startTime: Date | undefined;
  endTime: Date | undefined;
  shortDescription: string;
  ticketLink: string;
};

const draftOf = (gig: EditorGig): Draft => ({
  title: gig.title,
  venue: gig.venue,
  subtitle: gig.subtitle,
  startTime: gig.gigStartTime,
  endTime: gig.gigEndTime ?? undefined,
  shortDescription: gig.shortDescription ?? "",
  ticketLink: gig.ticketLink ?? "",
});

type Errors = Partial<Record<keyof Draft, string>>;

const validate = (draft: Draft): Errors => {
  const errors: Errors = {};
  if (!draft.title.trim()) errors.title = "A title is required";
  if (!draft.subtitle.trim()) errors.subtitle = "Say where it is on";
  if (!draft.startTime) errors.startTime = "A start time is required";
  if (draft.startTime && draft.endTime && draft.endTime < draft.startTime) {
    errors.endTime = "The end time cannot be before the start time";
  }
  const link = draft.ticketLink.trim();
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.ticketLink = "It must start with http:// or https://";
      }
    } catch {
      errors.ticketLink = "That does not look like a link";
    }
  }
  return errors;
};

/** Update the basics: title, when, where, the short description, the ticket link. */
export function GigBasicsWizard() {
  return (
    <GigGate
      wizard="gig-basics"
      hint={(gig) => (gig.hasVenue ? null : "No venue")}
    >
      {(gigId) => <Loaded gigId={gigId} />}
    </GigGate>
  );
}

function Loaded({ gigId }: { gigId: string }) {
  const gig = api.gigs.getForEditor.useQuery({ id: gigId });
  if (gig.isPending || !gig.data) {
    return (
      <WizardShell wizard="gig-basics">
        {gig.isPending ? (
          <Loading />
        ) : (
          <p className="text-sm">That gig is gone.</p>
        )}
      </WizardShell>
    );
  }
  return <Steps gig={gig.data} />;
}

function Steps({ gig }: { gig: EditorGig }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [draft, setDraft] = useState(() => draftOf(gig));
  const [errors, setErrors] = useState<Errors>({});
  /** How many changes the last save made, for the done screen. Null until then. */
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const before = draftOf(gig);
  const rows = changedRows([
    { label: "Title", before: before.title, after: draft.title.trim() },
    {
      label: "Venue",
      before: shown(before.venue?.name),
      after: shown(draft.venue?.name),
    },
    {
      label: "Venue line",
      before: before.subtitle,
      after: draft.subtitle.trim(),
    },
    {
      label: "Starts",
      before: shownWhen(before.startTime),
      after: shownWhen(draft.startTime),
    },
    {
      label: "Ends",
      before: shownWhen(before.endTime),
      after: shownWhen(draft.endTime),
    },
    {
      label: "Short description",
      before: shown(before.shortDescription),
      after: shown(draft.shortDescription),
    },
    {
      label: "Ticket link",
      before: shown(before.ticketLink),
      after: shown(draft.ticketLink),
    },
  ]);

  const startMoved =
    draft.startTime !== undefined &&
    draft.startTime.getTime() !== gig.gigStartTime.getTime();
  const linkedEvent = gig.ticketEvents[0];

  const save = api.gigs.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.gigs.getForEditor.invalidate({ id: gig.id }),
        utils.wizards.gigChoices.invalidate(),
      ]);
      toast.success("Changes saved");
      setSavedCount(rows.length);
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    const startTime = draft.startTime;
    if (!startTime) return;
    save.mutate({
      id: gig.id,
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      venueId: draft.venue?.id ?? null,
      gigStartTime: startTime,
      gigEndTime: draft.endTime ?? null,
      shortDescription: draft.shortDescription.trim() || null,
      ticketLink: draft.ticketLink.trim() || null,
      // The run sheet follows the gig to its new night, as it does in the
      // full editor. Every saved row is named, carrying only its new times.
      ...(startMoved && gig.scheduleItems.length > 0
        ? {
            scheduleItems: rebaseSchedule(
              gig.scheduleItems.map((row) => ({
                id: row.id,
                startsAt: row.startsAt,
                endsAt: row.endsAt,
              })),
              gig.gigStartTime,
              startTime,
            ),
          }
        : {}),
    });
  };

  const next = () => {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) steps.next();
  };

  return (
    <WizardShell
      wizard="gig-basics"
      subtitle={gigLabel(gig)}
      editorHref={gigEditorHref(gig.id)}
      steps={steps}
      isDirty={rows.length > 0}
      done={
        savedCount !== null ? (
          <DonePanel
            title="Changes saved"
            description={`${savedCount} change${savedCount === 1 ? "" : "s"} to ${draft.title.trim()}.`}
            next={[
              { key: "poster", gigId: gig.id },
              { key: "lineup", gigId: gig.id },
              ...(linkedEvent && startMoved
                ? [{ key: "event-basics" as const, eventId: linkedEvent.id }]
                : []),
            ]}
            links={[
              {
                href: gigPath({ id: gig.id, slug: gig.slug, isTba: gig.isTba }),
                label: "See the gig page",
                external: true,
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "details" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>The basics</CardTitle>
              <CardDescription>
                Change what you need. Everything else stays as it is.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field id="title" label="Title" error={errors.title} required>
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
                  aria-invalid={Boolean(errors.title)}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div role="group" aria-label="Venue" className="space-y-2">
                  <div className="text-sm font-medium">Venue</div>
                  <VenuePicker
                    value={draft.venue}
                    onChange={(venue) => {
                      update("venue", venue);
                      if (venue) update("subtitle", venue.name);
                    }}
                    createLabel="Create & use for this gig"
                  />
                </div>
                <Field
                  id="subtitle"
                  label="Venue line"
                  hint="The line under the title. Picking a venue fills it in."
                  error={errors.subtitle}
                  required
                >
                  <Input
                    id="subtitle"
                    value={draft.subtitle}
                    onChange={(event) => update("subtitle", event.target.value)}
                    aria-invalid={Boolean(errors.subtitle)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  id="start"
                  label="Starts"
                  error={errors.startTime}
                  hint={
                    gig.scheduleItems.length > 0
                      ? "Moving the date moves the run sheet with it."
                      : undefined
                  }
                  required
                >
                  <DateTimePicker
                    date={draft.startTime}
                    onDateChange={(value) => update("startTime", value)}
                    placeholder="Select start time"
                    showTime
                  />
                </Field>
                <Field id="end" label="Ends" error={errors.endTime}>
                  <DateTimePicker
                    date={draft.endTime}
                    onDateChange={(value) => update("endTime", value)}
                    placeholder="Select end time"
                    showTime
                    clearable
                  />
                </Field>
              </div>

              <Field
                id="short-description"
                label="Short description"
                hint="A line or two for the gig list and link previews. The long description is in the full editor."
              >
                <Textarea
                  id="short-description"
                  value={draft.shortDescription}
                  onChange={(event) =>
                    update("shortDescription", event.target.value)
                  }
                  rows={3}
                />
              </Field>

              <Field
                id="ticket-link"
                label="Ticket link"
                error={errors.ticketLink}
                hint={
                  linkedEvent
                    ? "This gig sells its own tickets, so the gig page shows those instead."
                    : "Where to buy tickets, if they are sold somewhere else."
                }
              >
                <Input
                  id="ticket-link"
                  type="url"
                  value={draft.ticketLink}
                  onChange={(event) => update("ticketLink", event.target.value)}
                  placeholder="https://"
                  aria-invalid={Boolean(errors.ticketLink)}
                />
              </Field>
            </CardContent>
          </Card>
          <WizardFooter onNext={next} />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList rows={rows}>
            {startMoved && linkedEvent ? (
              <Caution>
                This gig sells tickets, and its ticketed event keeps its own
                date. Once this is saved you can move the event too.
              </Caution>
            ) : null}
          </DiffList>
          <WizardFooter
            onBack={steps.back}
            label={`Save ${rows.length} change${rows.length === 1 ? "" : "s"}`}
            onNext={submit}
            disabled={rows.length === 0}
            isPending={save.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
