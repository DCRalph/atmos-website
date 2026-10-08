"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SerializedEditorState } from "lexical";
import { Copy, Loader2, Wand2 } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
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
import { buildMediaUrl } from "~/lib/media-url";
import { formatNZD } from "~/lib/ticketing/money";
import type { AdminEvent, Visibility } from "./draft";
import type { EventDraftState } from "./use-event-draft";
import { Field, Toggle } from "./fields";

/**
 * Everything about the event itself: what it's called, when and where, how
 * it sells, who can find it, and what the door asks. Tiers, staff and the
 * wallet pass have their own sections.
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
      "Only opens with the key on the link. Copy it from Overview once saved.",
  },
] as const satisfies readonly {
  value: Visibility;
  label: string;
  description: string;
}[];

/** Every IANA zone the browser knows, for the time zone picker. */
const TIME_ZONES = Intl.supportedValuesOf("timeZone").map((zone) => ({
  value: zone,
  label: zone.replaceAll("_", " "),
}));

export function DetailsSection({
  state,
  event,
  gigPosterId,
}: {
  state: EventDraftState;
  event: AdminEvent | undefined;
  /** The linked gig's poster, shown as the fallback when none is uploaded. */
  gigPosterId: string | null;
}) {
  const { draft, update, errors, isSaving } = state;
  const utils = api.useUtils();
  const router = useRouter();
  const [copyingGig, setCopyingGig] = useState(false);

  const duplicate = api.ticketEvents.duplicate.useMutation({
    onSuccess: (copy) => {
      toast.success(`Created "${copy.name}" as a draft`);
      void utils.ticketEvents.list.invalidate();
      router.push(`/admin/events/${copy.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  /** Fill the draft from a gig. Everything stays editable, and discardable. */
  const copyFromGig = useCallback(
    async (gigId: string) => {
      setCopyingGig(true);
      try {
        const gig = await utils.gigs.getForEditor.fetch({ id: gigId });
        if (!gig) throw new Error("Gig not found");
        state.setDraft((current) => ({
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
        toast.success(`Copied the details from "${gig.title}"`);
      } catch {
        toast.error("Couldn't load that gig.");
      } finally {
        setCopyingGig(false);
      }
    },
    [state, utils],
  );

  const setDoorsBefore = (minutes: number) => {
    if (!draft.startsAt) return;
    update("doorsAt", new Date(draft.startsAt.getTime() - minutes * 60_000));
  };

  const fee = event?.siteDefaults.bookingFee;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="flex flex-col gap-6 xl:col-span-7">
        {!event ? (
          <Card className="border-[color:var(--accent-strong)]/40 bg-[color:var(--accent-strong)]/5">
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
                  Links the gig and copies its name, times, venue and
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
                  Copies its settings and tiers into a new draft with no sales.
                  Move the dates before publishing.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
                    onClick={() => draft.gigId && void copyFromGig(draft.gigId)}
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

        <Card>
          <CardHeader>
            <CardTitle>Poster</CardTitle>
            <CardDescription>
              Shown on the event page and the buyer&apos;s tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {!draft.posterFileUploadId && gigPosterId ? (
                <div className="relative aspect-3/4 w-32 shrink-0 overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={buildMediaUrl(gigPosterId)}
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
      </div>

      <div className="flex flex-col gap-6 xl:col-span-5">
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
              Capacity is the room: the tiers can&apos;t allocate more, and the
              comp allowance comes off it too. Max per order counts people, so a
              group of four uses four.
            </p>
            <Field
              id="event-comps"
              label="Comp allowance"
              hint="How many you plan to give away. Kept off sale from the start; going over only warns."
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
      </div>
    </div>
  );
}
