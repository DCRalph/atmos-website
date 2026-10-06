"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SerializedEditorState } from "lexical";
import {
  Copy,
  Loader2,
  Plus,
  Save,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import {
  SaveStatusPill,
  type SaveStatus,
} from "~/components/admin/save-status";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { PickerSelect } from "~/components/ui/picker-select";
import { SearchableSelect } from "~/components/ui/searchable-select";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import { LexicalRichTextEditor } from "~/components/lexical";
import { useConfirm } from "~/components/confirm-provider";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { buildMediaUrl } from "~/lib/media-url";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";
import { toAllocationBudget } from "~/lib/ticketing/capacity";
import { DEFAULT_PASS_THEME } from "~/lib/ticketing/pass-theme";
import {
  PassThemeField,
  type PassThemeDraft,
} from "~/components/admin/ticketing/pass-theme-field";
import {
  PublishChecklist,
  type ChecklistItem,
} from "~/components/admin/ticketing/publish-checklist";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];
type Visibility = AdminEvent["visibility"];

/**
 * The ticketed event editor, for both creating and editing.
 *
 * Works like the gig editor: every field is a local draft, committed by the one
 * sticky Save, with Discard, Cmd/Ctrl+S, inline errors and a warning before
 * leaving with unsaved changes. Tiers are the exception — on an existing event
 * they live on the Tiers tab and save one at a time. A new event can carry a
 * starting set of tiers, created straight after the event itself.
 *
 * Times are entered in the browser's zone and stored as UTC. The event's own
 * `timezone` is what the public pages and the door render in.
 */

const VISIBILITIES = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Listed on /events and on its gig page.",
  },
  {
    value: "UNLISTED",
    label: "Unlisted",
    description: "Listed nowhere, but the URL works for anyone who has it.",
  },
  {
    value: "PRIVATE",
    label: "Private, invite link only",
    description:
      "Only opens with the key on the link. Copy it from the Overview tab once saved.",
  },
] as const satisfies readonly {
  value: Visibility;
  label: string;
  description: string;
}[];

/** A tier typed in on the create form, before the event exists. */
type StarterTier = {
  key: string;
  name: string;
  price: string;
  allocation: string;
  groupSize: string;
  requiresApproval: boolean;
  /** Waits for the starter tier above it to stop selling. */
  releaseAfterPrevious: boolean;
};

const starterTier = (fields: Partial<StarterTier> = {}): StarterTier => ({
  key: crypto.randomUUID(),
  name: "General admission",
  price: "",
  allocation: "100",
  groupSize: "1",
  requiresApproval: false,
  releaseAfterPrevious: false,
  ...fields,
});

/** One-click starting points for the usual nights. */
const TIER_PRESETS: { label: string; tiers: () => StarterTier[] }[] = [
  { label: "Tier", tiers: () => [starterTier()] },
  {
    label: "Early bird then GA",
    tiers: () => [
      starterTier({ name: "Early bird", price: "25.00", allocation: "50" }),
      starterTier({
        name: "General admission",
        price: "35.00",
        allocation: "150",
        releaseAfterPrevious: true,
      }),
    ],
  },
  {
    label: "Free guest list",
    tiers: () => [
      starterTier({
        name: "Guest list",
        price: "0.00",
        allocation: "50",
        requiresApproval: true,
      }),
    ],
  },
  {
    label: "Group of 4",
    tiers: () => [
      starterTier({ name: "Group of 4", allocation: "40", groupSize: "4" }),
    ],
  },
];

type EventDraft = {
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
  /** Only used while creating. */
  starterTiers: StarterTier[];
};

const emptyDraft = (): EventDraft => ({
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
  starterTiers: [],
});

const draftFromEvent = (event: AdminEvent): EventDraft => ({
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
  starterTiers: [],
});

