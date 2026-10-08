"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DoorOpen,
  EyeOff,
  GripVertical,
  ChevronDown,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { AccessLevelSelect } from "~/components/admin/ticketing/access-level-select";
import {
  toAllocationBudget,
  type AllocationBudget,
} from "~/lib/ticketing/capacity";
import { parsePriceToCents } from "~/lib/ticketing/money";
import { isElevated } from "~/lib/ticketing/access-levels";
import { useAccessLevels } from "~/hooks/use-access-levels";
import { cn } from "~/lib/utils";
import {
  newTier,
  parseCount,
  tierAllocation,
  type AdminEvent,
  type SalesChannel,
  type TierDraft,
} from "./draft";
import type { EventDraftState } from "./use-event-draft";
import { Field } from "./fields";

/**
 * The tiers as a table you type into. Name, price, allocation, per buy and
 * channel are inline; the rarer settings sit behind a side sheet. Rows drag to
 * reorder, and the order is the order "release after" follows. All of it is
 * the draft, saved with the rest of the event.
 *
 * Sold and held counts are polled rather than read from the draft, so the cap
 * can be judged against what is selling right now while the plan is edited.
 */

const LIVE_POLL_MS = 5000;

const SALES_CHANNELS = [
  { value: "ALL", label: "Online + door" },
  { value: "ONLINE", label: "Online only" },
  { value: "DOOR", label: "Door only" },
] as const satisfies readonly { value: SalesChannel; label: string }[];

