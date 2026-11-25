"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Shuffle } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Input } from "~/components/ui/input";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";
import { wizardHref } from "./catalog";
import { eventEditorHref, eventLabel, type AdminEvent } from "./event-common";
import { EventGate } from "./gates";
import {
  Caution,
  Choice,
  Field,
  Loading,
  shownWhen,
  SummaryRow,
} from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "kind", label: "What it does" },
  { key: "code", label: "The code" },
  { key: "limits", label: "Limits" },
  { key: "review", label: "Review" },
] as const;

type Kind = "PERCENT" | "FIXED" | "UNLOCK";

const KINDS: { value: Kind; title: string; detail: string }[] = [
  {
    value: "PERCENT",
    title: "Percent off",
    detail: "Like 20% off, for a promoter or a presale.",
  },
  {
    value: "FIXED",
    title: "Dollars off",
    detail: "A set amount off each order.",
  },
  {
    value: "UNLOCK",
    title: "Opens a hidden ticket type",
    detail: "Only people with the code can see and buy it.",
  },
];

const CODE = /^[A-Za-z0-9_-]{3,32}$/;

/** Eight letters and digits nobody mixes up: no 0/O or 1/I/L. */
function randomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/** A blank field, or a whole number of at least `min`. */
const countOf = (value: string): number | null | "bad" => {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : "bad";
};

/** Make an event code: money off, or the key to a hidden ticket type. */
export function MakeCodeWizard() {
  return (
    <EventGate wizard="make-code">
      {(eventId) => <Loaded eventId={eventId} />}
    </EventGate>
  );
}

