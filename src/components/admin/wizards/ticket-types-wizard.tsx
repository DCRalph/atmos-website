"use client";

import { useState, type ReactNode } from "react";
import { DoorOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { AccessLevelSelect } from "~/components/admin/ticketing/access-level-select";
import {
  draftFromEvent,
  newTier,
  tierFromEvent,
  toPayload,
  validate,
  type SalesChannel,
  type TierDraft,
} from "~/components/admin/ticketing/workspace/draft";
import { useAccessLevels } from "~/hooks/use-access-levels";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";
import { EventGate } from "./gates";
import { eventEditorHref, eventLabel, type AdminEvent } from "./event-common";
import {
  Caution,
  DiffList,
  Field,
  Loading,
  shownWhen,
  type DiffRow,
} from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";
import { SortableList } from "./sortable";

const STEPS = [
  { key: "types", label: "Ticket types" },
  { key: "when", label: "When they sell" },
  { key: "who", label: "Who can buy" },
  { key: "review", label: "Review" },
] as const;

const CHANNELS = [
  { value: "ALL", label: "Online and at the door" },
  { value: "ONLINE", label: "Online only" },
  { value: "DOOR", label: "At the door only" },
] as const satisfies readonly { value: SalesChannel; label: string }[];

const channelLabel = (channel: SalesChannel) =>
  CHANNELS.find((entry) => entry.value === channel)?.label ?? channel;

const sold = (tier: TierDraft) => tier.soldCount + tier.heldCount;
const nameOf = (tier: TierDraft) => tier.name.trim() || "Unnamed";
const yesNo = (value: boolean) => (value ? "Yes" : "No");

/**
 * The top ticket type has nothing above it to wait for, so one that lands
 * there from a drag or a removal stops waiting rather than keep a setting
 * nobody can see.
 */
const withTopFree = (tiers: TierDraft[]): TierDraft[] =>
  tiers.map((tier, index) =>
    index === 0 && tier.releaseAfterPrevious
      ? { ...tier, releaseAfterPrevious: false, hideUntilReleased: false }
      : tier,
  );

/**
 * Set up an event's ticket types: what they are and cost, when each sells,
 * and who can buy it. The same tier plan the full event page edits, laid out
 * a question at a time; the rarer knobs (unlock codes, the cap, door moves)
 * stay on the full page.
 */
export function TicketTypesWizard() {
  return (
    <EventGate wizard="ticket-types">
      {(eventId) => <Loaded eventId={eventId} />}
    </EventGate>
  );
}

function Loaded({ eventId }: { eventId: string }) {
  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  if (event.isPending || !event.data) {
    return (
      <WizardShell wizard="ticket-types">
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
  const { level } = useAccessLevels();
  const [tiers, setTiers] = useState(() => event.tiers.map(tierFromEvent));
  const [isDone, setIsDone] = useState(false);

  const update = api.ticketEvents.update.useMutation({
    onSuccess: async () => {
      setIsDone(true);
      toast.success("Ticket types saved");
      await Promise.all([
        utils.ticketEvents.byId.invalidate({ id: event.id }),
        utils.wizards.eventChoices.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const patch = (key: string, fields: Partial<TierDraft>) =>
    setTiers((all) =>
      all.map((tier) => (tier.key === key ? { ...tier, ...fields } : tier)),
    );

  // The full editor's own rules and payload, run on the event with these
  // tiers swapped in, so the two can never disagree about what is valid.
  const draft = { ...draftFromEvent(event), tiers };
  const error = validate(draft).tiers ?? null;
  const rows = diffRows(event, tiers, (code) => level(code).label);
  const save = () =>
    update.mutate({
      id: event.id,
      tiers: toPayload(draft, event.startsAt).tiers,
    });

  const addTier = (fields: Partial<TierDraft> = {}) =>
    setTiers((all) => [
      ...all,
      newTier({
        name: all.length === 0 ? "General admission" : "",
        ...fields,
      }),
    ]);

  return (
    <WizardShell
      wizard="ticket-types"
      subtitle={eventLabel(event)}
      editorHref={`${eventEditorHref(event.id)}?section=tiers`}
      steps={steps}
      isDirty={rows.length > 0}
      done={
        isDone ? (
          <DonePanel
            title="Ticket types saved"
            description="The buy panel shows them from the next purchase."
            next={[
              { key: "guest-list", eventId: event.id },
              { key: "event-basics", eventId: event.id },
            ]}
            links={[
              {
                href: `${eventEditorHref(event.id)}?section=tiers`,
                label: "See sales by ticket type",
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "types" ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Ticket types</CardTitle>
                  <CardDescription>
                    What people can buy, what it costs, and how many there are.
                    Drag to reorder; buyers see them in this order.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addTier({
                        name: "Door sales",
                        salesChannel: "DOOR",
                        allocation: "50",
                        // The usual door price is the top online price.
                        price: (
                          Math.max(
                            0,
                            ...tiers.map(
                              (t) => parsePriceToCents(t.price) ?? 0,
                            ),
                          ) / 100
                        ).toFixed(2),
                      })
                    }
                  >
                    <DoorOpen className="size-4" aria-hidden />
                    Door sales
                  </Button>
                  <Button type="button" size="sm" onClick={() => addTier()}>
                    <Plus className="size-4" aria-hidden />
                    Ticket type
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {tiers.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  No ticket types yet. Add one to start selling.
                </p>
              ) : (
                <>
                  <div className="text-muted-foreground hidden grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_36px] gap-2 pl-8 text-xs sm:grid">
                    <span>Name</span>
                    <span>Price</span>
                    <span>How many</span>
                    <span />
                  </div>
                  <SortableList
                    items={tiers}
                    keyOf={(tier) => tier.key}
                    labelOf={nameOf}
                    onReorder={(next) => setTiers(withTopFree(next))}
                    className="space-y-2"
                    rowClassName={(tier) =>
                      cn(
                        "rounded-lg border p-2",
                        !tier.isActive && "bg-muted/40",
                      )
                    }
                  >
                    {(tier) => (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.6fr)_0.8fr_0.8fr_36px] sm:items-start">
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <Input
                            aria-label="Name"
                            placeholder="Like Early bird"
                            value={tier.name}
                            onChange={(e) =>
                              patch(tier.key, { name: e.target.value })
                            }
                            className="h-8"
                          />
                          <p className="text-muted-foreground mt-1 text-xs">
                            {tier.id
                              ? `${tier.soldCount} sold${tier.isActive ? "" : " · closed"}`
                              : "New"}
                          </p>
                        </div>
                        <Input
                          aria-label="Price"
                          inputMode="decimal"
                          value={tier.price}
                          onChange={(e) =>
                            patch(tier.key, { price: e.target.value })
                          }
                          className="h-8"
                        />
                        <Input
                          aria-label="How many"
                          type="number"
                          min={sold(tier)}
                          value={tier.allocation}
                          onChange={(e) =>
                            patch(tier.key, { allocation: e.target.value })
                          }
                          className="h-8"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Remove ${nameOf(tier)}`}
                          title={
                            sold(tier) > 0
                              ? "Has sales, so it can be closed but not removed"
                              : undefined
                          }
                          disabled={sold(tier) > 0}
                          onClick={() =>
                            setTiers((all) =>
                              withTopFree(
                                all.filter((other) => other.key !== tier.key),
                              ),
                            )
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </SortableList>
                </>
              )}
              {tiers.some((tier) => sold(tier) > 0) ? (
                <p className="text-muted-foreground text-xs">
                  A ticket type with sales can be closed on the next step, but
                  not removed.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onNext={steps.next}
            disabled={Boolean(error)}
            hint={error ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "when" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>When they sell</CardTitle>
              <CardDescription>
                Where each one is sold, and when. Leave the dates blank to sell
                for as long as the event does.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tiers.map((tier, index) => {
                const previous = tiers[index - 1];
                return (
                  <TierBlock key={tier.key} tier={tier}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id={`channel-${tier.key}`} label="Sold">
                        <Select
                          value={tier.salesChannel}
                          onValueChange={(next) => {
                            const channel = CHANNELS.find(
                              (entry) => entry.value === next,
                            );
                            if (channel) {
                              patch(tier.key, { salesChannel: channel.value });
                            }
                          }}
                        >
                          <SelectTrigger
                            id={`channel-${tier.key}`}
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CHANNELS.map((channel) => (
                              <SelectItem
                                key={channel.value}
                                value={channel.value}
                              >
                                {channel.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Toggle
                        label="On sale"
                        hint="Off closes it without removing it."
                        checked={tier.isActive}
                        onChange={(isActive) => patch(tier.key, { isActive })}
                      />
                      <Field id={`start-${tier.key}`} label="Sale starts">
                        <DateTimePicker
                          date={tier.salesStartAt}
                          onDateChange={(salesStartAt) =>
                            patch(tier.key, { salesStartAt })
                          }
                          placeholder="With the event"
                          clearable
                        />
                      </Field>
                      <Field id={`end-${tier.key}`} label="Sale ends">
                        <DateTimePicker
                          date={tier.salesEndAt}
                          onDateChange={(salesEndAt) =>
                            patch(tier.key, { salesEndAt })
                          }
                          placeholder="Until doors"
                          clearable
                        />
                      </Field>
                      {previous ? (
                        <Toggle
                          label={`Only after ${nameOf(previous)} sells out`}
                          hint="Locked until the one above sells out, ends, or is closed."
                          checked={tier.releaseAfterPrevious}
                          onChange={(releaseAfterPrevious) =>
                            patch(tier.key, {
                              releaseAfterPrevious,
                              ...(releaseAfterPrevious
                                ? {}
                                : { hideUntilReleased: false }),
                            })
                          }
                        />
                      ) : null}
                      {previous && tier.releaseAfterPrevious ? (
                        <Toggle
                          label="Hide it until then"
                          hint={
                            tier.hideUntilReleased
                              ? "Buyers won't see it until it goes on sale."
                              : "Buyers see it locked with its price, so they know it is next."
                          }
                          checked={tier.hideUntilReleased}
                          onChange={(hideUntilReleased) =>
                            patch(tier.key, { hideUntilReleased })
                          }
                        />
                      ) : null}
                    </div>
                  </TierBlock>
                );
              })}
            </CardContent>
          </Card>
          <WizardFooter onBack={steps.back} onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "who" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Who can buy</CardTitle>
              <CardDescription>
                Limits, group tickets, and anything only some people should see.
                The defaults suit most ticket types.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tiers.map((tier) => (
                <TierBlock key={tier.key} tier={tier}>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field
                      id={`group-${tier.key}`}
                      label="Tickets per purchase"
                      hint="2 or more sells it as a group, priced per group."
                    >
                      <Input
                        id={`group-${tier.key}`}
                        type="number"
                        min={1}
                        max={20}
                        value={tier.groupSize}
                        onChange={(e) =>
                          patch(tier.key, { groupSize: e.target.value })
                        }
                      />
                    </Field>
                    <Field id={`max-order-${tier.key}`} label="Most per order">
                      <Input
                        id={`max-order-${tier.key}`}
                        type="number"
                        min={1}
                        max={50}
                        value={tier.maxPerOrder}
                        onChange={(e) =>
                          patch(tier.key, { maxPerOrder: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      id={`max-email-${tier.key}`}
                      label="Most per person"
                      hint="Free tickets only."
                    >
                      <Input
                        id={`max-email-${tier.key}`}
                        type="number"
                        min={1}
                        placeholder="No limit"
                        value={tier.maxPerEmail}
                        onChange={(e) =>
                          patch(tier.key, { maxPerEmail: e.target.value })
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field id={`description-${tier.key}`} label="Description">
                        <Input
                          id={`description-${tier.key}`}
                          value={tier.description}
                          onChange={(e) =>
                            patch(tier.key, { description: e.target.value })
                          }
                          placeholder="Shown under the name"
                        />
                      </Field>
                      <div className="mt-2">
                        <Toggle
                          label="Show it in red"
                          hint="For a warning buyers shouldn't miss."
                          checked={tier.highlightDescription}
                          onChange={(highlightDescription) =>
                            patch(tier.key, { highlightDescription })
                          }
                        />
                      </div>
                    </div>
                    <Field
                      id={`level-${tier.key}`}
                      label="Access"
                      hint="What the door sees when it is scanned."
                    >
                      <AccessLevelSelect
                        id={`level-${tier.key}`}
                        value={tier.accessLevel}
                        onValueChange={(accessLevel) =>
                          patch(tier.key, { accessLevel })
                        }
                        className="w-full"
                      />
                    </Field>
                    <div className="grid gap-4 sm:col-span-3 sm:grid-cols-2">
                      <Toggle
                        label="Only with a code"
                        hint="Hidden online unless a buyer has an unlock code for it. Add codes on the full event page."
                        checked={tier.isHidden}
                        onChange={(isHidden) => patch(tier.key, { isHidden })}
                      />
                      <Toggle
                        label="Approve each request"
                        hint="People ask, you approve, then the ticket is issued."
                        checked={tier.requiresApproval}
                        onChange={(requiresApproval) =>
                          patch(tier.key, { requiresApproval })
                        }
                      />
                    </div>
                  </div>
                </TierBlock>
              ))}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={Boolean(error)}
            hint={error ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList rows={rows} empty="No changes yet. Go back to make some.">
            {event.status === "PUBLISHED" && rows.length > 0 ? (
              <Caution>
                This event is on sale. Changes apply to the next purchase;
                people who already bought keep what they paid for.
              </Caution>
            ) : null}
          </DiffList>
          <WizardFooter
            onBack={steps.back}
            label={`Save ${rows.length} change${rows.length === 1 ? "" : "s"}`}
            onNext={save}
            disabled={rows.length === 0 || Boolean(error)}
            isPending={update.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}

/** One ticket type's settings on the "when" and "who" steps. */
function TierBlock({
  tier,
  children,
}: {
  tier: TierDraft;
  children: ReactNode;
}) {
  const price = parsePriceToCents(tier.price);
  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-4 flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
        {nameOf(tier)}
        <span className="text-muted-foreground text-xs font-normal">
          {price === null ? "" : formatNZD(price)} · {tier.allocation || 0}{" "}
          tickets
        </span>
      </h3>
      {children}
    </section>
  );
}

/** A setting that is on or off, with what it means under it. */
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3">
      <span>
        <Label className="cursor-pointer">{label}</Label>
        <span className="text-muted-foreground mt-0.5 block text-xs">
          {hint}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** Every setting the review compares, as the wizard words it. */
const SETTINGS: { label: string; of: (tier: TierDraft) => string }[] = [
  { label: "name", of: (t) => t.name.trim() },
  { label: "price", of: (t) => formatNZD(parsePriceToCents(t.price) ?? 0) },
  { label: "how many", of: (t) => t.allocation.trim() },
  { label: "sold", of: (t) => channelLabel(t.salesChannel) },
  { label: "on sale", of: (t) => yesNo(t.isActive) },
  {
    label: "sale starts",
    of: (t) => (t.salesStartAt ? shownWhen(t.salesStartAt) : "With the event"),
  },
  {
    label: "sale ends",
    of: (t) => (t.salesEndAt ? shownWhen(t.salesEndAt) : "Until doors"),
  },
  {
    label: "after the one above",
    of: (t) =>
      t.releaseAfterPrevious
        ? t.hideUntilReleased
          ? "Yes, hidden until then"
          : "Yes"
        : "No",
  },
  { label: "per purchase", of: (t) => t.groupSize.trim() },
  { label: "most per order", of: (t) => t.maxPerOrder.trim() },
  { label: "most per person", of: (t) => t.maxPerEmail.trim() || "No limit" },
  { label: "description", of: (t) => t.description.trim() || "Not set" },
  { label: "description in red", of: (t) => yesNo(t.highlightDescription) },
  { label: "only with a code", of: (t) => yesNo(t.isHidden) },
  { label: "approve each", of: (t) => yesNo(t.requiresApproval) },
];

/**
 * The review: each setting that changed on a saved ticket type, the ones
 * added and removed, and the order when it moved.
 */
function diffRows(
  event: AdminEvent,
  tiers: TierDraft[],
  levelLabel: (code: string) => string,
): DiffRow[] {
  const saved = new Map(
    event.tiers.map((tier) => [tier.id, tierFromEvent(tier)]),
  );
  const settings = [
    ...SETTINGS,
    { label: "access", of: (t: TierDraft) => levelLabel(t.accessLevel) },
  ];
  const rows: DiffRow[] = [];

  for (const tier of tiers) {
    const before = tier.id ? saved.get(tier.id) : undefined;
    if (!before) {
      rows.push({
        label: `Added: ${nameOf(tier)}`,
        before: "Not there",
        after: `${formatNZD(parsePriceToCents(tier.price) ?? 0)} · ${tier.allocation} tickets`,
      });
      continue;
    }
    for (const setting of settings) {
      const was = setting.of(before);
      const now = setting.of(tier);
      if (was !== now) {
        rows.push({
          label: `${before.name} ${setting.label}`,
          before: was,
          after: now,
        });
      }
    }
  }

  const kept = new Set(tiers.map((tier) => tier.id));
  for (const tier of event.tiers) {
    if (!kept.has(tier.id)) {
      rows.push({
        label: `Removed: ${tier.name}`,
        before: `${formatNZD(tier.priceCents)} · ${tier.allocation} tickets`,
        after: "Removed",
      });
    }
  }

  const order = (names: string[]) => names.join(", ");
  const savedOrder = event.tiers
    .filter((tier) => kept.has(tier.id))
    .map((tier) => tier.id);
  const newOrder = tiers.flatMap((tier) => (tier.id ? [tier.id] : []));
  if (savedOrder.join() !== newOrder.join()) {
    rows.push({
      label: "Order",
      before: order(savedOrder.map((id) => saved.get(id)?.name ?? "Unnamed")),
      after: order(tiers.filter((tier) => tier.id).map((tier) => nameOf(tier))),
    });
  }
  return rows;
}