export function TiersSection({
  state,
  event,
}: {
  state: EventDraftState;
  event: AdminEvent | undefined;
}) {
  const { draft, update, errors } = state;
  const [open, setOpen] = useState<string | null>(null);

  const live = api.ticketEvents.liveCounts.useQuery(
    { id: event?.id ?? "" },
    { enabled: Boolean(event), refetchInterval: LIVE_POLL_MS },
  );
  const liveById = new Map(live.data?.tiers.map((tier) => [tier.id, tier]));
  // Live where the tier exists, else what the draft was loaded with.
  const countsOf = (tier: TierDraft) => {
    const counts = tier.id ? liveById.get(tier.id) : undefined;
    return {
      sold: counts?.soldCount ?? tier.soldCount,
      held: counts?.heldCount ?? tier.heldCount,
    };
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const setTiers = (tiers: TierDraft[]) => update("tiers", tiers);
  const patch = (key: string, fields: Partial<TierDraft>) =>
    setTiers(
      draft.tiers.map((tier) =>
        tier.key === key ? { ...tier, ...fields } : tier,
      ),
    );
  const remove = (tier: TierDraft) => {
    const { sold, held } = countsOf(tier);
    if (sold + held > 0) {
      toast.error(
        `${tier.name || "That tier"} has tickets in it. Switch it off instead.`,
      );
      return;
    }
    setTiers(draft.tiers.filter((t) => t.key !== tier.key));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = draft.tiers.findIndex((t) => t.key === active.id);
    const to = draft.tiers.findIndex((t) => t.key === over.id);
    if (from < 0 || to < 0) return;
    setTiers(arrayMove(draft.tiers, from, to));
  };

  // The cap, as this plan would use it. The same arithmetic the save is
  // judged by, run against what is being typed.
  const capacity = parseCount(draft.capacity);
  const budget = toAllocationBudget({
    capacity,
    allocated: tierAllocation(draft.tiers),
    comps: live.data?.comps ?? event?.budget.comps ?? 0,
    compAllowance: parseCount(draft.compAllowance),
  });
  const over = budget.overAllocatedBy > 0;
  const kept = budget.compsReserved
    ? ` · ${budget.compsReserved} kept for comps`
    : "";

  const door = draft.tiers.filter((tier) => tier.salesChannel === "DOOR");
  const doorAllocation = tierAllocation(door);
  const doorSold = door.reduce((sum, tier) => sum + countsOf(tier).sold, 0);
  const shared = draft.tiers.filter((tier) => tier.salesChannel === "ALL");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Tiers</CardTitle>
              <CardDescription className={cn(over && "text-amber-500")}>
                {capacity === null
                  ? "No cap set, so the allocations decide how many tickets exist."
                  : over
                    ? `Cap ${capacity} · ${budget.allocated} allocated${kept} · ${budget.overAllocatedBy} over. Checkout stops at the cap, so trim a tier.`
                    : `Cap ${capacity} · ${budget.allocated} allocated${kept} · ${budget.unallocated} still free.`}{" "}
                Drag rows to set the order &ldquo;release after&rdquo; follows.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setTiers([
                    ...draft.tiers,
                    newTier({
                      name: "Door sales",
                      salesChannel: "DOOR",
                      // What the room has left, priced like the dearest
                      // tier: the usual door is the last of the room at the
                      // top price.
                      allocation: String(budget.unallocated ?? 50),
                      price: (
                        Math.max(
                          0,
                          ...draft.tiers.map(
                            (t) => parsePriceToCents(t.price) ?? 0,
                          ),
                        ) / 100
                      ).toFixed(2),
                    }),
                  ])
                }
              >
                <DoorOpen className="size-4" /> Door allocation
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const tier = newTier({
                    name: draft.tiers.length === 0 ? "General admission" : "",
                    allocation: String(
                      budget.unallocated !== null && budget.unallocated > 0
                        ? budget.unallocated
                        : 100,
                    ),
                  });
                  setTiers([...draft.tiers, tier]);
                }}
              >
                <Plus className="size-4" /> Tier
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {draft.tiers.length > 0 ? (
            <div className="mb-4 space-y-4">
              <AllocationMeter budget={budget} tiers={draft.tiers} />
              {event ? (
                <CapMeter
                  budget={budget}
                  tiers={draft.tiers.map((tier) => ({
                    allocation: Number(tier.allocation) || 0,
                    ...countsOf(tier),
                  }))}
                />
              ) : null}
            </div>
          ) : null}
          {draft.tiers.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
              No tiers yet. An event needs at least one before it can be
              published.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <div className="text-muted-foreground mb-1 hidden grid-cols-[24px_minmax(0,1.6fr)_0.8fr_0.8fr_0.7fr_0.6fr_1fr_72px] gap-2 px-1 text-xs lg:grid">
                <span />
                <span>Name</span>
                <span>Price</span>
                <span>Allocation</span>
                <span>Sold · left</span>
                <span>Per buy</span>
                <span>Sold where</span>
                <span />
              </div>
              <SortableContext
                items={draft.tiers.map((tier) => tier.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {draft.tiers.map((tier, index) => (
                    <TierRow
                      key={tier.key}
                      tier={tier}
                      {...countsOf(tier)}
                      previous={draft.tiers[index - 1] ?? null}
                      onPatch={(fields) => patch(tier.key, fields)}
                      expanded={open === tier.key}
                      onToggle={() =>
                        setOpen((current) =>
                          current === tier.key ? null : tier.key,
                        )
                      }
                      onRemove={() => remove(tier)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {errors.tiers ? (
            <p className="text-destructive mt-3 text-xs">{errors.tiers}</p>
          ) : null}
        </CardContent>
      </Card>

      {door.length > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-6 text-sm">
            <DoorOpen className="text-muted-foreground size-4" />
            <span className="font-semibold">
              Door allocation {doorAllocation}
            </span>
            <span className="text-muted-foreground">·</span>
            <span>{doorSold} sold at the door</span>
            <span className="text-muted-foreground">·</span>
            <span>{Math.max(0, doorAllocation - doorSold)} left</span>
            <p className="text-muted-foreground basis-full text-xs">
              {shared.length > 0
                ? `Online buyers never see it. The scanner can also sell ${shared.map((t) => t.name || "an unnamed tier").join(", ")}, sold both ways; set ${shared.length === 1 ? "it" : "them"} to online only to hold the door to its allocation.`
                : "Online buyers never see it, and the scanner can sell exactly this many."}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TierRow({
  tier,
  sold,
  held,
  previous,
  onPatch,
  expanded,
  onToggle,
  onRemove,
}: {
  tier: TierDraft;
  /** Live counts, which the draft's own copies fall behind. */
  sold: number;
  held: number;
  previous: TierDraft | null;
  onPatch: (fields: Partial<TierDraft>) => void;
  /** Whether the rarer settings are open under the row. */
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { level } = useAccessLevels();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tier.key });

  const allocation = Number(tier.allocation) || 0;
  const remaining = Math.max(0, allocation - sold - held);
  const groupSize = Number(tier.groupSize) || 1;
  const soldOut = remaining < groupSize;
  const heldNote = held > 0 ? ` +${held} held` : "";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border",
        isDragging && "opacity-70",
        !tier.isActive && "bg-muted/40",
      )}
    >
      <div className="grid grid-cols-2 gap-2 p-2 lg:grid-cols-[24px_minmax(0,1.6fr)_0.8fr_0.8fr_0.7fr_0.6fr_1fr_72px] lg:items-center">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground hidden cursor-grab justify-self-center active:cursor-grabbing lg:block"
          aria-label={`Drag ${tier.name || "tier"} to reorder`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="col-span-2 min-w-0 lg:col-span-1">
          <Input
            aria-label="Tier name"
            placeholder="Tier name"
            value={tier.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            className="h-8"
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {!tier.isActive ? <Badge variant="outline">Paused</Badge> : null}
            {tier.isHidden ? (
              <Badge variant="outline">
                <EyeOff className="size-3" /> Hidden
              </Badge>
            ) : null}
            {tier.releaseAfterPrevious && previous ? (
              <Badge variant="outline">
                After {previous.name || "the tier above"}
              </Badge>
            ) : null}
            {tier.requiresApproval ? (
              <Badge variant="outline">Needs approval</Badge>
            ) : null}
            {isElevated(tier.accessLevel) ? (
              <Badge variant="secondary">
                {level(tier.accessLevel).short}
              </Badge>
            ) : null}
            {tier.id && soldOut && tier.isActive ? (
              <Badge variant="outline">Sold out</Badge>
            ) : null}
          </div>
        </div>
        <Input
          aria-label={groupSize > 1 ? "Price per group" : "Price"}
          inputMode="decimal"
          value={tier.price}
          onChange={(e) => onPatch({ price: e.target.value })}
          className="h-8"
        />
        <Input
          aria-label="Allocation, in tickets"
          type="number"
          min={0}
          value={tier.allocation}
          onChange={(e) => onPatch({ allocation: e.target.value })}
          className="h-8"
        />
        <p className="text-muted-foreground self-center text-xs tabular-nums">
          {/* Group tiers sell whole groups, so lead with those; tickets
              that can't fill a group don't count as left. */}
          {tier.id && groupSize > 1 ? (
            <>
              <span className="text-foreground block">
                {Math.floor(remaining / groupSize)} of{" "}
                {Math.floor(allocation / groupSize)} groups left
              </span>
              {sold} / {allocation} tickets{heldNote}
            </>
          ) : tier.id ? (
            <>
              <span className="text-foreground block">
                {remaining} of {allocation} left
              </span>
              {sold} sold{heldNote}
            </>
          ) : (
            "New"
          )}
        </p>
        <Input
          aria-label="Tickets per purchase"
          type="number"
          min={1}
          max={20}
          value={tier.groupSize}
          onChange={(e) => onPatch({ groupSize: e.target.value })}
          className="h-8"
        />
        <Select
          value={tier.salesChannel}
          onValueChange={(next) => {
            const channel = SALES_CHANNELS.find((c) => c.value === next);
            if (channel) onPatch({ salesChannel: channel.value });
          }}
        >
          <SelectTrigger size="sm" aria-label="Sold where" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SALES_CHANNELS.map((channel) => (
              <SelectItem key={channel.value} value={channel.value}>
                {channel.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`${expanded ? "Hide" : "Show"} more settings for ${tier.name || "tier"}`}
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Remove ${tier.name || "tier"}`}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {expanded ? (
        <TierDetails tier={tier} previous={previous} onPatch={onPatch} />
      ) : null}
    </div>
  );
}

/** One coloured run of a meter bar. */
type Segment = { label: string; value: number; color: string };

// Grey in both meters, so the door's green in the allocation bar stays the door's.
const COMPS_COLOR = "var(--muted-foreground)";
const COMPS_KEPT_COLOR =
  "color-mix(in oklab, var(--muted-foreground) 40%, transparent)";

/**
 * How the room is split, as it is being typed: online-only, shared and
 * door-only allocations plus the seats kept for comps, against the cap. Past
 * the cap the bar rescales and a tick marks where the cap falls.
 */
function AllocationMeter({
  budget,
  tiers,
}: {
  budget: AllocationBudget;
  tiers: readonly TierDraft[];
}) {
  const allocatedTo = (channel: SalesChannel) =>
    tierAllocation(tiers.filter((tier) => tier.salesChannel === channel));

  const segments: Segment[] = [
    {
      label: "Online",
      value: allocatedTo("ONLINE"),
      color: "var(--ticket-series-revenue)",
    },
    {
      label: "Online + door",
      value: allocatedTo("ALL"),
      color:
        "color-mix(in oklab, var(--ticket-series-revenue) 50%, var(--ticket-series-arrivals))",
    },
    {
      label: "Door",
      value: allocatedTo("DOOR"),
      color: "var(--ticket-series-arrivals)",
    },
    { label: "Comps", value: budget.compsReserved, color: COMPS_COLOR },
  ];
  const planned = budget.allocated + budget.compsReserved;
  const scale = Math.max(1, budget.capacity ?? 0, planned);

  return (
    <div className="space-y-2">
      <MeterLegend title="Allocation" segments={segments}>
        {budget.capacity === null ? (
          <Stat label="Total" value={planned} />
        ) : budget.overAllocatedBy > 0 ? (
          <Stat label="Over" value={budget.overAllocatedBy} warn />
        ) : (
          <Stat label="Free" value={budget.unallocated ?? 0} />
        )}
        {budget.capacity !== null ? (
          <Stat label="Cap" value={budget.capacity} />
        ) : null}
      </MeterLegend>
      <MeterBar
        segments={segments}
        scale={scale}
        marker={
          budget.capacity !== null && planned > budget.capacity
            ? budget.capacity
            : undefined
        }
      />
    </div>
  );
}

/**
 * Live sales against the room: sold, mid-checkout, comps issued and the rest
 * of the allowance kept for them. What is left to sell is the smaller of what
 * the tiers still have and what the cap still allows.
 */
function CapMeter({
  budget,
  tiers,
}: {
  budget: AllocationBudget;
  tiers: readonly { allocation: number; sold: number; held: number }[];
}) {
  const sold = tiers.reduce((sum, tier) => sum + tier.sold, 0);
  const held = tiers.reduce((sum, tier) => sum + tier.held, 0);
  const committed = sold + held + budget.compsReserved;

  const leftInTiers = tiers.reduce(
    (sum, tier) => sum + Math.max(0, tier.allocation - tier.sold - tier.held),
    0,
  );
  const leftToSell =
    budget.capacity === null
      ? leftInTiers
      : Math.min(leftInTiers, Math.max(0, budget.capacity - committed));

  const segments: Segment[] = [
    { label: "Sold", value: sold, color: "var(--ticket-series-revenue)" },
    {
      label: "Held",
      value: held,
      color:
        "color-mix(in oklab, var(--ticket-series-revenue) 45%, transparent)",
    },
    { label: "Comps", value: budget.comps, color: COMPS_COLOR },
    {
      label: "Kept for comps",
      value: budget.compsReserved - budget.comps,
      color: COMPS_KEPT_COLOR,
    },
  ];

  return (
    <div className="space-y-2">
      <MeterLegend title="Sales" segments={segments}>
        <Stat label="Left to sell" value={leftToSell} />
      </MeterLegend>
      <MeterBar
        segments={segments}
        scale={Math.max(
          1,
          committed,
          budget.capacity ?? budget.allocated + budget.compsReserved,
        )}
      />
    </div>
  );
}

/** A meter's title, its non-empty segments as a key, then `children` last. */
function MeterLegend({
  title,
  segments,
  children,
}: {
  title: string;
  segments: readonly Segment[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm tabular-nums">
      <span className="font-medium">{title}</span>
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <span key={segment.label} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: segment.color }}
            />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-medium">{segment.value}</span>
          </span>
        ))}
      <span className="ml-auto flex gap-x-4">{children}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5",
        warn && "text-amber-600 dark:text-amber-500",
      )}
    >
      <span className={cn(!warn && "text-muted-foreground")}>{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

/** Segments laid end to end against `scale`, with an optional tick at `marker`. */
function MeterBar({
  segments,
  scale,
  marker,
}: {
  segments: readonly Segment[];
  scale: number;
  marker?: number;
}) {
  return (
    <div className="relative">
      <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((segment) =>
          segment.value > 0 ? (
            <div
              key={segment.label}
              className="h-full"
              style={{
                width: `${(segment.value / scale) * 100}%`,
                background: segment.color,
              }}
            />
          ) : null,
        )}
      </div>
      {marker !== undefined ? (
        <div
          className="bg-foreground absolute -top-1 -bottom-1 w-0.5"
          style={{ left: `${(marker / scale) * 100}%` }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

/** The rarer tier settings, opened under the row so the table stays a table. */
function TierDetails({
  tier,
  previous,
  onPatch,
}: {
  tier: TierDraft;
  previous: TierDraft | null;
  onPatch: (fields: Partial<TierDraft>) => void;
}) {
  return (
    <div className="grid gap-5 border-t p-4 md:grid-cols-2">
      <Field id={`tier-description-${tier.key}`} label="Description">
        <Input
          id={`tier-description-${tier.key}`}
          value={tier.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          placeholder="Shown under the tier name"
        />
      </Field>

      <Field
        id={`tier-level-${tier.key}`}
        label="Access level"
        hint="What the door sees when one of these is scanned. Copied onto each ticket as it's issued."
      >
        <AccessLevelSelect
          value={tier.accessLevel}
          onValueChange={(accessLevel) => onPatch({ accessLevel })}
          className="w-full"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id={`tier-start-${tier.key}`} label="Sale starts">
          <DateTimePicker
            date={tier.salesStartAt}
            onDateChange={(salesStartAt) => onPatch({ salesStartAt })}
            placeholder="With the event"
            clearable
          />
        </Field>
        <Field id={`tier-end-${tier.key}`} label="Sale ends">
          <DateTimePicker
            date={tier.salesEndAt}
            onDateChange={(salesEndAt) => onPatch({ salesEndAt })}
            placeholder="Until doors"
            clearable
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          id={`tier-max-order-${tier.key}`}
          label={
            Number(tier.groupSize) > 1
              ? "Max per order (groups)"
              : "Max per order"
          }
        >
          <Input
            id={`tier-max-order-${tier.key}`}
            type="number"
            min={1}
            max={50}
            value={tier.maxPerOrder}
            onChange={(e) => onPatch({ maxPerOrder: e.target.value })}
          />
        </Field>
        <Field
          id={`tier-max-email-${tier.key}`}
          label="Max per email"
          hint="Only enforceable on free tiers."
        >
          <Input
            id={`tier-max-email-${tier.key}`}
            type="number"
            min={1}
            placeholder="No limit"
            value={tier.maxPerEmail}
            onChange={(e) => onPatch({ maxPerEmail: e.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-3 md:col-span-2">
        <DetailToggle
          label="On sale"
          hint="Off pauses this tier without removing it."
          checked={tier.isActive}
          onChange={(isActive) => onPatch({ isActive })}
        />
        {previous ? (
          <DetailToggle
            label={`Release after ${previous.name || "the tier above"}`}
            hint="Stays off the public page and the door until the tier above sells out, passes its sale end, or is switched off."
            checked={tier.releaseAfterPrevious}
            onChange={(releaseAfterPrevious) =>
              onPatch({ releaseAfterPrevious })
            }
          />
        ) : null}
        <DetailToggle
          label="Hidden until unlocked by a code"
          hint="A discount code that unlocks hidden tiers reveals it. The door can always sell it."
          checked={tier.isHidden}
          onChange={(isHidden) => onPatch({ isHidden })}
        />
        <DetailToggle
          label="Approve each request"
          hint="Guest list style: the buyer asks, you approve, then the ticket is issued."
          checked={tier.requiresApproval}
          onChange={(requiresApproval) => onPatch({ requiresApproval })}
        />
      </div>
    </div>
  );
}

function DetailToggle({
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
