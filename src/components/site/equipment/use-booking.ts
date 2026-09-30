"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  startOfDay,
} from "date-fns";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";

export type Mode = "PACKAGE" | "ITEMS";
export type GearItem =
  RouterOutputs["rentals"]["getPublicInventoryItems"][number];
export type Rental = RouterOutputs["rentals"]["getPublicRentals"][number];
/** One gear line: an item and how many. Packages and item picks both reduce to these. */
export type Line = {
  item: Pick<
    GearItem,
    "id" | "name" | "shortName" | "description" | "note" | "price"
  >;
  quantity: number;
};

/** Calendar day key, local time, matching how the old booking flow keyed rentals. */
export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");
/** "Fri 9 Oct" */
export const formatDay = (d: Date) => format(d, "EEE d MMM");
export const formatRange = (from: Date, to: Date) =>
  dayKey(from) === dayKey(to)
    ? formatDay(from)
    : `${formatDay(from)} – ${formatDay(to)}`;

export const separately = (lines: readonly Line[]) =>
  lines.reduce((sum, l) => sum + l.quantity * l.item.price, 0);

export const successCopy = (mode: Mode) =>
  mode === "PACKAGE"
    ? "Package request submitted! Our team will review it shortly."
    : "Item request submitted! Our team will review it shortly.";

/**
 * The rental request flow: one mode per request (switching clears the other),
 * a date range checked live against approved rentals via the quote query,
 * promoter and private contact, then `rentals.createRentalRequest`.
 */
