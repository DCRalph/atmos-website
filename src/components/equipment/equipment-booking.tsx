"use client";

import { useMemo, useState } from "react";
import { format, isSameDay, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CalendarIcon,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Calendar, CalendarDayButton } from "~/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PackageItemBadge } from "~/components/rentals/package-item-badge";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

const DISCOUNT_TYPE = {
  FIXED_AMOUNT: "FIXED_AMOUNT",
  PERCENTAGE: "PERCENTAGE",
} as const;

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

type BookingMode = "PACKAGE" | "ITEMS";

export function EquipmentBooking() {
  const [mode, setMode] = useState<BookingMode>("PACKAGE");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedItemQuantities, setSelectedItemQuantities] = useState<Record<string, number>>(
    {},
  );
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [userName, setUserName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const { data: packages, isLoading: packagesLoading } =
    api.rentals.getPublicPackages.useQuery();
  const { data: inventory, isLoading: inventoryLoading } =
    api.rentals.getPublicInventoryItems.useQuery();
  const { data: rentals } = api.rentals.getPublicRentals.useQuery();

  const selectedItems = useMemo(
    () =>
      Object.entries(selectedItemQuantities)
        .map(([gearItemId, quantity]) => ({ gearItemId, quantity }))
        .filter((item) => item.quantity > 0),
    [selectedItemQuantities],
  );

  const hasDateRange = !!dateRange.from && !!dateRange.to;
  const quoteEnabled = mode === "PACKAGE" ? !!selectedPackageId : selectedItems.length > 0;
  const previewStartDate = dateRange.from ?? startOfDay(new Date());
  const previewEndDate = dateRange.to ?? startOfDay(new Date());

  const { data: quote } = api.rentals.quoteRentalSelection.useQuery(
    {
      mode,
      packageId: mode === "PACKAGE" ? (selectedPackageId ?? undefined) : undefined,
      items: mode === "ITEMS" ? selectedItems : [],
      startDate: previewStartDate,
      endDate: previewEndDate,
    },
    { enabled: quoteEnabled },
  );

  const selectedPackage =
    packages?.find((gearPackage) => gearPackage.id === selectedPackageId) ?? null;

  const itemPricingById = useMemo(
    () =>
      new Map(
        (quote?.itemPricing ?? []).map((row) => [row.gearItemId, row]),
      ),
    [quote?.itemPricing],
  );

  const createRental = api.rentals.createRentalRequest.useMutation({
    onSuccess: () => {
      setMessage({
        type: "success",
        text:
          mode === "PACKAGE"
            ? "Package request submitted! Our team will review it shortly."
            : "Item request submitted! Our team will review it shortly.",
      });
      setUserName("");
      setContactInfo("");
      setDateRange({ from: undefined, to: undefined });
      setSelectedPackageId(null);
      setSelectedItemQuantities({});
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const rentalsByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof rentals>[number][]>();
    for (const rental of rentals ?? []) {
      const start = startOfDay(new Date(rental.startDate));
      const end = startOfDay(new Date(rental.endDate));
      const current = new Date(start);
      while (current <= end) {
        const key = format(current, "yyyy-MM-dd");
        const existing = map.get(key) ?? [];
        existing.push(rental);
        map.set(key, existing);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [rentals]);

  const [focusedBookings, setFocusedBookings] = useState<{
    date: Date;
    rentals: NonNullable<typeof rentals>[number][];
  } | null>(null);

  const getRentalsForDate = (date: Date) =>
    rentalsByDate.get(format(date, "yyyy-MM-dd")) ?? [];

  const conflictDateSet = new Set(quote?.conflictingDates ?? []);
  const isDateUnavailable = (date: Date) =>
    conflictDateSet.has(format(startOfDay(date), "yyyy-MM-dd"));

  const modifiers = useMemo(
    () => ({
      booked: (date: Date) => getRentalsForDate(date).length > 0,
      unavailable: (date: Date) => quoteEnabled && isDateUnavailable(date),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quoteEnabled, quote?.conflictingDates, rentals],
  );

  const handleDayClick = (date: Date) => {
    const dayRentals = getRentalsForDate(date);
    if (dayRentals.length > 0) {
      setFocusedBookings((prev) =>
        prev && isSameDay(prev.date, date) ? null : { date, rentals: dayRentals },
      );
    } else {
      setFocusedBookings(null);
    }
  };

  const today = startOfDay(new Date());
  const numDays = quote?.numDays ?? 0;
  const isFormValid =
    hasDateRange &&
    !!userName.trim() &&
    !!contactInfo.trim() &&
    quote?.available === true;

  const adjustItemQuantity = (gearItemId: string, delta: number) => {
    setSelectedItemQuantities((current) => {
      const currentQty = current[gearItemId] ?? 0;
      const maxQty = hasDateRange
        ? (quote?.availabilityByItem?.[gearItemId]?.remainingQuantity ??
          inventory?.find((item) => item.id === gearItemId)?.quantity ??
          0)
        : (inventory?.find((item) => item.id === gearItemId)?.quantity ?? 0);
      const nextQty = Math.max(0, Math.min(currentQty + delta, maxQty));
      return { ...current, [gearItemId]: nextQty };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange.from || !dateRange.to || !userName.trim() || !contactInfo.trim()) return;

    if (mode === "PACKAGE") {
      if (!selectedPackageId || quote?.available !== true) return;
      createRental.mutate({
        mode: "PACKAGE",
        packageId: selectedPackageId,
        items: [],
        userName,
        contactInfo,
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      return;
    }

    if (selectedItems.length === 0 || quote?.available !== true) return;
    createRental.mutate({
      mode: "ITEMS",
      items: selectedItems,
      userName,
      contactInfo,
      startDate: dateRange.from,
      endDate: dateRange.to,
    });
  };

  const totalSelectedCount = selectedItems.reduce((sum, i) => sum + i.quantity, 0);
  const getPackageIndividualDailyPrice = (gearPackage: NonNullable<typeof selectedPackage>) =>
    gearPackage.items.reduce(
      (sum, item) => sum + item.quantity * item.gearItem.price,
      0,
    );
  const selectedPackageIndividualDailyPrice = selectedPackage
    ? getPackageIndividualDailyPrice(selectedPackage)
    : 0;
  const selectedPackageDailySavings = selectedPackage
    ? Math.max(selectedPackageIndividualDailyPrice - selectedPackage.price, 0)
    : 0;

  return (
    <div className="grid gap-8 xl:grid-cols-12">
      <div className="space-y-8 xl:col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Choose Booking Mode</CardTitle>
            <CardDescription>
              Choose either a package or individual items. You can only submit one mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={mode} onValueChange={(value) => setMode(value as BookingMode)}>
              <TabsList>
                <TabsTrigger
                  value="PACKAGE"
                  onClick={() => setSelectedItemQuantities({})}
                >
                  Package
                </TabsTrigger>
                <TabsTrigger
                  value="ITEMS"
                  onClick={() => setSelectedPackageId(null)}
                >
                  Individual Items
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "PACKAGE" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {packagesLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
                    ))
                  : packages?.map((gearPackage) => {
                      const isSelected = selectedPackageId === gearPackage.id;
                      const individualDailyPrice = getPackageIndividualDailyPrice(gearPackage);
                      const packageDailySavings = Math.max(
                        individualDailyPrice - gearPackage.price,
                        0,
                      );
                      return (
                        <div
                          key={gearPackage.id}
                          onClick={() =>
                            setSelectedPackageId((current) =>
                              current === gearPackage.id ? null : gearPackage.id,
                            )
                          }
                          className={cn(
                            "relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all duration-200 select-none",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-muted hover:border-primary/50 hover:bg-muted/50",
                          )}
                        >
                          <div className="mb-2 flex items-start justify-between gap-4">
                            <div>
                              <h4 className="text-lg font-bold">{gearPackage.name}</h4>
                              {gearPackage.shortName && (
                                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                  {gearPackage.shortName}
                                </p>
                              )}
                            </div>
                            <Badge variant={isSelected ? "default" : "secondary"}>
                              ${gearPackage.price}/day
                            </Badge>
                          </div>
                          <div className="mb-2 space-y-0.5 text-xs text-muted-foreground">
                            <div>
                              Items separately: ${individualDailyPrice.toFixed(2)}/day
                            </div>
                            {packageDailySavings > 0 && (
                              <div className="font-medium text-emerald-600 dark:text-emerald-400">
                                Package savings: ${packageDailySavings.toFixed(2)}/day
                              </div>
                            )}
                          </div>
                          <div className="mt-auto flex flex-wrap gap-2">
                            {gearPackage.items.map((item) => (
                              <PackageItemBadge
                                key={item.id}
                                quantity={item.quantity}
                                itemName={item.gearItem.name}
                                shortName={item.gearItem.shortName}
                                description={item.gearItem.description}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
              </div>
            ) : (
              <div className="space-y-2">
                {inventoryLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  inventory?.map((item) => {
                    const selectedQty = selectedItemQuantities[item.id] ?? 0;
                    const rowPricing = itemPricingById.get(item.id);
                    const remaining =
                      quote?.availabilityByItem?.[item.id]?.remainingQuantity ??
                      item.quantity;
                    const disablePlus = selectedQty >= remaining;
                    const isActive = selectedQty > 0;
                    const hasDiscount =
                      isActive && rowPricing && rowPricing.rowDiscountTotal > 0;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex flex-col gap-3 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:p-4",
                          isActive
                            ? "border-primary/40 bg-primary/5"
                            : "border-muted",
                        )}
                      >
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {item.name}
                            </span>
                            {hasDiscount && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Sparkles className="h-2.5 w-2.5" />
                                SAVE
                              </span>
                            )}
                          </div>
                          {item.shortName && (
                            <p className="text-xs text-muted-foreground">
                              {item.shortName}
                            </p>
                          )}
                        </div>

                        {/* Pricing + stock + controls */}
                        <div className="flex items-center gap-4 sm:gap-6">
                          {/* Price */}
                          <div className="flex flex-col items-end text-right text-sm tabular-nums">
                            {isActive && hasDiscount ? (
                              <>
                                <span className="text-xs text-muted-foreground line-through">
                                  ${rowPricing.originalRowTotal.toFixed(2)}
                                </span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  ${rowPricing.discountedRowTotal.toFixed(2)}
                                  <span className="text-[10px] font-normal opacity-60">
                                    /day
                                  </span>
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                ${item.price.toFixed(2)}
                                <span className="text-[10px] opacity-60">/day</span>
                              </span>
                            )}
                          </div>

                          {/* Stock */}
                          <div className="flex w-10 flex-col items-center text-center">
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                remaining == 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-amber-600 dark:text-amber-400",
                              )}
                            >
                              {remaining}
                            </span>
                            <span className="text-[9px] text-muted-foreground uppercase">
                              avail
                            </span>
                          </div>

                          {/* Quantity controls */}
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => adjustItemQuantity(item.id, -1)}
                              disabled={selectedQty <= 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span
                              className={cn(
                                "min-w-7 text-center text-sm font-semibold tabular-nums",
                                isActive ? "text-primary" : "text-muted-foreground",
                              )}
                            >
                              {selectedQty}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => adjustItemQuantity(item.id, 1)}
                              disabled={disablePlus}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {mode === "ITEMS" && totalSelectedCount > 0 && (
                  <div className="pt-2 text-right text-sm text-muted-foreground">
                    {totalSelectedCount} item{totalSelectedCount !== 1 && "s"} selected
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-6">
              <div className="mb-4 text-center">
                <h3 className="mb-1 text-lg font-bold">2. Choose Your Dates</h3>
                <p className="text-sm text-muted-foreground">
                  {mode === "PACKAGE"
                    ? "Pick a package and dates to validate availability."
                    : "Add items and dates to check stock in realtime."}
                </p>
              </div>

              <div className="relative mx-auto w-full max-w-fit">
                <div className="overflow-auto rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to } as never}
                    onSelect={(range) =>
                      setDateRange(
                        range
                          ? { from: range.from, to: range.to }
                          : { from: undefined, to: undefined },
                      )
                    }
                    onDayClick={handleDayClick}
                    modifiers={modifiers}
                    modifiersClassNames={{
                      booked: "bg-amber-500/5 rounded-md",
                      unavailable: "bg-red-500/10 rounded-md",
                    }}
                    disabled={(date) =>
                      date < today || (hasDateRange && quoteEnabled && isDateUnavailable(date))
                    }
                    numberOfMonths={2}
                    showOutsideDays={false}
                    className="rounded-md"
                    components={{
                      DayButton: (props) => {
                        const dayRentals = getRentalsForDate(props.day.date);
                        const isBooked = dayRentals.length > 0;
                        const isUnavail =
                          hasDateRange && quoteEnabled && isDateUnavailable(props.day.date);
                        return (
                          <CalendarDayButton {...props}>
                            <div className="relative flex flex-col items-center">
                              <span>{props.day.date.getDate()}</span>
                              {isBooked && (
                                <div className="absolute -bottom-1 flex gap-0.5">
                                  <span
                                    className={cn(
                                      "inline-block h-1 w-3 rounded-full",
                                      isUnavail ? "bg-red-500" : "bg-amber-500",
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          </CalendarDayButton>
                        );
                      },
                    }}
                  />
                </div>

                {(dateRange.from ?? dateRange.to) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute -top-2 right-2 z-10 h-7 gap-1 rounded-full border bg-background px-2 text-[10px] uppercase tracking-wider text-muted-foreground shadow-sm hover:text-foreground"
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                  >
                    <X className="h-3 w-3" /> Clear dates
                  </Button>
                )}

                {focusedBookings && (
                  <div className="absolute top-1/2 left-1/2 z-50 mt-3 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        {format(focusedBookings.date, "EEEE, MMMM d, yyyy")}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setFocusedBookings(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {focusedBookings.rentals.map((rental) => (
                        <div
                          key={rental.id}
                          className="rounded-lg border border-muted bg-muted/50 p-2.5 text-xs"
                        >
                          <div className="mb-1 font-bold">{rental.userName}</div>
                          <div className="text-muted-foreground">
                            {rental.gearPackage?.name ?? "Individual item rental"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {hasDateRange && quoteEnabled && quote && !quote.available && (
                <div className="mt-4 flex w-full max-w-md items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      Unavailable due to: {quote.limitingItems.join(", ")}
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      Adjust your selection or date range before submitting.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Sidebar ─── */}
      <div className="xl:col-span-4">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>3. Request Booking</CardTitle>
            <CardDescription>
              Submit your request and ATMOS staff will review it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {message && (
                <div
                  className={cn(
                    "rounded-xl border p-4 text-sm font-medium",
                    message.type === "success"
                      ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
                  )}
                >
                  {message.text}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="userName">Promoter</Label>
                <Input
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Atmos"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactInfo">Private Contact Info</Label>
                <Input
                  id="contactInfo"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Phone number or email"
                  required
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-muted/60 bg-muted/40 p-5">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Booking Summary
                </Label>
                <div className="text-sm">
                  Mode:{" "}
                  <Badge variant="secondary">
                    {mode === "PACKAGE" ? "Package" : "Individual Items"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {mode === "PACKAGE" ? (
                    selectedPackage ? (
                      <>
                        <Badge variant="secondary">{selectedPackage.name}</Badge>
                        {selectedPackage.items.map((item) => (
                          <PackageItemBadge
                            key={item.id}
                            quantity={item.quantity}
                            itemName={item.gearItem.name}
                            shortName={item.gearItem.shortName}
                            description={item.gearItem.description}
                            className="text-[10px]"
                          />
                        ))}
                      </>
                    ) : (
                      <span className="text-sm italic text-destructive/70">
                        No package selected
                      </span>
                    )
                  ) : selectedItems.length > 0 ? (
                    selectedItems.map((item) => {
                      const gearItem = inventory?.find(
                        (inv) => inv.id === item.gearItemId,
                      );
                      return (
                        <PackageItemBadge
                          key={item.gearItemId}
                          quantity={item.quantity}
                          itemName={gearItem?.name ?? "Item"}
                          shortName={gearItem?.shortName}
                          description={gearItem?.description}
                          className="text-[10px]"
                        />
                      );
                    })
                  ) : (
                    <span className="text-sm italic text-destructive/70">
                      No items selected
                    </span>
                  )}
                </div>

                {hasDateRange && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" />
                    {format(dateRange.from!, "MMM d")} &ndash;{" "}
                    {format(dateRange.to!, "MMM d, yyyy")}
                  </div>
                )}

                {quoteEnabled && quote && (
                  <div className="space-y-1.5 border-t border-muted/60 pt-3 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Days</span>
                      <span className="tabular-nums">{numDays || 1}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">${quote.baseDailyPrice}/day</span>
                    </div>
                    {mode === "PACKAGE" && selectedPackage && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Items separately</span>
                          <span className="tabular-nums">
                            ${selectedPackageIndividualDailyPrice.toFixed(2)}/day
                          </span>
                        </div>
                        {selectedPackageDailySavings > 0 && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span>Package savings</span>
                            <span className="tabular-nums">
                              ${selectedPackageDailySavings.toFixed(2)}/day
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {quote.appliedDiscount && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {quote.appliedDiscount.name}
                        </span>
                        <span className="tabular-nums">
                          &minus;
                          {quote.appliedDiscount.discountMode === "PER_ITEM"
                            ? `$${quote.appliedDiscount.discountAmount}`
                            : quote.appliedDiscount.discountType ===
                                DISCOUNT_TYPE.FIXED_AMOUNT
                              ? `$${quote.appliedDiscount.discountAmount}`
                              : `${quote.appliedDiscount.discountValue}%`}
                          /day
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Daily rate</span>
                      <span className="tabular-nums">${quote.discountedDailyPrice}/day</span>
                    </div>
                    <div className="border-t border-muted/60 pt-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-bold">Total</span>
                        <span
                          className={cn(
                            "text-lg font-bold tabular-nums",
                            quote.appliedDiscount
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "",
                          )}
                        >
                          ${quote.estimatedTotalPrice}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-base font-bold"
                disabled={createRental.isPending || !isFormValid}
              >
                {createRental.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Rental Request"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
