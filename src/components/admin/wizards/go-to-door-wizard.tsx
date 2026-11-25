"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";
import { moveUnsoldToDoor, remainingInTier } from "~/lib/ticketing/tiers";
import { EventGate } from "./gates";
import { eventEditorHref, eventLabel, type AdminEvent } from "./event-common";
import { Caution, Choice, Field, Loading, SummaryRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "when", label: "When" },
  { key: "door", label: "At the door" },
  { key: "review", label: "Review" },
] as const;

type Tier = AdminEvent["tiers"][number];

const CHANNEL_NOTE = {
  ALL: "Online and at the door",
  ONLINE: "Online only",
  DOOR: "At the door only",
} as const satisfies Record<Tier["salesChannel"], string>;

/**
 * Close online sales and sell the rest at the door. Closing is the event's
 * "sales close" time: past it, online checkout stops, the door keeps selling
 * anything with stock, and what the online-only ticket types didn't sell
 * moves to the last door ticket type. With no door ticket type there is
 * nowhere for those to go, so the wizard offers to add one.
 */
export function GoToDoorWizard() {
  return (
    <EventGate wizard="go-to-door">
      {(eventId) => <Loaded eventId={eventId} />}
    </EventGate>
  );
}

function Loaded({ eventId }: { eventId: string }) {
  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  if (event.isPending || !event.data) {
    return (
      <WizardShell wizard="go-to-door">
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
  const [openedAt] = useState(() => new Date());
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState<Date | undefined>(
    event.salesCloseAt && event.salesCloseAt > openedAt
      ? event.salesCloseAt
      : undefined,
  );
  const [isDone, setIsDone] = useState(false);

  const active = event.tiers.filter((tier) => tier.isActive);
  const hasDoorTier = active.some((tier) => tier.salesChannel === "DOOR");
  const onlineOnly = active.filter((tier) => tier.salesChannel === "ONLINE");
  const unsoldOnline = onlineOnly.reduce(
    (sum, tier) => sum + remainingInTier(tier),
    0,
  );
  const topPrice = Math.max(0, ...event.tiers.map((tier) => tier.priceCents));

  // Only worth asking when there are online-only leftovers and no door
  // ticket type to take them.
  const canAddDoor = !hasDoorTier && unsoldOnline > 0;
  const [addDoor, setAddDoor] = useState(canAddDoor);
  const [doorName, setDoorName] = useState("Door sales");
  const [doorPrice, setDoorPrice] = useState((topPrice / 100).toFixed(2));

  const closeAt = when === "now" ? null : (at ?? null);
  const doorPriceCents = parsePriceToCents(doorPrice);
  const doorError =
    addDoor && !doorName.trim()
      ? "Give the door ticket type a name."
      : addDoor && doorPriceCents === null
        ? "The door price needs to look like 35.00."
        : null;

  // What the door can sell once closed, as the server will work it out:
  // any close time before "now" reads as closed.
  const preview = moveUnsoldToDoor(
    [
      ...event.tiers,
      ...(addDoor && canAddDoor
        ? [
            {
              id: "new-door",
              name: doorName.trim() || "Door sales",
              salesChannel: "DOOR" as const,
              isActive: true,
              allocation: 0,
              soldCount: 0,
              heldCount: 0,
              priceCents: doorPriceCents ?? 0,
              sortOrder: Number.MAX_SAFE_INTEGER,
            },
          ]
        : []),
    ],
    new Date(0),
    new Date(1),
  ).filter((tier) => tier.isActive && tier.salesChannel !== "ONLINE");
  const doorCanSell = preview.reduce(
    (sum, tier) => sum + remainingInTier(tier),
    0,
  );

  const update = api.ticketEvents.update.useMutation({
    onSuccess: async () => {
      setIsDone(true);
      toast.success(
        when === "now" ? "Online sales closed" : "Online sales will close",
      );
      await Promise.all([
        utils.ticketEvents.byId.invalidate({ id: event.id }),
        utils.ticketEvents.liveCounts.invalidate({ id: event.id }),
        utils.wizards.eventChoices.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const save = () =>
    update.mutate({
      id: event.id,
      salesCloseAt: when === "now" ? new Date() : closeAt,
      ...(addDoor && canAddDoor
        ? {
            tiers: [
              ...event.tiers.map((tier) => ({ id: tier.id })),
              {
                name: doorName.trim(),
                priceCents: doorPriceCents ?? 0,
                allocation: 0,
                salesChannel: "DOOR" as const,
              },
            ],
          }
        : {}),
    });

  const alreadyClosed =
    event.salesCloseAt !== null && event.salesCloseAt <= openedAt;

  return (
    <WizardShell
      wizard="go-to-door"
      subtitle={eventLabel(event)}
      editorHref={eventEditorHref(event.id)}
      steps={steps}
      isDirty={when === "later" && Boolean(at)}
      done={
        isDone ? (
          <DonePanel
            title={
              when === "now"
                ? "Online sales are closed"
                : "Online sales will close"
            }
            description={
              when === "now"
                ? `The door can sell ${doorCanSell} more. Buyers online see that sales have closed.`
                : `Online sales close ${closeAt ? formatEventDateTime(closeAt) : ""}. After that the door can sell what is left.`
            }
            next={[
              { key: "door-staff", eventId: event.id },
              { key: "guest-list", eventId: event.id },
            ]}
            links={[
              {
                href: `/door/${event.id}`,
                label: "Open the door screen",
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "when" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>When should online sales stop?</CardTitle>
              <CardDescription>
                {alreadyClosed && event.salesCloseAt
                  ? `Online sales already closed ${formatEventDateTime(event.salesCloseAt)}. Saving again moves that time.`
                  : event.salesCloseAt
                    ? `They are set to close ${formatEventDateTime(event.salesCloseAt)}.`
                    : "Right now they run until the event starts."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                role="radiogroup"
                aria-label="When"
                className="grid gap-3 sm:grid-cols-2"
              >
                <Choice
                  selected={when === "now"}
                  onSelect={() => setWhen("now")}
                  title="Now"
                  detail="Online checkout stops as soon as you save."
                />
                <Choice
                  selected={when === "later"}
                  onSelect={() => setWhen("later")}
                  title="At a set time"
                  detail="Say, an hour before doors."
                />
              </div>
              {when === "later" ? (
                <Field id="close-at" label="Close online sales at">
                  <DateTimePicker
                    date={at}
                    onDateChange={setAt}
                    placeholder="Pick a time"
                  />
                </Field>
              ) : null}
              {event.status !== "PUBLISHED" ? (
                <Caution>
                  This event is not on sale right now, so nothing is selling
                  online to stop. The close time still applies once it is.
                </Caution>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onNext={steps.next}
            disabled={when === "later" && !at}
            hint={when === "later" && !at ? "Pick a time." : undefined}
          />
        </>
      ) : null}

      {steps.step === "door" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What the door can sell</CardTitle>
              <CardDescription>
                Once online sales close, the door scanner sells whatever is
                left.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-border divide-y rounded-lg border text-sm">
                {active.map((tier) => (
                  <li
                    key={tier.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2.5"
                  >
                    <span>
                      <span className="font-medium">{tier.name}</span>{" "}
                      <span className="text-muted-foreground text-xs">
                        {formatNZD(tier.priceCents)} ·{" "}
                        {CHANNEL_NOTE[tier.salesChannel]}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {tier.salesChannel === "ONLINE"
                        ? hasDoorTier || addDoor
                          ? `${remainingInTier(tier)} unsold move to the door`
                          : `${remainingInTier(tier)} unsold stay unsold`
                        : `${remainingInTier(tier)} left`}
                    </span>
                  </li>
                ))}
              </ul>

              {canAddDoor ? (
                <div className="rounded-lg border">
                  <label className="flex cursor-pointer items-start justify-between gap-4 p-3">
                    <span>
                      <Label className="cursor-pointer">
                        Add a door ticket type
                      </Label>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        There is none yet, so the {unsoldOnline} online-only
                        tickets left have nowhere to go. A door ticket type
                        takes them all.
                      </span>
                    </span>
                    <Switch checked={addDoor} onCheckedChange={setAddDoor} />
                  </label>
                  {addDoor ? (
                    <div className="grid gap-4 border-t p-3 sm:grid-cols-2">
                      <Field id="door-name" label="Name">
                        <Input
                          id="door-name"
                          value={doorName}
                          onChange={(e) => setDoorName(e.target.value)}
                        />
                      </Field>
                      <Field
                        id="door-price"
                        label="Door price"
                        hint="Usually the top online price."
                      >
                        <Input
                          id="door-price"
                          inputMode="decimal"
                          value={doorPrice}
                          onChange={(e) => setDoorPrice(e.target.value)}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="text-sm">
                The door will be able to sell{" "}
                <span className="font-medium tabular-nums">{doorCanSell}</span>{" "}
                more.
              </p>
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={Boolean(doorError)}
            hint={doorError ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Nothing changes until you press Save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="divide-border divide-y text-sm">
                <SummaryRow
                  label="Online sales"
                  value={
                    when === "now"
                      ? "Close now"
                      : `Close ${closeAt ? formatEventDateTime(closeAt) : ""}`
                  }
                />
                {addDoor && canAddDoor ? (
                  <SummaryRow
                    label="New door ticket"
                    value={`${doorName.trim()} · ${formatNZD(doorPriceCents ?? 0)}`}
                  />
                ) : null}
                <SummaryRow
                  label="Door can sell"
                  value={`${doorCanSell} more`}
                />
              </dl>
              {when === "now" && event.status === "PUBLISHED" ? (
                <Caution>
                  Anyone part way through buying online will be stopped. Their
                  held tickets go back for the door when the hold runs out.
                </Caution>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            label={when === "now" ? "Close online sales" : "Save"}
            onNext={save}
            isPending={update.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
