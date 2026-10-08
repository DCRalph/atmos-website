import type { SerializedEditorState } from "lexical";

import type { RouterInputs, RouterOutputs } from "~/trpc/react";
import { DEFAULT_ACCESS_LEVEL } from "~/lib/ticketing/access-levels";
import { toAllocationBudget } from "~/lib/ticketing/capacity";
import { parsePriceToCents } from "~/lib/ticketing/money";
import { DEFAULT_PASS_THEME } from "~/lib/ticketing/pass-theme";
import type { PassThemeDraft } from "~/components/admin/ticketing/pass-theme-field";

/**
 * The event as the admin is editing it: details, tiers and door staff in one
 * draft, saved by one button. Pure data and functions, so the sections that
 * edit it and the hook that saves it agree on what "changed" means.
 */

export type AdminEvent = RouterOutputs["ticketEvents"]["byId"];
export type Visibility = AdminEvent["visibility"];
export type SalesChannel = AdminEvent["tiers"][number]["salesChannel"];
export type StaffRole = AdminEvent["staff"][number]["role"];

export type TierDraft = {
  /** Stable across edits and reorders; the id once the tier exists. */
  key: string;
  id?: string;
  name: string;
  description: string;
  price: string;
  allocation: string;
  groupSize: string;
  salesChannel: SalesChannel;
  releaseAfterPrevious: boolean;
  salesStartAt: Date | undefined;
  salesEndAt: Date | undefined;
  isActive: boolean;
  isHidden: boolean;
  requiresApproval: boolean;
  /** A code from the access levels table. */
  accessLevel: string;
  maxPerOrder: string;
  maxPerEmail: string;
  /** What the tier has done, read-only beside the inputs. */
  soldCount: number;
  heldCount: number;
};

export type StaffDraft = {
  userId: string;
  role: StaffRole;
  /** Null when the user record has gone. */
  user: { name: string; email: string } | null;
};

export type EventDraft = {
  name: string;
  slug: string;
  gigId: string | null;
  shortDescription: string;
  descriptionLexical: SerializedEditorState | null;
  posterFileUploadId: string | null;
  venueName: string;
  venueAddress: string;
  timezone: string;
  doorsAt: Date | undefined;
  startsAt: Date | undefined;
  endsAt: Date | undefined;
  salesOpenAt: Date | undefined;
  salesCloseAt: Date | undefined;
  capacity: string;
  compAllowance: string;
  maxPerOrder: string;
  visibility: Visibility;
  isR18: boolean;
  reentryAllowed: boolean;
  requireNames: boolean;
  feeFixed: string;
  feePercent: string;
  passTheme: PassThemeDraft;
  tiers: TierDraft[];
  staff: StaffDraft[];
};

/** The parts of the page a draft can be dirty in, as the Save bar names them. */
export type Section = "details" | "tiers" | "staff" | "wallet";

export const newTier = (fields: Partial<TierDraft> = {}): TierDraft => ({
  key: crypto.randomUUID(),
  name: "",
  description: "",
  price: "0.00",
  allocation: "100",
  groupSize: "1",
  salesChannel: "ALL",
  releaseAfterPrevious: false,
  salesStartAt: undefined,
  salesEndAt: undefined,
  isActive: true,
  isHidden: false,
  requiresApproval: false,
  accessLevel: DEFAULT_ACCESS_LEVEL,
  maxPerOrder: "10",
  maxPerEmail: "",
  soldCount: 0,
  heldCount: 0,
  ...fields,
});

const tierFromEvent = (tier: AdminEvent["tiers"][number]): TierDraft => ({
  key: tier.id,
  id: tier.id,
  name: tier.name,
  description: tier.description ?? "",
  price: (tier.priceCents / 100).toFixed(2),
  allocation: tier.allocation.toString(),
  groupSize: tier.groupSize.toString(),
  salesChannel: tier.salesChannel,
  releaseAfterPrevious: tier.releaseAfterPrevious,
  salesStartAt: tier.salesStartAt ?? undefined,
  salesEndAt: tier.salesEndAt ?? undefined,
  isActive: tier.isActive,
  isHidden: tier.isHidden,
  requiresApproval: tier.requiresApproval,
  accessLevel: tier.accessLevel,
  maxPerOrder: tier.maxPerOrder.toString(),
  maxPerEmail: tier.maxPerEmail?.toString() ?? "",
  soldCount: tier.soldCount,
  heldCount: tier.heldCount,
});