/** Everything that decides whether the draft differs from what is stored. */
const fingerprint = (draft: EventDraft): string =>
  JSON.stringify({
    ...draft,
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    shortDescription: draft.shortDescription.trim(),
    venueName: draft.venueName.trim(),
    venueAddress: draft.venueAddress.trim(),
    starterTiers: draft.starterTiers.map(({ key: _key, ...tier }) => tier),
  });

/** A whole number from a form field, or null when it is blank. */
const parseCount = (value: string): number | null =>
  value.trim() === "" ? null : Number(value);

type FieldErrors = Partial<
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
    | "starterTiers",
    string
  >
>;

/** The server's own rules, run before the round trip so they land on a field. */
const validate = (draft: EventDraft): FieldErrors => {
  const errors: FieldErrors = {};
  const whole = (value: string, min: number) => {
    const n = parseCount(value);
    return n === null || (Number.isInteger(n) && n >= min);
  };

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
  if (!whole(draft.capacity, 1)) errors.capacity = "A whole number, 1 or more";
  if (!whole(draft.compAllowance, 0)) {
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

  const badTier = draft.starterTiers.find(
    (tier) =>
      !tier.name.trim() ||
      parsePriceToCents(tier.price) === null ||
      !whole(tier.allocation, 1) ||
      !whole(tier.groupSize, 1),
  );
  if (badTier) {
    errors.starterTiers = `"${badTier.name || "Untitled"}" needs a name, a price and a whole-number allocation`;
  } else {
    const capacity = parseCount(draft.capacity);
    const allocated = starterAllocation(draft.starterTiers);
    if (capacity !== null && allocated > capacity) {
      errors.starterTiers = `The tiers allocate ${allocated} against a cap of ${capacity}`;
    }
  }
  return errors;
};

const starterAllocation = (tiers: StarterTier[]): number =>
  tiers.reduce((sum, tier) => sum + (Number(tier.allocation) || 0), 0);

/** The draft as `ticketEvents.create`/`update` take it. */
const toPayload = (draft: EventDraft, startsAt: Date) => ({
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
});

/** Every IANA zone the browser knows, for the time zone picker. */
const TIME_ZONES = Intl.supportedValuesOf("timeZone").map((zone) => ({
  value: zone,
  label: zone.replaceAll("_", " "),
}));

export function EventEditor({
  event,
  onOpenTab,
  onDirtyChange,
}: {
  /** Absent while creating. */
  event?: AdminEvent;
  /** Switches the surrounding event page to another tab. */
  onOpenTab?: (tab: "tiers" | "staff") => void;
  /** Lets the event page flag the Settings tab while edits are unsaved. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const confirm = useConfirm();
  const isNew = !event;

  const serverVersion = event
    ? `${event.id}:${event.updatedAt.getTime()}`
    : null;
  const [draft, setDraft] = useState<EventDraft>(() =>
    event ? draftFromEvent(event) : emptyDraft(),
  );
  const [baseline, setBaseline] = useState<EventDraft>(draft);
  const [hydratedVersion, setHydratedVersion] = useState(serverVersion);
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [copyingGig, setCopyingGig] = useState(false);

  const isSaving = saveState === "saving";
  const isDirty = useMemo(
    () => fingerprint(draft) !== fingerprint(baseline),
    [draft, baseline],
  );

  // Adopt newer server state, but never on top of unsaved edits or mid-save.
  if (event && serverVersion !== hydratedVersion && !isSaving && !isDirty) {
    const next = draftFromEvent(event);
    setHydratedVersion(serverVersion);
    setDraft(next);
    setBaseline(next);
  }

  useUnsavedChangesWarning({ enabled: isDirty && !isSaving });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // "Saved" is a flash of confirmation, not a resting state.
  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [saveState]);

  const update = useCallback(
    <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      // Editing a field clears its complaint rather than leaving it stale.
      setErrors((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key as keyof FieldErrors];
        return next;
      });
    },
    [],
  );

  // The linked gig, for its poster and for copying its details across.
  const linkedGig = api.gigs.getForEditor.useQuery(
    { id: draft.gigId ?? "" },
    { enabled: draft.gigId !== null },
  );
  const gigPosterId = linkedGig.data?.posterFileUploadId ?? null;

  /** Fill the draft from a gig. Everything stays editable, and discardable. */
  const copyFromGig = useCallback(
    async (gigId: string) => {
      setCopyingGig(true);
      try {
        const gig = await utils.gigs.getForEditor.fetch({ id: gigId });
        if (!gig) throw new Error("Gig not found");
        setDraft((current) => ({
          ...current,
          gigId,
          name: gig.title,
          startsAt: gig.gigStartTime ?? current.startsAt,
          endsAt: gig.gigEndTime ?? undefined,
          venueName: gig.subtitle || current.venueName,
          shortDescription: gig.shortDescription ?? current.shortDescription,
          descriptionLexical:
            (gig.descriptionLexical as SerializedEditorState | null) ??
            current.descriptionLexical,
        }));
        setErrors({});
        toast.success(`Copied the details from "${gig.title}"`);
      } catch {
        toast.error("Couldn't load that gig.");
      } finally {
        setCopyingGig(false);
      }
    },
    [utils],
  );

  const createEvent = api.ticketEvents.create.useMutation();
  const updateEvent = api.ticketEvents.update.useMutation();
  const createTier = api.ticketEvents.createTier.useMutation();
  const duplicate = api.ticketEvents.duplicate.useMutation({
    onSuccess: (copy) => {
      toast.success(`Created "${copy.name}" as a draft`);
      void utils.ticketEvents.list.invalidate();
      router.push(`/admin/events/${copy.id}?tab=settings`);
    },
    onError: (error) => toast.error(error.message),
  });
  const setStatus = api.ticketEvents.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Published. Tickets are on sale.");
      void utils.ticketEvents.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteEvent = api.ticketEvents.delete.useMutation({
    onSuccess: () => {
      toast.success("Event deleted");
      void utils.ticketEvents.list.invalidate();
      router.push("/admin/events");
    },
    onError: (error) => toast.error(error.message),
  });

  const save = useCallback(async () => {
    if (isSaving) return;

    const found = validate(draft);
    setErrors(found);
    const firstError = Object.values(found).find(Boolean);
    if (firstError) {
      setSaveState("error");
      setErrorMessage(firstError);
      toast.error(firstError);
      return;
    }
    if (!draft.startsAt) return; // Narrowing; `validate` already caught this.

    setSaveState("saving");
    setErrorMessage(null);
    const payload = toPayload(draft, draft.startsAt);

    try {
      if (!event) {
        const created = await createEvent.mutateAsync(payload);
        // One at a time, in order, so they keep the order they were typed in.
        // A tier that fails doesn't undo the event: it is reported and can be
        // added from the Tiers tab.
        const failed: string[] = [];
        for (const tier of draft.starterTiers) {
          await createTier
            .mutateAsync({
              eventId: created.id,
              name: tier.name.trim(),
              priceCents: parsePriceToCents(tier.price) ?? 0,
              allocation: Number(tier.allocation),
              groupSize: Number(tier.groupSize),
              requiresApproval: tier.requiresApproval,
              releaseAfterPrevious: tier.releaseAfterPrevious,
            })
            .catch(() => failed.push(tier.name));
        }
        // The draft is now the stored event, so leaving isn't losing anything.
        setBaseline(draft);
        if (failed.length > 0) {
          toast.error(
            `Event created, but ${failed.join(", ")} couldn't be added. Add ${failed.length === 1 ? "it" : "them"} on the Tiers tab.`,
          );
        } else {
          toast.success("Event created");
        }
        void utils.ticketEvents.list.invalidate();
        router.replace(`/admin/events/${created.id}?tab=settings`);
        return;
      }

      const saved = await updateEvent.mutateAsync({ id: event.id, ...payload });
      // A cap that no longer covers the tiers saves, but never quietly.
      if (saved.capacityWarning) {
        toast.warning(saved.capacityWarning, { duration: 10_000 });
      }
      await utils.ticketEvents.byId.invalidate({ id: event.id });
      void utils.ticketEvents.list.invalidate();
      setBaseline(draft);
      setSaveState("saved");
      toast.success("Changes saved");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong saving";
      setSaveState("error");
      setErrorMessage(message);
      toast.error(message);
    }
  }, [
    createEvent,
    createTier,
    draft,
    event,
    isSaving,
    router,
    updateEvent,
    utils,
  ]);

  // Ctrl/Cmd+S, read through a ref so the listener is bound once.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // A fresh edit outranks the lingering "Saved" flash.
  const status: SaveStatus =
    isDirty && (saveState === "idle" || saveState === "saved")
      ? "dirty"
      : saveState;

  const checklist = useMemo(
    () => buildChecklist({ draft, event, gigPosterId, isDirty }),
    [draft, event, gigPosterId, isDirty],
  );

  const setDoorsBefore = (minutes: number) => {
    if (!draft.startsAt) return;
    update("doorsAt", new Date(draft.startsAt.getTime() - minutes * 60_000));
  };

  const posterPreview = draft.posterFileUploadId ?? gigPosterId;
  const fee = event?.siteDefaults.bookingFee;

  return (
    <div>
      {/* The page's one and only Save, kept in reach of every field. */}
      <div className="bg-background/95 sticky top-20 z-20 -mx-2 mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 backdrop-blur">
        <SaveStatusPill status={status} errorMessage={errorMessage} />
        {status === "idle" ? (
          <span className="text-muted-foreground text-sm">
            {isNew
              ? "Fill in the details, then create the event."
              : "Everything here is up to date."}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {isDirty && !isNew ? (
            <Button
              variant="ghost"
              disabled={isSaving}
              onClick={() => {
                setDraft(baseline);
                setErrors({});
                setErrorMessage(null);
                setSaveState("idle");
              }}
            >
              <Undo2 className="h-4 w-4" />
              Discard changes
            </Button>
          ) : null}
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isNew ? "Create event" : "Save"}
              </>
            )}
          </Button>
        </div>
      </div>

      {isNew ? (
        <Card className="mb-6 border-[color:var(--accent-strong)]/40 bg-[color:var(--accent-strong)]/5">
          <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" /> Start from a gig
              </Label>
              <PickerSelect
                endpoint={api.pickers.gigs}
                value={draft.gigId}
                onChange={(gigId) => {
                  if (gigId) void copyFromGig(gigId);
                  else update("gigId", null);
                }}
                disabled={copyingGig}
                placeholder="Search gigs…"
                searchPlaceholder="Search gigs by title…"
                emptyText="No gigs match that."
                clearLabel="No gig"
              />
              <p className="text-muted-foreground text-xs">
                Links the gig and copies its name, start and end, venue and
                description. Its poster is used until you upload one.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Copy className="h-4 w-4" /> Or duplicate an event
              </Label>
              <PickerSelect
                endpoint={api.pickers.ticketEvents}
                value={null}
                onChange={(id) => {
                  if (id) duplicate.mutate({ id });
                }}
                disabled={duplicate.isPending}
                placeholder="Search events…"
                searchPlaceholder="Search events by name…"
                emptyText="No events match that."
              />
              <p className="text-muted-foreground text-xs">
                Copies its settings and tiers into a new draft, with no sales.
                Move the dates before publishing.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Core details</CardTitle>
              <CardDescription>
                Name, linked gig, and what buyers read
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  id="event-name"
                  label="Event name"
                  error={errors.name}
                  required
                >
                  <Input
                    id="event-name"
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                    aria-invalid={Boolean(errors.name)}
                  />
                </Field>
                <Field
                  id="event-slug"
                  label="URL"
                  hint={
                    event && event.status !== "DRAFT"
                      ? "Changing it breaks links already shared."
                      : draft.slug
                        ? `/events/${draft.slug}`
                        : "Made from the name when left empty."
                  }
                >
                  <Input
                    id="event-slug"
                    value={draft.slug}
                    onChange={(e) => update("slug", e.target.value)}
                    placeholder="auto"
                  />
                </Field>
              </div>

              <Field
                id="event-gig"
                label="Linked gig"
                hint="The gig page shows the buy panel when one is linked."
              >
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <PickerSelect
                      id="event-gig"
                      endpoint={api.pickers.gigs}
                      value={draft.gigId}
                      onChange={(gigId) => update("gigId", gigId)}
                      placeholder="No gig"
                      searchPlaceholder="Search gigs by title…"
                      emptyText="No gigs match that."
                      clearLabel="No gig"
                    />
                  </div>
                  {draft.gigId ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={copyingGig}
                      onClick={() =>
                        draft.gigId && void copyFromGig(draft.gigId)
                      }
                    >
                      {copyingGig ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      Copy details
                    </Button>
                  ) : null}
                </div>
              </Field>

              <Field
                id="event-short"
                label="Short description"
                hint="Shown under the title on the event page."
              >
                <Textarea
                  id="event-short"
                  rows={2}
                  maxLength={300}
                  value={draft.shortDescription}
                  onChange={(e) => update("shortDescription", e.target.value)}
                />
              </Field>

              <div className="flex flex-col gap-2">
                <Label>Description</Label>
                <LexicalRichTextEditor
                  value={draft.descriptionLexical}
                  onChange={(value) => update("descriptionLexical", value)}
                  namespace={`event-description-${event?.id ?? "new"}`}
                  placeholder="Line-up, set times, what to bring…"
                  ariaLabel="Description"
                  minHeight="10rem"
                />
              </div>
            </CardContent>
          </Card>

          {isNew ? (
            <Card>
              <CardHeader>
                <CardTitle>Tiers</CardTitle>
                <CardDescription>
                  Add a starting set now. Sale windows, hidden tiers and access
                  levels are on the Tiers tab once the event exists.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.starterTiers.length > 0 ? (
                  <div className="text-muted-foreground hidden grid-cols-[1.6fr_0.8fr_0.8fr_0.6fr_auto] gap-2 px-1 text-xs md:grid">
                    <span>Name</span>
                    <span>Price (NZD)</span>
                    <span>Allocation</span>
                    <span>Per buy</span>
                    <span className="w-9" />
                  </div>
                ) : null}
                {draft.starterTiers.map((tier, index) => (
                  <StarterTierRow
                    key={tier.key}
                    tier={tier}
                    previousName={draft.starterTiers[index - 1]?.name ?? null}
                    onChange={(next) =>
                      update(
                        "starterTiers",
                        draft.starterTiers.map((t) =>
                          t.key === tier.key ? next : t,
                        ),
                      )
                    }
                    onRemove={() =>
                      update(
                        "starterTiers",
                        draft.starterTiers.filter((t) => t.key !== tier.key),
                      )
                    }
                  />
                ))}
                {errors.starterTiers ? (
                  <p className="text-destructive text-xs">
                    {errors.starterTiers}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {TIER_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update("starterTiers", [
                          ...draft.starterTiers,
                          ...preset.tiers(),
                        ])
                      }
                    >
                      <Plus className="h-4 w-4" /> {preset.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Poster</CardTitle>
              <CardDescription>
                Shown on the event page and the buyer&apos;s tickets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {!draft.posterFileUploadId && posterPreview ? (
                  <div className="relative aspect-3/4 w-32 shrink-0 overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={buildMediaUrl(posterPreview)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-center text-[10px] text-white">
                      From linked gig
                    </span>
                  </div>
                ) : null}
                <ImageUploadField
                  preset="ticketEventPoster"
                  value={draft.posterFileUploadId}
                  onChange={(id) => update("posterFileUploadId", id)}
                  aspect="portrait"
                  disabled={isSaving}
                  helperText={
                    draft.posterFileUploadId
                      ? "This event's own poster. Remove it to fall back to the linked gig's."
                      : gigPosterId
                        ? "Using the linked gig's poster. Upload one to override it."
                        : "Portrait, ideally 3:4. Link a gig with a poster, or upload one here."
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wallet pass</CardTitle>
              <CardDescription>Apple and Google Wallet styling</CardDescription>
            </CardHeader>
            <CardContent>
              <PassThemeField
                value={draft.passTheme}
                onChange={(passTheme) => update("passTheme", passTheme)}
                eventName={draft.name}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 xl:col-span-4">
          <PublishChecklist
            items={checklist}
            status={event?.status ?? null}
            publishing={setStatus.isPending}
            onPublish={
              event
                ? () => setStatus.mutate({ id: event.id, status: "PUBLISHED" })
                : undefined
            }
            onOpenTab={onOpenTab}
          />

          <Card>
            <CardHeader>
              <CardTitle>Date &amp; time</CardTitle>
              <CardDescription>
                Entered in your browser&apos;s time zone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                id="event-start"
                label="Starts"
                error={errors.startsAt}
                required
              >
                <DateTimePicker
                  date={draft.startsAt}
                  onDateChange={(value) => update("startsAt", value)}
                  placeholder="Select start time"
                />
              </Field>
              <Field id="event-doors" label="Doors open" error={errors.doorsAt}>
                <DateTimePicker
                  date={draft.doorsAt}
                  onDateChange={(value) => update("doorsAt", value)}
                  placeholder="Not set"
                  clearable
                />
                {draft.startsAt ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDoorsBefore(30)}
                    >
                      30 min before start
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDoorsBefore(60)}
                    >
                      1 hr before
                    </Button>
                  </div>
                ) : null}
              </Field>
              <Field id="event-end" label="Ends" error={errors.endsAt}>
                <DateTimePicker
                  date={draft.endsAt}
                  onDateChange={(value) => update("endsAt", value)}
                  placeholder="No end time"
                  clearable
                />
              </Field>
              <Field
                id="event-tz"
                label="Event time zone"
                hint="What the public page, tickets and door list show times in."
              >
                <SearchableSelect
                  id="event-tz"
                  value={draft.timezone}
                  onChange={(zone) =>
                    update("timezone", zone ?? "Pacific/Auckland")
                  }
                  options={TIME_ZONES}
                  searchPlaceholder="Search zones, e.g. Auckland…"
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Venue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="event-venue" label="Name">
                <Input
                  id="event-venue"
                  value={draft.venueName}
                  onChange={(e) => update("venueName", e.target.value)}
                />
              </Field>
              <Field id="event-address" label="Address">
                <Input
                  id="event-address"
                  value={draft.venueAddress}
                  onChange={(e) => update("venueAddress", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="event-sales-open" label="Sales open">
                <DateTimePicker
                  date={draft.salesOpenAt}
                  onDateChange={(value) => update("salesOpenAt", value)}
                  placeholder="As soon as published"
                  clearable
                />
              </Field>
              <Field
                id="event-sales-close"
                label="Sales close"
                error={errors.salesCloseAt}
              >
                <DateTimePicker
                  date={draft.salesCloseAt}
                  onDateChange={(value) => update("salesCloseAt", value)}
                  placeholder="Sells until doors"
                  clearable
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="event-capacity"
                  label="Capacity"
                  error={errors.capacity}
                >
                  <Input
                    id="event-capacity"
                    type="number"
                    min={1}
                    placeholder="No cap"
                    value={draft.capacity}
                    onChange={(e) => update("capacity", e.target.value)}
                    aria-invalid={Boolean(errors.capacity)}
                  />
                </Field>
                <Field
                  id="event-maxper"
                  label="Max per order"
                  error={errors.maxPerOrder}
                >
                  <Input
                    id="event-maxper"
                    type="number"
                    min={1}
                    max={50}
                    value={draft.maxPerOrder}
                    onChange={(e) => update("maxPerOrder", e.target.value)}
                    aria-invalid={Boolean(errors.maxPerOrder)}
                  />
                </Field>
              </div>
              <p className="text-muted-foreground -mt-2 text-xs">
                Capacity is the room: the tiers can&apos;t allocate more, and
                comps come off it too. Max per order counts people, so a group
                of four uses four.
              </p>
              <Field
                id="event-comps"
                label="Comp allowance"
                hint="How many you plan to give away. Going over only warns."
                error={errors.compAllowance}
              >
                <Input
                  id="event-comps"
                  type="number"
                  min={0}
                  value={draft.compAllowance}
                  onChange={(e) => update("compAllowance", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visibility &amp; door</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {VISIBILITIES.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      draft.visibility === option.value ? "border-primary" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      className="mt-1 size-4"
                      checked={draft.visibility === option.value}
                      onChange={() => update("visibility", option.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <Toggle
                label="R18"
                description="Flags the ticket, the checkout and the scanner."
                checked={draft.isR18}
                onChange={(value) => update("isR18", value)}
              />
              <Toggle
                label="Allow re-entry"
                description="A second scan reads as a calm re-entry, not a warning."
                checked={draft.reentryAllowed}
                onChange={(value) => update("reentryAllowed", value)}
              />
              <Toggle
                label="Ask for attendee names"
                description="Asked after payment, and shown on the door list."
                checked={draft.requireNames}
                onChange={(value) => update("requireNames", value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking fee</CardTitle>
              <CardDescription>
                {fee
                  ? `Leave both blank for the site default, ${formatNZD(fee.fixedCents)} + ${fee.percentBp / 100}%.`
                  : "Leave both blank for the site default."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field
                id="event-fee-fixed"
                label="Fixed, per ticket"
                error={errors.feeFixed}
              >
                <Input
                  id="event-fee-fixed"
                  inputMode="decimal"
                  placeholder={fee ? (fee.fixedCents / 100).toFixed(2) : "0.00"}
                  value={draft.feeFixed}
                  onChange={(e) => update("feeFixed", e.target.value)}
                />
              </Field>
              <Field
                id="event-fee-percent"
                label="Percent of subtotal"
                error={errors.feePercent}
              >
                <Input
                  id="event-fee-percent"
                  inputMode="decimal"
                  placeholder={fee ? (fee.percentBp / 100).toString() : "0"}
                  value={draft.feePercent}
                  onChange={(e) => update("feePercent", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          {event ? (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle>Danger zone</CardTitle>
                <CardDescription>
                  Only possible before any ticket has been issued. After that,
                  cancel or archive the event from the status menu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  disabled={deleteEvent.isPending || isSaving}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete ${event.name}?`,
                      description:
                        "Its tiers and any abandoned checkouts go with it. This cannot be undone.",
                      confirmLabel: "Delete event",
                      variant: "destructive",
                    });
                    if (ok) deleteEvent.mutate({ id: event.id });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete event
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * What stands between this event and going on sale.
 *
 * `needed` items block Publish; `advice` items are worth a look but never stop
 * anything. Reads the draft for what is typed here and the stored event for
 * tiers and staff, which are edited on their own tabs.
 */
function buildChecklist({
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
  });

  items.push(
    draft.posterFileUploadId
      ? { label: "Poster", state: "ok" }
      : gigPosterId
        ? { label: "Poster", detail: "From the linked gig", state: "ok" }
        : {
            label: "Poster",
            detail: "Optional, but the event page is bare without one.",
            state: "advice",
          },
  );

  const capacity = parseCount(draft.capacity);
  if (event) {
    const onSale = event.tiers.filter(
      (tier) => tier.isActive && tier.allocation > 0,
    );
    items.push({
      label: "At least one tier on sale",
      detail:
        onSale.length > 0
          ? `${onSale.length} of ${event.tiers.length} on sale`
          : "Add a tier, or switch one on.",
      state: onSale.length > 0 ? "ok" : "needed",
      tab: "tiers",
    });
    if (capacity !== null) {
      const budget = toAllocationBudget({
        capacity,
        allocated: event.budget.allocated,
        comps: event.budget.comps,
      });
      items.push(roomItem(budget.overAllocatedBy, budget.unallocated ?? 0));
    }
    items.push(
      event.staff.length > 0
        ? {
            label: "Door staff assigned",
            detail: `${event.staff.length} on the door`,
            state: "ok",
            tab: "staff",
          }
        : {
            label: "Door staff assigned",
            detail: "Optional. Only admins can scan until someone is.",
            state: "advice",
            tab: "staff",
          },
    );
    items.push({
      label: "Changes saved",
      state: isDirty ? "needed" : "ok",
    });
  } else {
    // Allocations are already in tickets, group tiers included.
    const tickets = starterAllocation(draft.starterTiers);
    items.push({
      label: "At least one tier",
      detail:
        draft.starterTiers.length > 0
          ? `${draft.starterTiers.length} ready to add`
          : "Add one below, or later on the Tiers tab.",
      state: draft.starterTiers.length > 0 ? "ok" : "needed",
    });
    if (capacity !== null) {
      items.push(
        roomItem(
          Math.max(0, tickets - capacity),
          Math.max(0, capacity - tickets),
        ),
      );
    }
  }

  return items;
}

/** Whether the tiers add up to the room. */
function roomItem(over: number, unallocated: number): ChecklistItem {
  if (over > 0) {
    return {
      label: "Tiers fit the room",
      detail: `The tiers allocate ${over} more than the cap. Trim one.`,
      state: "needed",
      tab: "tiers",
    };
  }
  if (unallocated > 0) {
    return {
      label: "Tiers fit the room",
      detail: `${unallocated} seats aren't in any tier, so they can't be sold.`,
      state: "advice",
      tab: "tiers",
    };
  }
  return { label: "Tiers fit the room", state: "ok", tab: "tiers" };
}

function StarterTierRow({
  tier,
  previousName,
  onChange,
  onRemove,
}: {
  tier: StarterTier;
  /** The row above, which this one can wait for. Null on the first row. */
  previousName: string | null;
  onChange: (next: StarterTier) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof StarterTier>(key: K, value: StarterTier[K]) =>
    onChange({ ...tier, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border p-2 md:grid-cols-[1.6fr_0.8fr_0.8fr_0.6fr_auto] md:border-0 md:p-0">
      <Input
        aria-label="Tier name"
        value={tier.name}
        onChange={(e) => set("name", e.target.value)}
        className="col-span-2 md:col-span-1"
      />
      <Input
        aria-label="Price"
        inputMode="decimal"
        placeholder="0.00"
        value={tier.price}
        onChange={(e) => set("price", e.target.value)}
      />
      <Input
        aria-label="Allocation, in tickets"
        type="number"
        min={1}
        value={tier.allocation}
        onChange={(e) => set("allocation", e.target.value)}
      />
      <Input
        aria-label="Tickets per purchase"
        type="number"
        min={1}
        max={20}
        value={tier.groupSize}
        onChange={(e) => set("groupSize", e.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove ${tier.name || "tier"}`}
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
      {previousName !== null ? (
        <label className="text-muted-foreground col-span-full flex items-center gap-2 px-1 text-xs">
          <Switch
            checked={tier.releaseAfterPrevious}
            onCheckedChange={(value) => set("releaseAfterPrevious", value)}
          />
          Release after {previousName || "the tier above"} sells out
        </label>
      ) : null}
      {tier.requiresApproval ? (
        <p className="text-muted-foreground col-span-full px-1 text-xs">
          Each request is approved by hand before a ticket is issued.
        </p>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
