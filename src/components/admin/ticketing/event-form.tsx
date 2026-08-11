"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

const VISIBILITIES = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Listed on /events and on its gig page.",
  },
  {
    value: "UNLISTED",
    label: "Unlisted",
    description:
      "Listed nowhere, but the URL works for anyone who ends up with it.",
  },
  {
    value: "PRIVATE",
    label: "Private — invite link only",
    description:
      "Listed nowhere, and the page only opens with the key on the link. Save, then copy the link from the event's overview.",
  },
] as const satisfies readonly {
  value: Visibility;
  label: string;
  description: string;
}[];
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { PickerSelect } from "~/components/ui/picker-select";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];

/**
 * Create and edit a ticketed event.
 *
 * Note that times are entered in the browser's local zone and stored as UTC.
 * The event's own `timezone` is what every public page and the door list
 * render in, so an admin sitting in another country still sets a door time
 * that means what the venue thinks it means.
 */
export function EventForm({ event }: { event?: AdminEvent }) {
  const router = useRouter();
  const utils = api.useUtils();

  const [name, setName] = useState(event?.name ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [gigId, setGigId] = useState<string | null>(event?.gigId ?? null);
  const [shortDescription, setShortDescription] = useState(
    event?.shortDescription ?? "",
  );
  const [venueName, setVenueName] = useState(event?.venueName ?? "");
  const [venueAddress, setVenueAddress] = useState(event?.venueAddress ?? "");
  const [startsAt, setStartsAt] = useState<Date | undefined>(event?.startsAt);
  const [doorsAt, setDoorsAt] = useState<Date | undefined>(
    event?.doorsAt ?? undefined,
  );
  const [endsAt, setEndsAt] = useState<Date | undefined>(
    event?.endsAt ?? undefined,
  );
  const [salesOpenAt, setSalesOpenAt] = useState<Date | undefined>(
    event?.salesOpenAt ?? undefined,
  );
  const [salesCloseAt, setSalesCloseAt] = useState<Date | undefined>(
    event?.salesCloseAt ?? undefined,
  );
  const [capacity, setCapacity] = useState(event?.capacity?.toString() ?? "");
  const [compAllowance, setCompAllowance] = useState(
    event?.compAllowance?.toString() ?? "",
  );
  const [maxPerOrder, setMaxPerOrder] = useState(
    (event?.maxTicketsPerOrder ?? 10).toString(),
  );
  const [visibility, setVisibility] = useState<Visibility>(
    (event?.visibility as Visibility | undefined) ?? "PUBLIC",
  );
  const [isR18, setIsR18] = useState(event?.isR18 ?? true);
  const [reentryAllowed, setReentryAllowed] = useState(
    event?.reentryAllowed ?? false,
  );
  const [requireNames, setRequireNames] = useState(
    event?.requireAttendeeNames ?? true,
  );
  const [feeFixed, setFeeFixed] = useState(
    event?.bookingFeeFixedCents != null
      ? (event.bookingFeeFixedCents / 100).toFixed(2)
      : "",
  );
  const [feePercent, setFeePercent] = useState(
    event?.bookingFeePercentBp != null
      ? (event.bookingFeePercentBp / 100).toString()
      : "",
  );

  const create = api.ticketEvents.create.useMutation({
    onSuccess: (created) => {
      toast.success("Event created — add your tiers next.");
      router.push(`/admin/events/${created.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const update = api.ticketEvents.update.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      void utils.ticketEvents.byId.invalidate();
      void utils.ticketEvents.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pending = create.isPending || update.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt) {
      toast.error("Set a start time.");
      return;
    }

    const payload = {
      name,
      slug: slug || undefined,
      gigId,
      shortDescription: shortDescription || null,
      venueName: venueName || null,
      venueAddress: venueAddress || null,
      timezone: event?.timezone ?? "Pacific/Auckland",
      startsAt,
      doorsAt: doorsAt ?? null,
      endsAt: endsAt ?? null,
      salesOpenAt: salesOpenAt ?? null,
      salesCloseAt: salesCloseAt ?? null,
      capacity: capacity ? Number.parseInt(capacity, 10) : null,
      compAllowance: compAllowance ? Number.parseInt(compAllowance, 10) : null,
      maxTicketsPerOrder: Number.parseInt(maxPerOrder, 10) || 10,
      visibility,
      isR18,
      reentryAllowed,
      requireAttendeeNames: requireNames,
      bookingFeeFixedCents: feeFixed
        ? (parsePriceToCents(feeFixed) ?? 0)
        : null,
      bookingFeePercentBp: feePercent
        ? Math.round(Number.parseFloat(feePercent) * 100)
        : null,
    };

    if (event) {
      update.mutate({ id: event.id, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-8">
      <Fieldset legend="Basics">
        <Field label="Event name" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field
          label="URL slug"
          htmlFor="slug"
          hint={slug ? `/events/${slug}` : "Generated from the name"}
        >
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto"
          />
        </Field>

        <Field
          label="Linked gig"
          htmlFor="gig"
          hint="The gig page shows the buy panel when one is linked."
        >
          <PickerSelect
            id="gig"
            endpoint={api.pickers.gigs}
            value={gigId}
            onChange={setGigId}
            placeholder="No gig"
            searchPlaceholder="Search gigs by title…"
            emptyText="No gigs match that."
            clearLabel="No gig"
          />
        </Field>

        <Field label="Short description" htmlFor="short">
          <Textarea
            id="short"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            rows={2}
            maxLength={300}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="When and where">
        <Field label="Doors open">
          <DateTimePicker date={doorsAt} onDateChange={setDoorsAt} />
        </Field>
        <Field label="Starts" hint="Required.">
          <DateTimePicker date={startsAt} onDateChange={setStartsAt} />
        </Field>
        <Field label="Ends">
          <DateTimePicker date={endsAt} onDateChange={setEndsAt} />
        </Field>
        <Field label="Venue" htmlFor="venue">
          <Input
            id="venue"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
        </Field>
        <Field label="Address" htmlFor="address">
          <Input
            id="address"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Sales">
        <Field
          label="Sales open"
          hint="Leave blank to open as soon as published."
        >
          <DateTimePicker date={salesOpenAt} onDateChange={setSalesOpenAt} />
        </Field>
        <Field label="Sales close" hint="Leave blank to sell until doors.">
          <DateTimePicker date={salesCloseAt} onDateChange={setSalesCloseAt} />
        </Field>
        <Field
          label="Overall capacity"
          htmlFor="capacity"
          hint="Caps total tickets across every tier, comps included. Blank means the tier allocations decide."
        >
          <Input
            id="capacity"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <Field
          label="Comp allowance"
          htmlFor="comp-allowance"
          hint="How many tickets you plan to give away. A target, not a limit — going over only warns."
        >
          <Input
            id="comp-allowance"
            type="number"
            min={0}
            value={compAllowance}
            onChange={(e) => setCompAllowance(e.target.value)}
          />
        </Field>
        <Field label="Max tickets per order" htmlFor="maxper">
          <Input
            id="maxper"
            type="number"
            min={1}
            max={50}
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(e.target.value)}
          />
        </Field>
      </Fieldset>

      <Fieldset
        legend="Booking fee"
        description={
          event
            ? `Site default is ${formatNZD(event.siteDefaults.bookingFee.fixedCents)} + ${event.siteDefaults.bookingFee.percentBp / 100}%. Leave both blank to use it.`
            : "Leave blank to use the site default."
        }
      >
        <Field label="Fixed, per ticket" htmlFor="feefixed">
          <Input
            id="feefixed"
            inputMode="decimal"
            placeholder="0.00"
            value={feeFixed}
            onChange={(e) => setFeeFixed(e.target.value)}
          />
        </Field>
        <Field label="Percentage of subtotal" htmlFor="feepercent">
          <Input
            id="feepercent"
            inputMode="decimal"
            placeholder="0"
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Who can find it">
        <div className="space-y-2 md:col-span-2">
          {VISIBILITIES.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
            >
              <input
                type="radio"
                name="visibility"
                className="mt-1 size-4"
                checked={visibility === option.value}
                onChange={() => setVisibility(option.value)}
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="text-muted-foreground block text-sm">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend="Door">
        <Toggle
          label="R18"
          description="Flags the ticket, the checkout and the scanner. On by default."
          checked={isR18}
          onChange={setIsR18}
        />
        <Toggle
          label="Allow re-entry"
          description="A second scan reads as a calm re-entry instead of a warning."
          checked={reentryAllowed}
          onChange={setReentryAllowed}
        />
        <Toggle
          label="Ask for attendee names"
          description="Prompts the buyer after payment, and shows names on the door list."
          checked={requireNames}
          onChange={setRequireNames}
        />
      </Fieldset>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : event ? (
          "Save changes"
        ) : (
          "Create event"
        )}
      </Button>
    </form>
  );
}

function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4 rounded-lg border p-5">
      <legend className="px-2 text-sm font-semibold tracking-wide uppercase">
        {legend}
      </legend>
      {description && (
        <p className="text-muted-foreground -mt-2 text-sm">{description}</p>
      )}
      {children}
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
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
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
