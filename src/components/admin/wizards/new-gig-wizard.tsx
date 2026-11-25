"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { PosterField } from "~/components/admin/gig-edit/poster-field";
import type { PosterDraft } from "~/components/admin/gig-edit/types";
import {
  VenuePicker,
  type PickedVenue,
} from "~/components/admin/venues/venue-picker";
import { gigPath } from "~/lib/gig-url";
import { defaultLeadMinutes } from "~/lib/run-sheet/schedule";
import { usePosterCommit } from "./gig-common";
import { WhoIsPlaying, type SetDraft } from "./lineup-wizard";
import { Caution, Choice, Field, shownWhen, SummaryRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "start", label: "Start" },
  { key: "details", label: "Name and date" },
  { key: "poster", label: "Poster" },
  { key: "lineup", label: "Line-up" },
  { key: "review", label: "Review" },
] as const;

type Errors = Partial<Record<"title" | "subtitle" | "start" | "end", string>>;

/**
 * A new gig, a question at a time: name and date, where, the poster, who is
 * playing, then draft or live. A post on Instagram is quicker through the
 * import wizard, so the first step offers that instead.
 *
 * Nothing is created until the last step, so leaving part way loses nothing
 * but the typing, and the full editor never sees a half-made gig.
 */
export function NewGigWizard() {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState<PickedVenue | null>(null);
  const [subtitle, setSubtitle] = useState("");
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [poster, setPoster] = useState<PosterDraft>({ kind: "keep" });
  const [sets, setSets] = useState<SetDraft[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    slug: string | null;
    published: boolean;
  } | null>(null);

  const create = api.gigs.create.useMutation();
  const { commit, progressOf } = usePosterCommit();

  const isDirty =
    title.trim() !== "" ||
    venue !== null ||
    start !== undefined ||
    sets.length > 0 ||
    poster.kind !== "keep";

  const checkDetails = () => {
    const found: Errors = {};
    if (!title.trim()) found.title = "Give it a name";
    if (!subtitle.trim()) found.subtitle = "Say where it is on";
    if (!start) found.start = "When does it start?";
    if (start && end && end < start) {
      found.end = "The end time cannot be before the start time";
    }
    setErrors(found);
    if (Object.keys(found).length === 0) steps.next();
  };

  const save = async (publish: boolean) => {
    if (!start) return;
    setIsSaving(true);
    try {
      const gig = await create.mutateAsync({
        title: title.trim(),
        subtitle: subtitle.trim(),
        venueId: venue?.id ?? null,
        gigStartTime: start,
        gigEndTime: end,
        status: publish ? "PUBLISHED" : "DRAFT",
        scheduleItems: sets.map((set) => ({
          kind: "SET" as const,
          artistProfileIds: set.artists.map((artist) => artist.artistProfileId),
          leadMinutes: defaultLeadMinutes("SET"),
        })),
      });
      // The poster's bytes are keyed under the gig, so it goes up second. If
      // it fails the gig is still made, and the poster wizard can finish it.
      try {
        await commit(gig.id, "poster", poster);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `The gig was made, but ${error.message.toLowerCase()}`
            : "The gig was made, but the poster did not upload.",
        );
      }
      await Promise.all([
        utils.gigs.getAll.invalidate(),
        utils.wizards.gigChoices.invalidate(),
      ]);
      toast.success(publish ? "The gig is live" : "Draft saved");
      setCreated({ id: gig.id, slug: gig.slug, published: publish });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WizardShell
      wizard="new-gig"
      steps={steps}
      isDirty={isDirty}
      done={
        created ? (
          <DonePanel
            title={created.published ? "The gig is live" : "Draft saved"}
            description={
              created.published
                ? "It is on the gigs page and in the app now."
                : "Only admins can see it. Publish it from the full editor when it is ready."
            }
            next={[
              { key: "lineup", gigId: created.id },
              { key: "sell-tickets", gigId: created.id },
              ...(poster.kind === "keep"
                ? [{ key: "poster" as const, gigId: created.id }]
                : []),
            ]}
            links={[
              {
                href: `/admin/gigs/${created.id}`,
                label: "Open in the full editor",
              },
              ...(created.published
                ? [
                    {
                      href: gigPath({
                        id: created.id,
                        slug: created.slug,
                        isTba: false,
                      }),
                      label: "See the gig page",
                      external: true,
                    },
                  ]
                : []),
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "start" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>How do you want to start?</CardTitle>
              <CardDescription>
                If it is already announced on Instagram, the import reads the
                post for you: title, date, venue, line-up and poster.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/admin/gigs/import"
                  className="border-border hover:bg-secondary/60 flex items-start gap-3 rounded-lg border p-4 transition-colors"
                >
                  <Download
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      From an Instagram post
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      Paste the link and check what it read
                    </span>
                  </span>
                </Link>
                <Choice
                  selected={false}
                  onSelect={steps.next}
                  title="From scratch"
                  detail="A few questions, about a minute"
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {steps.step === "details" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Name, place and date</CardTitle>
              <CardDescription>
                Everything else can wait. You can change these later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field id="title" label="Name" error={errors.title} required>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What the poster calls it"
                  aria-invalid={Boolean(errors.title)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div role="group" aria-label="Venue" className="space-y-2">
                  <div className="text-sm font-medium">Venue</div>
                  <VenuePicker
                    value={venue}
                    onChange={(picked) => {
                      setVenue(picked);
                      if (picked) setSubtitle(picked.name);
                    }}
                    createLabel="Create & use for this gig"
                  />
                </div>
                <Field
                  id="subtitle"
                  label="Venue line"
                  hint="The line under the name. Picking a venue fills it in."
                  error={errors.subtitle}
                  required
                >
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(event) => setSubtitle(event.target.value)}
                    aria-invalid={Boolean(errors.subtitle)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field id="start" label="Starts" error={errors.start} required>
                  <DateTimePicker
                    date={start}
                    onDateChange={setStart}
                    placeholder="Select start time"
                    showTime
                  />
                </Field>
                <Field id="end" label="Ends" error={errors.end}>
                  <DateTimePicker
                    date={end}
                    onDateChange={setEnd}
                    placeholder="Select end time"
                    showTime
                    clearable
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
          <WizardFooter onBack={steps.back} onNext={checkDetails} />
        </>
      ) : null}

      {steps.step === "poster" ? (
        <>
          <PosterField
            gigTitle={title}
            current={null}
            draft={poster}
            onChange={setPoster}
            uploadProgress={progressOf("poster")}
            disabled={isSaving}
          />
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            hint={
              poster.kind === "keep"
                ? "Optional. Add it later if it is not ready."
                : undefined
            }
          />
        </>
      ) : null}

      {steps.step === "lineup" ? (
        <>
          <WhoIsPlaying sets={sets} onChange={setSets} />
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            hint={
              sets.length === 0
                ? "Optional. Roles and set times come after, in the line-up wizard."
                : undefined
            }
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                A draft is only visible to admins. Publishing puts it on the
                gigs page and in the app straight away.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="divide-border divide-y text-sm">
                <SummaryRow label="Name" value={title.trim()} />
                <SummaryRow label="Where" value={subtitle.trim()} />
                <SummaryRow label="Starts" value={shownWhen(start)} />
                <SummaryRow label="Ends" value={shownWhen(end)} />
                <SummaryRow
                  label="Poster"
                  value={
                    poster.kind === "replace" ? poster.file.name : "None yet"
                  }
                />
                <SummaryRow
                  label="Line-up"
                  value={
                    sets.length === 0
                      ? "Nobody yet"
                      : sets
                          .map((set) =>
                            set.artists
                              .map((artist) => artist.displayName)
                              .join(" b2b "),
                          )
                          .join(", ")
                  }
                />
              </dl>
              {poster.kind !== "replace" ? (
                <Caution>No poster. The gig page is bare without one.</Caution>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            label="Save as draft"
            onNext={() => void save(false)}
            isPending={isSaving}
            secondary={{
              label: "Save and publish",
              onClick: () => void save(true),
            }}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