export function useBooking() {
  const packagesQuery = api.rentals.getPublicPackages.useQuery();
  const inventoryQuery = api.rentals.getPublicInventoryItems.useQuery();
  const rentalsQuery = api.rentals.getPublicRentals.useQuery();

  const [mode, setModeState] = useState<Mode>("PACKAGE");
  const [packageId, setPackageId] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [range, setRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });
  const [focusDay, setFocusDay] = useState<Date | null>(null);
  const [promoter, setPromoter] = useState("");
  const [contact, setContact] = useState("");
  const [submittedMode, setSubmittedMode] = useState<Mode | null>(null);

  const today = startOfDay(new Date());
  const packages = packagesQuery.data ?? [];
  const inventory = inventoryQuery.data ?? [];
  const pkg = packages.find((p) => p.id === packageId) ?? null;

  const lines: Line[] =
    mode === "PACKAGE"
      ? (pkg?.items.map((i) => ({ item: i.gearItem, quantity: i.quantity })) ??
        [])
      : inventory.flatMap((item) =>
          (qty[item.id] ?? 0) > 0
            ? [{ item, quantity: qty[item.id] ?? 0 }]
            : [],
        );
  const selectedItems = lines.map((l) => ({
    gearItemId: l.item.id,
    quantity: l.quantity,
  }));
  const hasGear = lines.length > 0;
  const hasDates = !!range.from && !!range.to;

  // Items mode quotes with no picks too, so stock left for the dates shows before adding.
  const startDate = range.from ?? today;
  const quote = api.rentals.quoteRentalSelection.useQuery(
    {
      mode,
      packageId: mode === "PACKAGE" ? (packageId ?? undefined) : undefined,
      items: mode === "ITEMS" ? selectedItems : [],
      startDate,
      endDate: range.to ?? startDate,
    },
    {
      enabled: mode === "PACKAGE" ? !!packageId : hasGear || !!range.from,
      placeholderData: (prev) => prev,
    },
  );
  const fresh = quote.data && !quote.isPlaceholderData ? quote.data : null;

  const rentalsByDay = useMemo(() => {
    const map = new Map<string, Rental[]>();
    for (const rental of rentalsQuery.data ?? []) {
      const start = startOfDay(new Date(rental.startDate));
      const end = startOfDay(new Date(rental.endDate));
      if (end < start) continue;
      for (const d of eachDayOfInterval({ start, end })) {
        const key = dayKey(d);
        map.set(key, [...(map.get(key) ?? []), rental]);
      }
    }
    return map;
  }, [rentalsQuery.data]);

  const clashDates =
    hasGear && range.from && fresh ? fresh.conflictingDates : [];
  const limiting = hasGear && range.from && fresh ? fresh.limitingItems : [];
  const days =
    range.from && range.to
      ? differenceInCalendarDays(range.to, range.from) + 1
      : 0;
  const itemsDaily = separately(lines);
  const daily = hasGear
    ? (quote.data?.discountedDailyPrice ??
      (mode === "PACKAGE" ? (pkg?.price ?? 0) : itemsDaily))
    : 0;
  const ready = hasGear && hasDates && fresh?.available === true;

  const missing = [
    !hasGear && (mode === "PACKAGE" ? "pick a package" : "add items"),
    !hasDates && "choose dates",
    !promoter.trim() && "add a promoter",
    !contact.trim() && "add contact info",
  ].filter((m) => m !== false);

  const createRental = api.rentals.createRentalRequest.useMutation({
    onSuccess: (_data, input) => {
      setSubmittedMode(input.mode);
      setPackageId(null);
      setQty({});
      setRange({ from: null, to: null });
      setFocusDay(null);
      setPromoter("");
      setContact("");
      toast.success("Rental request sent");
    },
    onError: (err) => toast.error(err.message),
  });

  const remaining = (item: GearItem) =>
    range.from
      ? (quote.data?.availabilityByItem[item.id]?.remainingQuantity ??
        item.quantity)
      : item.quantity;

  return {
    loading: packagesQuery.isPending || inventoryQuery.isPending,
    error: packagesQuery.error ?? inventoryQuery.error,
    retry: () => {
      void packagesQuery.refetch();
      void inventoryQuery.refetch();
    },
    today,
    packages,
    inventory,
    mode,
    pkg,
    qty,
    lines,
    range,
    focusDay,
    promoter,
    contact,
    hasGear,
    hasDates,
    days,
    daily,
    itemsDaily,
    savings:
      mode === "PACKAGE" && pkg ? Math.max(itemsDaily - pkg.price, 0) : 0,
    discount:
      mode === "ITEMS" && hasGear
        ? (quote.data?.appliedDiscount ?? null)
        : null,
    discountDaily: quote.data?.discountDailyAmount ?? 0,
    itemPricing: (id: string) =>
      mode === "ITEMS"
        ? quote.data?.itemPricing.find((r) => r.gearItemId === id)
        : undefined,
    total: hasDates && fresh ? fresh.estimatedTotalPrice : daily * days,
    checking: hasGear && hasDates && !fresh,
    clashDates,
    limiting,
    ready,
    missing,
    remaining,
    bookedOn: (d: Date) => rentalsByDay.get(dayKey(d)) ?? [],
    submitting: createRental.isPending,
    submitError: createRental.error?.message ?? null,
    canSubmit: ready && missing.length === 0 && !createRental.isPending,
    submittedMode,
    setPromoter,
    setContact,
    /** Switching mode clears the other mode's picks, as on the old page. */
    setMode: (m: Mode) => {
      setModeState(m);
      if (m === "PACKAGE") setQty({});
      else setPackageId(null);
    },
    togglePackage: (id: string) =>
      setPackageId((cur) => (cur === id ? null : id)),
    adjust: (item: GearItem, delta: number) =>
      setQty((q) => ({
        ...q,
        [item.id]: Math.max(
          0,
          Math.min((q[item.id] ?? 0) + delta, remaining(item)),
        ),
      })),
    /** First click starts a range, second ends it (or restarts if earlier). */
    pickDay: (d: Date) => {
      if (d < today) return;
      setFocusDay(rentalsByDay.has(dayKey(d)) ? d : null);
      setRange((r) =>
        !r.from || r.to || d < r.from
          ? { from: d, to: null }
          : { from: r.from, to: d },
      );
    },
    clearDates: () => {
      setRange({ from: null, to: null });
      setFocusDay(null);
    },
    submit: (e?: FormEvent) => {
      e?.preventDefault();
      if (
        !ready ||
        missing.length ||
        createRental.isPending ||
        !range.from ||
        !range.to
      )
        return;
      createRental.mutate({
        mode,
        packageId: mode === "PACKAGE" ? (packageId ?? undefined) : undefined,
        items: mode === "ITEMS" ? selectedItems : [],
        userName: promoter.trim(),
        contactInfo: contact.trim(),
        startDate: range.from,
        endDate: range.to,
      });
    },
    startAgain: () => {
      setSubmittedMode(null);
      createRental.reset();
    },
  };
}
export type Booking = ReturnType<typeof useBooking>;
