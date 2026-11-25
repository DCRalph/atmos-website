"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Loader2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { AccessLevelSelect } from "~/components/admin/ticketing/access-level-select";
import { useAccessLevels } from "~/hooks/use-access-levels";
import { DEFAULT_ACCESS_LEVEL } from "~/lib/ticketing/access-levels";
import { eventEditorHref, eventLabel, type AdminEvent } from "./event-common";
import { EventGate } from "./gates";
import { Caution, Field, Loading, SummaryRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "who", label: "Who" },
  { key: "tickets", label: "What they get" },
  { key: "send", label: "Send" },
  { key: "review", label: "Review" },
] as const;

/** A loose check, so a typo is caught before anything is issued. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Person = { key: string; name: string; email: string };

/** What happened to one person when the comps went out. */
type Outcome =
  | { state: "waiting" }
  | { state: "done"; ticketNumber: string }
  | { state: "over"; message: string }
  | { state: "failed"; message: string };

const blankPerson = (): Person => ({
  key: crypto.randomUUID(),
  name: "",
  email: "",
});

/**
 * People from a pasted list, one a line: "Name, email", "Name <email>",
 * "Name email" or just "Name". Blank lines are skipped.
 */
function parseList(text: string): Person[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const email = /[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/.exec(line)?.[0] ?? "";
      const name = line
        .replace(email, "")
        .replace(/[<>(),;\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return { key: crypto.randomUUID(), name, email };
    });
}

/** Comp several people at once: the guest list wizard, for a list. */
export function CompGroupWizard() {
  return (
    <EventGate wizard="comp-group">
      {(eventId) => <Loaded eventId={eventId} />}
    </EventGate>
  );
}

function Loaded({ eventId }: { eventId: string }) {
  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  if (event.isPending || !event.data) {
    return (
      <WizardShell wizard="comp-group">
        {event.isPending ? (
          <Loading />
        ) : (
          <p className="text-sm">That event is gone.</p>
        )}
      </WizardShell>
    );
  }
  return <Steps event={event.data} />;
}

function Steps({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const { level: levelMeta } = useAccessLevels();
  const [people, setPeople] = useState<Person[]>(() => [blankPerson()]);
  const [pasted, setPasted] = useState("");
  const [level, setLevel] = useState("GUEST");
  const [handoutCount, setHandoutCount] = useState(0);
  const [handoutLevel, setHandoutLevel] =
    useState<string>(DEFAULT_ACCESS_LEVEL);
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const issue = api.ticketAdmin.issueComp.useMutation();

  const named = people.filter((person) => person.name.trim());
  const patch = (key: string, fields: Partial<Person>) =>
    setPeople((all) =>
      all.map((person) =>
        person.key === key ? { ...person, ...fields } : person,
      ),
    );

  const addPasted = () => {
    const parsed = parseList(pasted);
    if (parsed.length === 0) return;
    // Replace the empty starter row rather than leave it dangling.
    setPeople((all) => [
      ...all.filter((person) => person.name.trim() || person.email.trim()),
      ...parsed,
    ]);
    setPasted("");
    toast.success(
      `Added ${parsed.length} ${parsed.length === 1 ? "person" : "people"}`,
    );
  };

  const badEmail = named.find(
    (person) => person.email.trim() && !EMAIL.test(person.email.trim()),
  );
  const emailedCount = named.filter((person) => person.email.trim()).length;
  const whoProblem =
    named.length === 0
      ? "Add at least one name."
      : people.some((person) => person.email.trim() && !person.name.trim())
        ? "Everyone needs a name for the door."
        : badEmail
          ? `${badEmail.name.trim()}'s email doesn't look right.`
          : null;

  /**
   * Issues each comp in turn. Somebody already done is skipped, so after an
   * over-allowance stop the rest can be sent again with `acknowledge`.
   */
  const run = async (acknowledge: boolean) => {
    setIsRunning(true);
    const results: Record<string, Outcome> = { ...outcomes };
    for (const person of named) {
      if (results[person.key]?.state === "done") continue;
      results[person.key] = { state: "waiting" };
      setOutcomes({ ...results });
      try {
        const comp = await issue.mutateAsync({
          eventId: event.id,
          recipientName: person.name.trim(),
          recipientEmail: person.email.trim() || undefined,
          accessLevel: level,
          handouts:
            handoutCount > 0
              ? [{ accessLevel: handoutLevel, quantity: handoutCount }]
              : [],
          notes: notes.trim() || undefined,
          sendEmail,
          acknowledge,
        });
        results[person.key] = {
          state: "done",
          ticketNumber: comp.hostTicketNumber,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong.";
        const isOver =
          typeof error === "object" &&
          error !== null &&
          "data" in error &&
          typeof error.data === "object" &&
          error.data !== null &&
          "code" in error.data &&
          error.data.code === "PRECONDITION_FAILED";
        results[person.key] = isOver
          ? { state: "over", message }
          : { state: "failed", message };
      }
      setOutcomes({ ...results });
    }
    setIsRunning(false);

    const all = named.map((person) => results[person.key]);
    if (all.every((outcome) => outcome?.state === "done")) setIsDone(true);
    else if (all.some((outcome) => outcome?.state === "failed")) {
      toast.error("Some comps didn't go out. See the list.");
    }
    await Promise.all([
      utils.ticketAdmin.comps.invalidate(),
      utils.ticketAdmin.compAccounting.invalidate(),
      utils.ticketEvents.byId.invalidate({ id: event.id }),
    ]);
  };

  const outcomeList = named.map((person) => ({
    person,
    outcome: outcomes[person.key],
  }));
  const doneCount = outcomeList.filter(
    ({ outcome }) => outcome?.state === "done",
  ).length;
  const overMessage =
    outcomeList.find(({ outcome }) => outcome?.state === "over")?.outcome ??
    null;
  const hasStarted = Object.keys(outcomes).length > 0;
  const left = named.length - doneCount;

  const isDirty =
    !hasStarted && Boolean(named.length > 0 || pasted.trim() || notes.trim());

  return (
    <WizardShell
      wizard="comp-group"
      subtitle={eventLabel(event)}
      editorHref={`${eventEditorHref(event.id)}?section=comps`}
      steps={steps}
      isDirty={isDirty}
      done={
        isDone ? (
          <DonePanel
            title={`Comped ${doneCount} ${doneCount === 1 ? "person" : "people"}`}
            description={
              <ul className="mt-2 space-y-1">
                {outcomeList.map(({ person, outcome }) => (
                  <li key={person.key} className="text-foreground text-sm">
                    {person.name.trim()}
                    {outcome?.state === "done" ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {outcome.ticketNumber}
                        {sendEmail && person.email.trim()
                          ? ` · emailed to ${person.email.trim()}`
                          : ""}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            }
            next={[
              { key: "guest-list", eventId: event.id },
              { key: "door-staff", eventId: event.id },
            ]}
            links={[
              {
                href: `${eventEditorHref(event.id)}?section=comps`,
                label: "See everyone comped",
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "who" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Who is on the list?</CardTitle>
              <CardDescription>
                Each name goes on its own ticket and they can&apos;t change it.
                The door checks it against ID. Email is optional.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-2">
                {people.map((person, index) => (
                  <li key={person.key} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5 font-mono text-xs">
                      {index + 1}
                    </span>
                    <Input
                      aria-label={`Name ${index + 1}`}
                      placeholder="Name on the door"
                      value={person.name}
                      onChange={(e) =>
                        patch(person.key, { name: e.target.value })
                      }
                      className="h-8"
                    />
                    <Input
                      aria-label={`Email ${index + 1}`}
                      type="email"
                      placeholder="them@example.com"
                      value={person.email}
                      onChange={(e) =>
                        patch(person.key, { email: e.target.value })
                      }
                      className="h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`Remove ${person.name.trim() || `row ${index + 1}`}`}
                      disabled={people.length === 1}
                      onClick={() =>
                        setPeople((all) =>
                          all.filter((other) => other.key !== person.key),
                        )
                      }
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPeople((all) => [...all, blankPerson()])}
              >
                <Plus className="size-4" aria-hidden />
                Add someone
              </Button>
              <Field
                id="comp-paste"
                label="Or paste a list"
                hint='One person a line, like "Sam Lee, sam@example.com" or "Sam Lee <sam@example.com>".'
              >
                <Textarea
                  id="comp-paste"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={4}
                />
              </Field>
              {pasted.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPasted}
                >
                  Add {parseList(pasted).length} from the list
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onNext={steps.next}
            disabled={whoProblem !== null}
            hint={whoProblem ?? `${named.length} on the list.`}
          />
        </>
      ) : null}

      {steps.step === "tickets" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What do they get?</CardTitle>
              <CardDescription>
                Everyone gets the same: their own ticket, and optionally some
                extra ones they send on to friends themselves.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="comp-level">Their ticket</Label>
                  <AccessLevelSelect
                    id="comp-level"
                    value={level}
                    onValueChange={setLevel}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra tickets each, to hand out</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="One fewer"
                      disabled={handoutCount === 0}
                      onClick={() => setHandoutCount((n) => Math.max(0, n - 1))}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center tabular-nums">
                      {handoutCount}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="One more"
                      disabled={handoutCount >= 20}
                      onClick={() => setHandoutCount((n) => n + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                    {handoutCount > 0 ? (
                      <div className="flex-1">
                        <AccessLevelSelect
                          value={handoutLevel}
                          onValueChange={setHandoutLevel}
                        />
                      </div>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Fixed at this level. They can&apos;t upgrade one.
                  </p>
                </div>
              </div>
              <Field
                id="comp-notes"
                label="Note (optional)"
                hint="Kept on each order, never shown to them."
              >
                <Input
                  id="comp-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why they're on the list"
                />
              </Field>
            </CardContent>
          </Card>
          <WizardFooter onBack={steps.back} onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "send" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Send them out?</CardTitle>
              <CardDescription>
                Off by default. Their tickets are on the comps list either way,
                and you can send each one from there later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
                Email each person their ticket
              </label>
              {sendEmail ? (
                <p className="text-muted-foreground text-xs">
                  Only people with an email get one: {emailedCount} of{" "}
                  {named.length}. Hand-outs are never emailed; they send those
                  on themselves.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter onBack={steps.back} onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Nothing is issued until you press the button. Each person is
                issued in turn; one failing doesn&apos;t stop the rest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="divide-border divide-y text-sm">
                <SummaryRow
                  label="Their ticket"
                  value={levelMeta(level).label}
                />
                <SummaryRow
                  label="To hand out"
                  value={
                    handoutCount > 0
                      ? `${handoutCount} × ${levelMeta(handoutLevel).label} each`
                      : "None"
                  }
                />
                <SummaryRow
                  label="Emailed"
                  value={
                    sendEmail ? `${emailedCount} of ${named.length}` : "Nobody"
                  }
                />
                {notes.trim() ? (
                  <SummaryRow label="Note" value={notes.trim()} />
                ) : null}
              </dl>
              <ul className="divide-border divide-y rounded-lg border">
                {outcomeList.map(({ person, outcome }) => (
                  <li
                    key={person.key}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                  >
                    <OutcomeIcon outcome={outcome} />
                    <span className="min-w-0 flex-1 truncate">
                      {person.name.trim()}
                      {person.email.trim() ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {person.email.trim()}
                        </span>
                      ) : null}
                    </span>
                    {outcome?.state === "done" ? (
                      <span className="text-muted-foreground text-xs">
                        {outcome.ticketNumber}
                      </span>
                    ) : outcome?.state === "failed" ? (
                      <span className="text-destructive basis-full text-xs">
                        {outcome.message}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {overMessage?.state === "over" ? (
                <Caution>{overMessage.message}</Caution>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={hasStarted ? undefined : steps.back}
            label={
              overMessage
                ? `Issue anyway (${left})`
                : hasStarted
                  ? `Try the other ${left} again`
                  : `Comp ${named.length} ${named.length === 1 ? "person" : "people"}`
            }
            onNext={() => void run(overMessage !== null)}
            disabled={whoProblem !== null || left === 0}
            isPending={isRunning}
          />
        </>
      ) : null}
    </WizardShell>
  );
}

function OutcomeIcon({ outcome }: { outcome: Outcome | undefined }) {
  if (!outcome) {
    return (
      <span className="border-input size-4 shrink-0 rounded-full border" />
    );
  }
  if (outcome.state === "waiting") {
    return (
      <Loader2
        className="text-muted-foreground size-4 shrink-0 animate-spin"
        aria-label="Issuing"
      />
    );
  }
  if (outcome.state === "done") {
    return (
      <CircleCheck
        className="size-4 shrink-0 text-emerald-400"
        aria-label="Issued"
      />
    );
  }
  return (
    <CircleX
      className={
        outcome.state === "over"
          ? "size-4 shrink-0 text-amber-400"
          : "text-destructive size-4 shrink-0"
      }
      aria-label={outcome.state === "over" ? "Over the allowance" : "Failed"}
    />
  );
}