export const emptyDraft = (): EventDraft => ({
  name: "",
  slug: "",
  gigId: null,
  shortDescription: "",
  descriptionLexical: null,
  posterFileUploadId: null,
  venueName: "",
  venueAddress: "",
  timezone: "Pacific/Auckland",
  doorsAt: undefined,
  startsAt: undefined,
  endsAt: undefined,
  salesOpenAt: undefined,
  salesCloseAt: undefined,
  capacity: "",
  compAllowance: "",
  maxPerOrder: "10",
  visibility: "PUBLIC",
  isR18: true,
  reentryAllowed: false,
  requireNames: true,
  feeFixed: "",
  feePercent: "",
  passTheme: { ...DEFAULT_PASS_THEME },
  tiers: [],
  staff: [],
});

export const draftFromEvent = (event: AdminEvent): EventDraft => ({
  name: event.name,
  slug: event.slug,
  gigId: event.gigId,
  shortDescription: event.shortDescription ?? "",
  descriptionLexical:
    (event.descriptionLexical as SerializedEditorState | null) ?? null,
  posterFileUploadId: event.posterFileUploadId,
  venueName: event.venueName ?? "",
  venueAddress: event.venueAddress ?? "",
  timezone: event.timezone,
  doorsAt: event.doorsAt ?? undefined,
  startsAt: event.startsAt,
  endsAt: event.endsAt ?? undefined,
  salesOpenAt: event.salesOpenAt ?? undefined,
  salesCloseAt: event.salesCloseAt ?? undefined,
  capacity: event.capacity?.toString() ?? "",
  compAllowance: event.compAllowance?.toString() ?? "",
  maxPerOrder: event.maxTicketsPerOrder.toString(),
  visibility: event.visibility,
  isR18: event.isR18,
  reentryAllowed: event.reentryAllowed,
  requireNames: event.requireAttendeeNames,
  feeFixed:
    event.bookingFeeFixedCents != null
      ? (event.bookingFeeFixedCents / 100).toFixed(2)
      : "",
  feePercent:
    event.bookingFeePercentBp != null
      ? (event.bookingFeePercentBp / 100).toString()
      : "",
  passTheme: {
    stripStyle: event.passStripStyle,
    accentHex: event.passAccentHex ?? DEFAULT_PASS_THEME.accentHex,
    backgroundHex: event.passBackgroundHex ?? DEFAULT_PASS_THEME.backgroundHex,
    foregroundHex: event.passForegroundHex ?? DEFAULT_PASS_THEME.foregroundHex,
    labelHex: event.passLabelHex ?? DEFAULT_PASS_THEME.labelHex,
  },
  tiers: event.tiers.map(tierFromEvent),
  staff: event.staff.map((row) => ({
    userId: row.userId,
    role: row.role,
    user: row.user ? { name: row.user.name, email: row.user.email } : null,
  })),
});

/** A whole number from a form field, or null when it is blank. */
export const parseCount = (value: string): number | null =>
  value.trim() === "" ? null : Number(value);

const time = (date: Date | undefined) => date?.getTime() ?? null;

/**
 * What decides whether each section differs from what is stored. Per section,
 * so the Save bar can say "Unsaved: Tiers" rather than just "unsaved".
 */
export function sectionFingerprints(
  draft: EventDraft,
): Record<Section, string> {
  return {
    details: JSON.stringify({
      name: draft.name.trim(),
      slug: draft.slug.trim(),
      gigId: draft.gigId,
      shortDescription: draft.shortDescription.trim(),
      description: draft.descriptionLexical
        ? JSON.stringify(draft.descriptionLexical)
        : null,
      poster: draft.posterFileUploadId,
      venueName: draft.venueName.trim(),
      venueAddress: draft.venueAddress.trim(),
      timezone: draft.timezone,
      doorsAt: time(draft.doorsAt),
      startsAt: time(draft.startsAt),
      endsAt: time(draft.endsAt),
      salesOpenAt: time(draft.salesOpenAt),
      salesCloseAt: time(draft.salesCloseAt),
      capacity: draft.capacity.trim(),
      compAllowance: draft.compAllowance.trim(),
      maxPerOrder: draft.maxPerOrder.trim(),
      visibility: draft.visibility,
      isR18: draft.isR18,
      reentryAllowed: draft.reentryAllowed,
      requireNames: draft.requireNames,
      feeFixed: draft.feeFixed.trim(),
      feePercent: draft.feePercent.trim(),
    }),
    tiers: JSON.stringify(
      draft.tiers.map((tier) => ({
        ...tier,
        name: tier.name.trim(),
        description: tier.description.trim(),
        salesStartAt: time(tier.salesStartAt),
        salesEndAt: time(tier.salesEndAt),
        // Not edits: they come from the server and change under us.
        soldCount: undefined,
        heldCount: undefined,
      })),
    ),
    staff: JSON.stringify(
      [...draft.staff]
        .sort((a, b) => a.userId.localeCompare(b.userId))
        .map((row) => [row.userId, row.role]),
    ),
    wallet: JSON.stringify(draft.passTheme),
  };
}

