"use client";

import { useState } from "react";
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
import { gigPath } from "~/lib/gig-url";
import { getTbaText } from "~/lib/gig-flags";
import { GigGate } from "./gates";
import { gigEditorHref, gigLabel, type EditorGig } from "./gig-common";
import {
  changedRows,
  Choice,
  DiffList,
  Field,
  Loading,
  shown,
  shownWhen,
} from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "hide", label: "Hide the details" },
  { key: "when", label: "When it announces" },
  { key: "review", label: "Review" },
] as const;

type Draft = {
  isTba: boolean;
  tbaText: string;
  /** "at" announces by itself at `announceAt`; "hand" waits for someone. */
  mode: "at" | "hand";
  announceAt: Date | undefined;
};

const draftOf = (gig: EditorGig): Draft => ({
  isTba: gig.isTba,
  tbaText: gig.tbaText ?? "",
  mode: gig.announceAt ? "at" : "hand",
  announceAt: gig.announceAt ?? undefined,
});

/** When it announces, as a review line. */
const describeWhen = (draft: Draft) =>
  !draft.isTba
    ? "Announced"
    : draft.mode === "at"
      ? shownWhen(draft.announceAt)
      : "By hand";

/**
 * Announce later: list a gig as to be announced, with its title, line-up, date
 * and poster held back, and say when it goes public. Also the way to announce
 * a TBA gig straight away.
 */
export function AnnounceWizard() {
  return (
    <GigGate
      wizard="announce"
      hint={(gig) => (gig.isTba ? "To be announced" : null)}
    >
      {(gigId) => <Loaded gigId={gigId} />}
    </GigGate>
  );
}

function Loaded({ gigId }: { gigId: string }) {
  const gig = api.gigs.getForEditor.useQuery({ id: gigId });
  if (gig.isPending || !gig.data) {
    return (
      <WizardShell wizard="announce">
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
  const [isDone, setIsDone] = useState(false);
  // When the wizard opened, so an announce time already gone can be caught.
  const [openedAt] = useState(() => Date.now());
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const before = draftOf(gig);
  const rows = changedRows([
    {
      label: "Details",
      before: before.isTba ? "Held back" : "Public",
      after: draft.isTba ? "Held back" : "Public",
    },
    {
      label: "Teaser text",
      before: before.isTba ? shown(before.tbaText) : "Not shown",
      after: draft.isTba ? shown(draft.tbaText) : "Not shown",
    },
    {
      label: "Announces",
      before: describeWhen(before),
      after: describeWhen(draft),
    },
  ]);

  const whenError =
    draft.isTba && draft.mode === "at"
      ? !draft.announceAt
        ? "Pick a time, or choose to announce by hand"
        : draft.announceAt >= gig.gigStartTime
          ? "Announce the gig before it starts"
          : draft.announceAt.getTime() <= openedAt
            ? "That time has passed. Pick a later one, or announce now."
            : null
      : null;

  const save = api.gigs.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.gigs.getForEditor.invalidate({ id: gig.id }),
        utils.wizards.gigChoices.invalidate(),
      ]);
      toast.success(draft.isTba ? "Details held back" : "Gig announced");
      setIsDone(true);
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = () =>
    save.mutate({
      id: gig.id,
      isTba: draft.isTba,
      tbaText: draft.isTba ? draft.tbaText.trim() || null : undefined,
      announceAt:
        draft.isTba && draft.mode === "at" ? (draft.announceAt ?? null) : null,
    });

  return (
    <WizardShell
      wizard="announce"
      subtitle={gigLabel(gig)}
      editorHref={gigEditorHref(gig.id)}
      steps={steps}
      isDirty={rows.length > 0}
      done={
        isDone ? (
          <DonePanel
            title={draft.isTba ? "Details held back" : "Gig announced"}
            description={
              !draft.isTba
                ? "The title, line-up, date and poster are public now."
                : draft.mode === "at" && draft.announceAt
                  ? `It announces itself at ${shownWhen(draft.announceAt)}.`
                  : "It stays to be announced until someone announces it here or in the full editor."
            }
            next={[
              { key: "poster", gigId: gig.id },
              { key: "lineup", gigId: gig.id },
            ]}
            links={[
              {
                href: gigPath({
                  id: gig.id,
                  slug: gig.slug,
                  isTba: draft.isTba,
                }),
                label: "See the gig page",
                external: true,
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "hide" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Hide the details?</CardTitle>
              <CardDescription>
                A to be announced gig is listed with its title, line-up, date
                and poster withheld. Use it to tease a night before you can say
                what it is.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div
                role="radiogroup"
                aria-label="Hide the details"
                className="grid gap-3 sm:grid-cols-2"
              >
                <Choice
                  selected={draft.isTba}
                  onSelect={() => update("isTba", true)}
                  title="Hold the details back"
                  detail="Listed as to be announced"
                />
                <Choice
                  selected={!draft.isTba}
                  onSelect={() => update("isTba", false)}
                  title={gig.isTba ? "Announce it now" : "Show everything"}
                  detail={
                    gig.isTba
                      ? "Everything goes public on Save"
                      : "A normal gig, nothing withheld"
                  }
                />
              </div>
              {draft.isTba ? (
                <Field
                  id="tba-text"
                  label="Teaser text"
                  hint={`Shown under the poster while it is hidden. Empty shows "${getTbaText(null)}".`}
                >
                  <Input
                    id="tba-text"
                    value={draft.tbaText}
                    onChange={(event) => update("tbaText", event.target.value)}
                    placeholder="Something big. Saturday."
                    maxLength={120}
                  />
                </Field>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onNext={draft.isTba ? steps.next : () => steps.goTo("review")}
          />
        </>
      ) : null}

      {steps.step === "when" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>When does it announce?</CardTitle>
              <CardDescription>
                At a set time it goes public by itself, to the minute.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div
                role="radiogroup"
                aria-label="When it announces"
                className="grid gap-3 sm:grid-cols-2"
              >
                <Choice
                  selected={draft.mode === "at"}
                  onSelect={() => update("mode", "at")}
                  title="At a set time"
                  detail="Nobody has to be awake for it"
                />
                <Choice
                  selected={draft.mode === "hand"}
                  onSelect={() => update("mode", "hand")}
                  title="By hand, later"
                  detail="Come back here and announce it"
                />
              </div>
              {draft.mode === "at" ? (
                <Field
                  id="announce-at"
                  label="Announce on"
                  error={whenError ?? undefined}
                >
                  <DateTimePicker
                    date={draft.announceAt}
                    onDateChange={(value) => update("announceAt", value)}
                    placeholder="Pick a time"
                    showTime
                  />
                </Field>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={whenError !== null}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList rows={rows} />
          <WizardFooter
            onBack={() => steps.goTo(draft.isTba ? "when" : "hide")}
            label={!draft.isTba && gig.isTba ? "Announce now" : "Save"}
            onNext={submit}
            disabled={rows.length === 0 || whenError !== null}
            isPending={save.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
