"use client";

import { useState } from "react";
import { Minus, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
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
import { Caution, Field, Loading } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "who", label: "Who" },
  { key: "tickets", label: "Tickets" },
  { key: "review", label: "Review" },
] as const;

/** A loose check, so Next stays off until it looks like an address. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comp someone: who they are, what they get, then send it. */
export function GuestListWizard() {
  return (
    <EventGate wizard="guest-list">
      {(eventId) => <Loaded eventId={eventId} />}
    </EventGate>
  );
}

function Loaded({ eventId }: { eventId: string }) {
  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  // Bumped by "Add someone else" so the steps start over, blank.
  const [round, setRound] = useState(0);
  if (event.isPending) {
    return (
      <WizardShell wizard="guest-list">
        <Loading />
      </WizardShell>
    );
  }
  if (!event.data) {
    return (
      <WizardShell wizard="guest-list">
        <p className="text-sm">That event is gone.</p>
      </WizardShell>
    );
  }
  return (
    <Steps
      key={round}
      event={event.data}
      onAnother={() => setRound((n) => n + 1)}
    />
  );
}

function Steps({
  event,
  onAnother,
}: {
  event: AdminEvent;
  onAnother: () => void;
}) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const { level: levelMeta } = useAccessLevels();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [level, setLevel] = useState("GUEST");
  const [handoutCount, setHandoutCount] = useState(0);
  const [handoutLevel, setHandoutLevel] =
    useState<string>(DEFAULT_ACCESS_LEVEL);
  const [notes, setNotes] = useState("");
  const [overage, setOverage] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ ticketNumber: string } | null>(null);

  const issue = api.ticketAdmin.issueComp.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.ticketAdmin.comps.invalidate(),
        utils.ticketAdmin.compAccounting.invalidate(),
        utils.ticketEvents.byId.invalidate({ id: event.id }),
      ]);
      toast.success(sendEmail && email ? `Sent to ${email.trim()}` : "Issued");
      setOverage(null);
      setIssued({ ticketNumber: result.hostTicketNumber });
    },
    onError: (error) => {
      // The cap is a warning, not a wall: show what it would mean and let
      // them send it again having read it.
      if (error.data?.code === "PRECONDITION_FAILED") {
        setOverage(error.message);
        return;
      }
      toast.error(error.message);
    },
  });

  const submit = (acknowledge: boolean) =>
    issue.mutate({
      eventId: event.id,
      recipientName: name.trim(),
      recipientEmail: email.trim() || undefined,
      accessLevel: level,
      handouts:
        handoutCount > 0
          ? [{ accessLevel: handoutLevel, quantity: handoutCount }]
          : [],
      notes: notes.trim() || undefined,
      sendEmail,
      acknowledge,
    });

  const whoProblem = !name.trim()
    ? "They need a name for the door."
    : email.trim() && !EMAIL.test(email.trim())
      ? "That email doesn't look right."
      : sendEmail && !email.trim()
        ? "Add their email, or turn off emailing."
        : null;

  const isDirty = Boolean(name.trim() || email.trim() || notes.trim());

  const summary: { label: string; value: string }[] = [
    { label: "Name on the door", value: name.trim() },
    {
      label: "Email",
      value: email.trim()
        ? `${email.trim()}${sendEmail ? ", ticket emailed" : ", not emailed"}`
        : "None, not emailed",
    },
    { label: "Their ticket", value: levelMeta(level).label },
    {
      label: "To hand out",
      value:
        handoutCount > 0
          ? `${handoutCount} × ${levelMeta(handoutLevel).label}`
          : "None",
    },
    ...(notes.trim() ? [{ label: "Note", value: notes.trim() }] : []),
  ];

  return (
    <WizardShell
      wizard="guest-list"
      subtitle={eventLabel(event)}
      editorHref={eventEditorHref(event.id)}
      steps={steps}
      isDirty={isDirty}
      done={
        issued ? (
          <DonePanel
            title={
              sendEmail && email.trim() ? `Sent to ${email.trim()}` : "Issued"
            }
            description={
              <>
                Ticket {issued.ticketNumber} for {name.trim()}.{" "}
                <button
                  type="button"
                  onClick={onAnother}
                  className="text-foreground inline-flex items-center gap-1 underline underline-offset-2"
                >
                  <UserPlus className="size-3.5" aria-hidden />
                  Add someone else
                </button>
              </>
            }
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
              <CardTitle>Who is it for?</CardTitle>
              <CardDescription>
                The name goes on the ticket and they can&apos;t change it. The
                door checks it against ID.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="guest-name" label="Name on the door" required>
                  <Input
                    id="guest-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field
                  id="guest-email"
                  label={sendEmail ? "Email" : "Email (optional)"}
                  required={sendEmail}
                >
                  <Input
                    id="guest-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="them@example.com"
                  />
                </Field>
              </div>
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
                Email them their ticket
              </label>
            </CardContent>
          </Card>
          <WizardFooter
            onNext={steps.next}
            disabled={whoProblem !== null}
            hint={whoProblem ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "tickets" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What do they get?</CardTitle>
              <CardDescription>
                Their own ticket, and optionally some extra ones they send on to
                friends themselves.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="guest-level">Their ticket</Label>
                  <AccessLevelSelect
                    id="guest-level"
                    value={level}
                    onValueChange={setLevel}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra tickets to hand out</Label>
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
                id="guest-notes"
                label="Note (optional)"
                hint="Kept on the order, never shown to them."
              >
                <Input
                  id="guest-notes"
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

      {steps.step === "review" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Nothing is issued until you press the button.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="divide-border divide-y text-sm">
                {summary.map((row) => (
                  <div
                    key={row.label}
                    className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3"
                  >
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {overage ? <Caution>{overage}</Caution> : null}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            label={
              overage
                ? "Issue anyway"
                : sendEmail && email.trim()
                  ? "Send ticket"
                  : "Issue ticket"
            }
            onNext={() => submit(overage !== null)}
            disabled={whoProblem !== null}
            isPending={issue.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