/** The sections where `draft` differs from `baseline`. */
export function dirtySections(
  draft: EventDraft,
  baseline: EventDraft,
): Section[] {
  const a = sectionFingerprints(draft);
  const b = sectionFingerprints(baseline);
  return (Object.keys(a) as Section[]).filter((key) => a[key] !== b[key]);
}

export type FieldErrors = Partial<
  Record<
    | "name"
    | "startsAt"
    | "endsAt"
    | "doorsAt"
    | "salesCloseAt"
    | "capacity"
    | "compAllowance"
    | "maxPerOrder"
    | "feeFixed"
    | "feePercent"
    | "tiers",
    string
  >
>;

/** Which section an error belongs to, so the Save bar can point at it. */
export const errorSection = (field: keyof FieldErrors): Section =>
  field === "tiers" ? "tiers" : "details";

const isWhole = (value: string, min: number) => {
  const n = parseCount(value);
  return n === null || (Number.isInteger(n) && n >= min);
};

export const tierAllocation = (tiers: readonly TierDraft[]): number =>
  tiers.reduce((sum, tier) => sum + (Number(tier.allocation) || 0), 0);

/** The server's own rules, run before the round trip so they land on a field. */
export function validate(draft: EventDraft): FieldErrors {
  const errors: FieldErrors = {};

  if (!draft.name.trim()) errors.name = "Give the event a name";
  if (!draft.startsAt) errors.startsAt = "A start time is required";
  if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) {
    errors.endsAt = "The event can't end before it starts";
  }
  if (draft.startsAt && draft.doorsAt && draft.doorsAt > draft.startsAt) {
    errors.doorsAt = "Doors can't open after the event starts";
  }
  if (
    draft.salesOpenAt &&
    draft.salesCloseAt &&
    draft.salesCloseAt < draft.salesOpenAt
  ) {
    errors.salesCloseAt = "Sales can't close before they open";
  }
  if (!isWhole(draft.capacity, 1))
    errors.capacity = "A whole number, 1 or more";
  if (!isWhole(draft.compAllowance, 0)) {
    errors.compAllowance = "A whole number, 0 or more";
  }
  const maxPerOrder = parseCount(draft.maxPerOrder);
  if (
    maxPerOrder === null ||
    !Number.isInteger(maxPerOrder) ||
    maxPerOrder < 1 ||
    maxPerOrder > 50
  ) {
    errors.maxPerOrder = "Between 1 and 50";
  }
  if (draft.feeFixed.trim() && parsePriceToCents(draft.feeFixed) === null) {
    errors.feeFixed = "A price, like 1.50";
  }
  const percent = Number(draft.feePercent);
  if (
    draft.feePercent.trim() &&
    (Number.isNaN(percent) || percent < 0 || percent > 50)
  ) {
    errors.feePercent = "Between 0 and 50";
  }

  for (const tier of draft.tiers) {
    const label = tier.name.trim() || "An unnamed tier";
    if (!tier.name.trim()) {
      errors.tiers = "Give every tier a name";
    } else if (parsePriceToCents(tier.price) === null) {
      errors.tiers = `${label} needs a price, like 25.00`;
    } else if (!isWhole(tier.allocation, 0) || tier.allocation.trim() === "") {
      errors.tiers = `${label} needs a whole-number allocation`;
    } else if (Number(tier.allocation) < tier.soldCount + tier.heldCount) {
      errors.tiers = `${tier.soldCount + tier.heldCount} already sold or held in ${label}; its allocation can't go below that`;
    } else if (!isWhole(tier.groupSize, 1) || tier.groupSize.trim() === "") {
      errors.tiers = `${label} needs a whole number of tickets per purchase`;
    } else if (
      !isWhole(tier.maxPerOrder, 1) ||
      tier.maxPerOrder.trim() === ""
    ) {
      errors.tiers = `${label} needs a whole-number max per order`;
    } else if (!isWhole(tier.maxPerEmail, 1)) {
      errors.tiers = `${label} needs a whole-number max per email`;
    }
    if (errors.tiers) break;
  }
  return errors;
}

type SavePayload = Omit<RouterInputs["ticketEvents"]["create"], "startsAt"> & {
  startsAt: Date;
};