function Loaded({ eventId }: { eventId: string }) {
  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  if (event.isPending || !event.data) {
    return (
      <WizardShell wizard="make-code">
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
  const [kind, setKind] = useState<Kind>("PERCENT");
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [tierIds, setTierIds] = useState<string[]>([]);
  const [maxUses, setMaxUses] = useState("");
  const [perPerson, setPerPerson] = useState("");
  const [minTickets, setMinTickets] = useState("");
  const [startsAt, setStartsAt] = useState<Date | undefined>();
  const [endsAt, setEndsAt] = useState<Date | undefined>();
  const [made, setMade] = useState<string | null>(null);

  const create = api.eventCodes.create.useMutation({
    onSuccess: async (created) => {
      setMade(created.code);
      toast.success(`${created.code} is ready`);
      await utils.eventCodes.list.invalidate({ eventId: event.id });
    },
    onError: (error) => toast.error(error.message),
  });

  const hidden = event.tiers.filter((tier) => tier.isHidden);
  const tiersOnOffer = kind === "UNLOCK" ? hidden : event.tiers;
  const picked = (id: string) => tierIds.includes(id);
  const toggleTier = (id: string, on: boolean) =>
    setTierIds((all) =>
      on ? [...all, id] : all.filter((other) => other !== id),
    );

  // What the amount is worth, in the units the server stores.
  const value = (() => {
    if (kind === "UNLOCK") return 0;
    if (kind === "PERCENT") {
      const percent = Number(amount);
      return amount.trim() && percent > 0 && percent <= 100
        ? Math.round(percent * 100)
        : null;
    }
    const cents = parsePriceToCents(amount);
    return cents !== null && cents > 0 ? cents : null;
  })();

  const codeProblem = !CODE.test(code.trim())
    ? "3 to 32 letters, numbers, dashes or underscores."
    : kind === "UNLOCK" && tierIds.length === 0
      ? hidden.length === 0
        ? "This event has no hidden ticket types yet."
        : "Pick the ticket type it opens."
      : value === null
        ? kind === "PERCENT"
          ? "Enter a percent between 1 and 100."
          : "Enter an amount, like 5.00."
        : null;

  const limits = {
    maxRedemptions: countOf(maxUses),
    maxPerEmail: countOf(perPerson),
    minTickets: countOf(minTickets),
  };
  const limitsProblem = Object.values(limits).includes("bad")
    ? "Limits are whole numbers, 1 or more, or blank."
    : startsAt && endsAt && endsAt < startsAt
      ? "It can't end before it starts."
      : null;
  const limit = (n: number | null | "bad") => (n === "bad" ? null : n);

  const worth =
    kind === "UNLOCK"
      ? "Opens hidden tickets, no money off"
      : kind === "PERCENT"
        ? `${amount.trim()}% off`
        : `${formatNZD(value ?? 0)} off`;
  const tierNames = (ids: string[]) =>
    event.tiers
      .filter((tier) => ids.includes(tier.id))
      .map((tier) => tier.name)
      .join(", ");

  const save = () =>
    create.mutate({
      eventId: event.id,
      code: code.trim().toUpperCase(),
      type: kind,
      value: value ?? 0,
      tierIds,
      maxRedemptions: limit(limits.maxRedemptions),
      maxPerEmail: limit(limits.maxPerEmail),
      minTickets: limit(limits.minTickets),
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      isActive: true,
    });

  return (
    <WizardShell
      wizard="make-code"
      subtitle={eventLabel(event)}
      editorHref={`${eventEditorHref(event.id)}?section=codes`}
      steps={steps}
      isDirty={Boolean(code.trim() || amount.trim())}
      done={
        made ? (
          <DonePanel
            title="Code made"
            description={
              <span className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-foreground font-mono text-2xl font-semibold tracking-wider">
                  {made}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(made)
                      .then(() => toast.success("Copied"));
                  }}
                >
                  <Copy className="size-4" aria-hidden />
                  Copy
                </Button>
              </span>
            }
            next={[
              { key: "short-link", eventId: event.id },
              { key: "ticket-types", eventId: event.id },
            ]}
            links={[
              {
                href: `${eventEditorHref(event.id)}?section=codes`,
                label: "See every code for this event",
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "kind" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What should the code do?</CardTitle>
              <CardDescription>Buyers type it in at checkout.</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
                {KINDS.map((option) => (
                  <Choice
                    key={option.value}
                    selected={kind === option.value}
                    onSelect={() => {
                      setKind(option.value);
                      setTierIds([]);
                    }}
                    title={option.title}
                    detail={option.detail}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <WizardFooter onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "code" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>The code</CardTitle>
              <CardDescription>
                Short and easy to say out loud works best.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="code-text" label="Code" required>
                  <div className="flex gap-2">
                    <Input
                      id="code-text"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                      }
                      placeholder="LATEBLOOM20"
                      maxLength={32}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCode(randomCode())}
                    >
                      <Shuffle className="size-4" aria-hidden />
                      Make one up
                    </Button>
                  </div>
                </Field>
                {kind !== "UNLOCK" ? (
                  <Field
                    id="code-amount"
                    label={kind === "PERCENT" ? "Percent off" : "Dollars off"}
                    required
                  >
                    <Input
                      id="code-amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={kind === "PERCENT" ? "20" : "5.00"}
                    />
                  </Field>
                ) : null}
              </div>

              {kind === "UNLOCK" && hidden.length === 0 ? (
                <Caution>
                  An unlock code opens a hidden ticket type, and this event has
                  none. Make one hidden first with{" "}
                  <Link
                    href={wizardHref("ticket-types", { eventId: event.id })}
                    className="underline underline-offset-2"
                  >
                    Set up ticket types
                  </Link>
                  , then come back.
                </Caution>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {kind === "UNLOCK"
                      ? "Which hidden ticket types does it open?"
                      : "Which ticket types does it work on?"}
                  </p>
                  {kind !== "UNLOCK" ? (
                    <p className="text-muted-foreground text-xs">
                      Leave them all unticked for every ticket type.
                    </p>
                  ) : null}
                  <ul className="divide-border divide-y rounded-lg border">
                    {tiersOnOffer.map((tier) => (
                      <li key={tier.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                          <Checkbox
                            checked={picked(tier.id)}
                            onCheckedChange={(on) =>
                              toggleTier(tier.id, on === true)
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {tier.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatNZD(tier.priceCents)}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={() => {
              setCode((c) => c.trim().toUpperCase());
              steps.next();
            }}
            disabled={codeProblem !== null}
            hint={codeProblem ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "limits" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Limits</CardTitle>
              <CardDescription>
                All optional. Leave a box blank for no limit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="code-max" label="Total uses">
                  <Input
                    id="code-max"
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="No limit"
                  />
                </Field>
                <Field id="code-per" label="Uses per person">
                  <Input
                    id="code-per"
                    type="number"
                    min={1}
                    value={perPerson}
                    onChange={(e) => setPerPerson(e.target.value)}
                    placeholder="No limit"
                  />
                </Field>
                <Field
                  id="code-min"
                  label="Fewest tickets"
                  hint="Only works on orders this big."
                >
                  <Input
                    id="code-min"
                    type="number"
                    min={1}
                    value={minTickets}
                    onChange={(e) => setMinTickets(e.target.value)}
                    placeholder="Any"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="code-start" label="Works from">
                  <DateTimePicker
                    date={startsAt}
                    onDateChange={setStartsAt}
                    placeholder="Straight away"
                    clearable
                  />
                </Field>
                <Field id="code-end" label="Stops working">
                  <DateTimePicker
                    date={endsAt}
                    onDateChange={setEndsAt}
                    placeholder="When sales close"
                    clearable
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={limitsProblem !== null}
            hint={limitsProblem ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Nothing is made until you press Save. It works as soon as it is
                saved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-border divide-y text-sm">
                <SummaryRow
                  label="Code"
                  value={<span className="font-mono">{code}</span>}
                />
                <SummaryRow label="Does" value={worth} />
                <SummaryRow
                  label={kind === "UNLOCK" ? "Opens" : "Works on"}
                  value={
                    tierIds.length > 0
                      ? tierNames(tierIds)
                      : "Every ticket type"
                  }
                />
                <SummaryRow
                  label="Total uses"
                  value={limit(limits.maxRedemptions) ?? "No limit"}
                />
                <SummaryRow
                  label="Per person"
                  value={limit(limits.maxPerEmail) ?? "No limit"}
                />
                <SummaryRow
                  label="Fewest tickets"
                  value={limit(limits.minTickets) ?? "Any"}
                />
                <SummaryRow
                  label="Works from"
                  value={startsAt ? shownWhen(startsAt) : "Straight away"}
                />
                <SummaryRow
                  label="Stops working"
                  value={endsAt ? shownWhen(endsAt) : "When sales close"}
                />
              </dl>
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            label="Save code"
            onNext={save}
            disabled={codeProblem !== null || limitsProblem !== null}
            isPending={create.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
