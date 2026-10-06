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
import { toAllocationBudget } from "~/lib/ticketing/capacity";
import { parsePriceToCents } from "~/lib/ticketing/money";
import {
  accessLevel as accessLevelMeta,
  isElevated,
} from "~/lib/ticketing/access-levels";
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
 */

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
    if (tier.soldCount + tier.heldCount > 0) {
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
    comps: event?.budget.comps ?? 0,
  });
  const over = budget.overAllocatedBy > 0;

  const door = draft.tiers.filter((tier) => tier.salesChannel === "DOOR");
  const doorAllocation = tierAllocation(door);
  const doorSold = door.reduce((sum, tier) => sum + tier.soldCount, 0);
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
                    ? `Cap ${capacity} · ${budget.allocated} allocated${budget.comps ? ` · ${budget.comps} comped` : ""} · ${budget.overAllocatedBy} over. Checkout stops at the cap, so trim a tier.`
                    : `Cap ${capacity} · ${budget.allocated} allocated${budget.comps ? ` · ${budget.comps} comped` : ""} · ${budget.unallocated} still free.`}{" "}
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
                <span>Sold</span>
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
  previous,
  onPatch,
  expanded,
  onToggle,
  onRemove,
}: {
  tier: TierDraft;
  previous: TierDraft | null;
  onPatch: (fields: Partial<TierDraft>) => void;
  /** Whether the rarer settings are open under the row. */
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tier.key });

  const remaining = Math.max(
    0,
    (Number(tier.allocation) || 0) - tier.soldCount - tier.heldCount,
  );
  const groupSize = Number(tier.groupSize) || 1;
  const soldOut = remaining < groupSize;

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
                {accessLevelMeta(tier.accessLevel).short}
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
          {tier.id ? (
            <>
              {tier.soldCount}
              {tier.heldCount > 0 ? ` · ${tier.heldCount} held` : ""}
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