/** The draft as `ticketEvents.create` and `update` take it. */
export function toPayload(draft: EventDraft, startsAt: Date): SavePayload {
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim() || undefined,
    gigId: draft.gigId,
    shortDescription: draft.shortDescription.trim() || null,
    descriptionLexical: draft.descriptionLexical,
    posterFileUploadId: draft.posterFileUploadId,
    venueName: draft.venueName.trim() || null,
    venueAddress: draft.venueAddress.trim() || null,
    timezone: draft.timezone,
    startsAt,
    doorsAt: draft.doorsAt ?? null,
    endsAt: draft.endsAt ?? null,
    salesOpenAt: draft.salesOpenAt ?? null,
    salesCloseAt: draft.salesCloseAt ?? null,
    capacity: parseCount(draft.capacity),
    compAllowance: parseCount(draft.compAllowance),
    maxTicketsPerOrder: parseCount(draft.maxPerOrder) ?? 10,
    visibility: draft.visibility,
    isR18: draft.isR18,
    reentryAllowed: draft.reentryAllowed,
    requireAttendeeNames: draft.requireNames,
    bookingFeeFixedCents: draft.feeFixed.trim()
      ? parsePriceToCents(draft.feeFixed)
      : null,
    bookingFeePercentBp: draft.feePercent.trim()
      ? Math.round(Number(draft.feePercent) * 100)
      : null,
    passStripStyle: draft.passTheme.stripStyle,
    passAccentHex: draft.passTheme.accentHex,
    passBackgroundHex: draft.passTheme.backgroundHex,
    passForegroundHex: draft.passTheme.foregroundHex,
    passLabelHex: draft.passTheme.labelHex,
    tiers: draft.tiers.map((tier) => ({
      id: tier.id,
      name: tier.name.trim(),
      description: tier.description.trim() || null,
      priceCents: parsePriceToCents(tier.price) ?? 0,
      allocation: Number(tier.allocation),
      groupSize: Number(tier.groupSize),
      releaseAfterPrevious: tier.releaseAfterPrevious,
      salesChannel: tier.salesChannel,
      salesStartAt: tier.salesStartAt ?? null,
      salesEndAt: tier.salesEndAt ?? null,
      isActive: tier.isActive,
      isHidden: tier.isHidden,
      maxPerOrder: Number(tier.maxPerOrder),
      maxPerEmail: parseCount(tier.maxPerEmail),
      requiresApproval: tier.requiresApproval,
      accessLevel: tier.accessLevel,
    })),
    staff: draft.staff.map((row) => ({ userId: row.userId, role: row.role })),
  };
}

/**
 * One line of the readiness check. `needed` blocks Publish; `advice` is worth
 * a look but never stops anything.
 */
export type ChecklistItem = {
  label: string;
  detail?: string;
  state: "ok" | "needed" | "advice";
  /** Where it gets fixed. */
  section?: Section;
};

/**
 * What stands between this event and going on sale, read from the draft so
 * it answers for what is on screen, saved or not.
 */
export function buildChecklist({
  draft,
  event,
  gigPosterId,
  isDirty,
}: {
  draft: EventDraft;
  event: AdminEvent | undefined;
  gigPosterId: string | null;
  isDirty: boolean;
}): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  items.push({
    label: "Name and start time",
    state: draft.name.trim() && draft.startsAt ? "ok" : "needed",
    section: "details",
  });

  items.push(
    draft.posterFileUploadId
      ? { label: "Poster", state: "ok", section: "details" }
      : gigPosterId
        ? {
            label: "Poster",
            detail: "From the linked gig",
            state: "ok",
            section: "details",
          }
        : {
            label: "Poster",
            detail: "Optional, but the event page is bare without one.",
            state: "advice",
            section: "details",
          },
  );

  const onSale = draft.tiers.filter(
    (tier) => tier.isActive && (Number(tier.allocation) || 0) > 0,
  );
  items.push({
    label: "At least one tier on sale",
    detail:
      draft.tiers.length === 0
        ? "Add a tier."
        : onSale.length === 0
          ? "Switch a tier on."
          : `${onSale.length} of ${draft.tiers.length} on sale`,
    state: onSale.length > 0 ? "ok" : "needed",
    section: "tiers",
  });

  const capacity = parseCount(draft.capacity);
  if (capacity !== null) {
    const budget = toAllocationBudget({
      capacity,
      allocated: tierAllocation(draft.tiers),
      comps: event?.budget.comps ?? 0,
      compAllowance: parseCount(draft.compAllowance),
    });
    items.push(
      budget.overAllocatedBy > 0
        ? {
            label: "Tiers fit the room",
            detail: `The tiers allocate ${budget.overAllocatedBy} more than the cap. Trim one.`,
            state: "needed",
            section: "tiers",
          }
        : (budget.unallocated ?? 0) > 0
          ? {
              label: "Tiers fit the room",
              detail: `${budget.unallocated} seats aren't in any tier, so they can't be sold.`,
              state: "advice",
              section: "tiers",
            }
          : { label: "Tiers fit the room", state: "ok", section: "tiers" },
    );
  }

  items.push(
    draft.staff.length > 0
      ? {
          label: "Door staff",
          detail: `${draft.staff.length} on the door`,
          state: "ok",
          section: "staff",
        }
      : {
          label: "Door staff",
          detail: "Optional. Only admins can scan until someone is assigned.",
          state: "advice",
          section: "staff",
        },
  );

  if (event) {
    items.push({ label: "Changes saved", state: isDirty ? "needed" : "ok" });
  }

  return items;
}
