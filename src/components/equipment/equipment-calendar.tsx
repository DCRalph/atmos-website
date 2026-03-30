"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays, format, isSameDay, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CalendarIcon,
  CheckCircle2,
  CircleDot,
  Loader2,
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
import { cn } from "~/lib/utils";

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

export function EquipmentCalendar() {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
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
  const { data: rentals } = api.rentals.getPublicRentals.useQuery();
  type PublicRental = NonNullable<typeof rentals>[number];

  const [focusedBookings, setFocusedBookings] = useState<{
    date: Date;
    rentals: PublicRental[];
  } | null>(null);

  const createRental = api.rentals.createRentalRequest.useMutation({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: "Package request submitted! Admin will review it.",
      });
      setUserName("");
      setContactInfo("");
      setDateRange({ from: undefined, to: undefined });
      setSelectedPackageId(null);
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const selectedPackage =
    packages?.find((gearPackage) => gearPackage.id === selectedPackageId) ?? null;

  const rentalsByDate = useMemo(() => {
    const map = new Map<string, PublicRental[]>();

    for (const rental of rentals ?? []) {
      const start = startOfDay(new Date(rental.startDate));
      const end = startOfDay(new Date(rental.endDate));
      const days = differenceInCalendarDays(end, start);

      for (let i = 0; i <= days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = format(d, "yyyy-MM-dd");
        const existing = map.get(key) ?? [];
        existing.push(rental);
        map.set(key, existing);
      }
    }

    return map;
  }, [rentals]);

  const usageByDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    for (const rental of rentals ?? []) {
      const start = startOfDay(new Date(rental.startDate));
      const end = startOfDay(new Date(rental.endDate));
      const days = differenceInCalendarDays(end, start);

      for (let i = 0; i <= days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = format(d, "yyyy-MM-dd");
        const dayUsage = map.get(key) ?? new Map<string, number>();

        for (const item of rental.gearPackage.items) {
          dayUsage.set(
            item.gearItemId,
            (dayUsage.get(item.gearItemId) ?? 0) + item.quantity,
          );
        }

        map.set(key, dayUsage);
      }
    }

    return map;
  }, [rentals]);

  const getRentalsForDate = (date: Date) =>
    rentalsByDate.get(format(date, "yyyy-MM-dd")) ?? [];

  const isPackageAvailableOnDate = useMemo(
    () => (date: Date) => {
      if (!selectedPackage) return true;

      const dayUsage = usageByDate.get(format(date, "yyyy-MM-dd")) ?? new Map();
      return selectedPackage.items.every(
        (item) =>
          (dayUsage.get(item.gearItemId) ?? 0) + item.quantity <=
          item.gearItem.quantity,
      );
    },
    [selectedPackage, usageByDate],
  );

  const conflictsInRange = useMemo(() => {
    if (!dateRange.from || !dateRange.to || !selectedPackage) return [];

    const conflicts: { date: Date; rentals: PublicRental[] }[] = [];
    const days = differenceInCalendarDays(dateRange.to, dateRange.from);

    for (let i = 0; i <= days; i++) {
      const d = new Date(dateRange.from);
      d.setDate(d.getDate() + i);

      if (!isPackageAvailableOnDate(d)) {
        conflicts.push({ date: d, rentals: getRentalsForDate(d) });
      }
    }

    return conflicts;
  }, [dateRange, rentals, selectedPackage, isPackageAvailableOnDate]);

  const modifiers = useMemo(
    () => ({
      booked: (date: Date) => getRentalsForDate(date).length > 0,
      unavailable: (date: Date) =>
        !!selectedPackage && !isPackageAvailableOnDate(date),
    }),
    [selectedPackage, isPackageAvailableOnDate],
  );

  const modifiersClassNames = {
    booked: "bg-amber-500/5 rounded-md",
    unavailable: "bg-red-500/10 rounded-md",
  };

  const handleDayClick = (date: Date) => {
    const dayRentals = getRentalsForDate(date);
    if (dayRentals.length > 0) {
      setFocusedBookings((prev) =>
        prev && isSameDay(prev.date, date)
          ? null
          : { date, rentals: dayRentals },
      );
    } else {
      setFocusedBookings(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedPackageId ||
      !dateRange.from ||
      !dateRange.to ||
      !userName.trim() ||
      !contactInfo.trim() ||
      conflictsInRange.length > 0
    ) {
      return;
    }

    createRental.mutate({
      packageId: selectedPackageId,
      userName,
      contactInfo,
      startDate: dateRange.from,
      endDate: dateRange.to,
    });
  };

  const totalPricePerDay = selectedPackage?.price ?? 0;
  const numDays =
    dateRange.from && dateRange.to
      ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1
      : 0;
  const today = startOfDay(new Date());
  const isFormValid =
    !!selectedPackageId &&
    !!dateRange.from &&
    !!dateRange.to &&
    !!userName.trim() &&
    !!contactInfo.trim() &&
    conflictsInRange.length === 0;

  return (
    <div className="grid gap-8 xl:grid-cols-12">
      <div className="space-y-8 xl:col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Select A Rental Package</CardTitle>
            <CardDescription>
              {selectedPackage
                ? `Calendar now reflects availability for ${selectedPackage.name}.`
                : "Only packages can be rented. Choose one below to check availability."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {packages?.map((gearPackage) => {
                const isSelected = selectedPackageId === gearPackage.id;

                return (
                  <div
                    key={gearPackage.id}
                    onClick={() =>
                      setSelectedPackageId((current) =>
                        current === gearPackage.id ? null : gearPackage.id,
                      )
                    }
                    className={cn(
                      "relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all duration-200",
                      "select-none",
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

                    {gearPackage.description && (
                      <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                        {gearPackage.description}
                      </p>
                    )}

                    <div className="mt-auto space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Includes
                      </div>
                      <div className="flex flex-wrap gap-2">
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

                    {isSelected && (
                      <div className="absolute -right-2 -top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {packagesLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-xl bg-muted"
                  />
                ))}
            </div>

            <div className="flex flex-col items-center border-t pt-6">
              <div className="mb-4 text-center">
                <h3 className="mb-1 text-lg font-bold">2. Choose Your Dates</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedPackage
                    ? "Unavailable days are blocked for the selected package. Tap booked days to see details."
                    : "Choose a package first, then pick your rental dates."}
                </p>
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-primary/20 ring-1 ring-primary/40" />
                  <span>Your Range</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-amber-500/20 ring-1 ring-amber-500/40" />
                  <span>Approved Booking Exists</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-red-500/20 ring-1 ring-red-500/40" />
                  <span>Selected Package Unavailable</span>
                </div>
              </div>

              <div className="relative w-full max-w-fit">
                <div className="overflow-auto rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to } as never}
                    onSelect={(range) =>
                      setDateRange(
                        range
                          ? {
                              from: range.from,
                              to: range.to,
                            }
                          : { from: undefined, to: undefined },
                      )
                    }
                    onDayClick={handleDayClick}
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                    disabled={(date) =>
                      date < today ||
                      (!!selectedPackage && !isPackageAvailableOnDate(date))
                    }
                    numberOfMonths={2}
                    showOutsideDays={false}
                    className="rounded-md"
                    classNames={{
                      months: "flex flex-col gap-4 sm:flex-row sm:gap-8",
                    }}
                    components={{
                      DayButton: (props) => {
                        const dayRentals = getRentalsForDate(props.day.date);
                        const isBooked = dayRentals.length > 0;
                        const isUnavailable =
                          !!selectedPackage &&
                          !isPackageAvailableOnDate(props.day.date);
                        const isFocused =
                          focusedBookings &&
                          isSameDay(focusedBookings.date, props.day.date);

                        return (
                          <CalendarDayButton {...props}>
                            <div className="relative flex flex-col items-center">
                              <span>{props.day.date.getDate()}</span>
                              {isBooked && (
                                <div className="absolute -bottom-1 flex gap-0.5">
                                  {isUnavailable ? (
                                    <span className="inline-block h-1 w-3 rounded-full bg-red-500" />
                                  ) : (
                                    <span className="inline-block h-1 w-3 rounded-full bg-amber-500" />
                                  )}
                                </div>
                              )}
                              {isFocused && (
                                <span className="absolute -top-1 -right-2 h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                              )}
                            </div>
                          </CalendarDayButton>
                        );
                      },
                    }}
                  />
                </div>

                {(dateRange.from || dateRange.to) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute -top-2 right-2 z-10 h-7 gap-1 rounded-full border bg-background px-2 text-[10px] uppercase tracking-wider text-muted-foreground shadow-sm hover:text-foreground"
                    onClick={() =>
                      setDateRange({ from: undefined, to: undefined })
                    }
                  >
                    <X className="h-3 w-3" /> Clear dates
                  </Button>
                )}

                {focusedBookings && (
                  <div className="animate-in fade-in slide-in-from-top-2 absolute top-1/2 left-1/2 z-50 mt-3 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-4 shadow-xl duration-200">
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
                          className="flex flex-col gap-1 rounded-lg border border-muted bg-muted/50 p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>{rental.userName}</span>
                            <Badge variant="secondary" className="text-[9px]">
                              Booked
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CircleDot className="h-3 w-3" />
                              {rental.gearPackage.name}
                            </span>
                            <span>
                              {format(new Date(rental.startDate), "MMM d")} -{" "}
                              {format(new Date(rental.endDate), "MMM d")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {conflictsInRange.length > 0 && selectedPackage && (
                <div className="mt-4 flex w-full max-w-md items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {selectedPackage.name} is unavailable on{" "}
                      {conflictsInRange.length} selected day
                      {conflictsInRange.length > 1 ? "s" : ""}.
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      Pick another date range or a different package before
                      submitting.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="xl:col-span-4">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>3. Request Booking</CardTitle>
            <CardDescription>
              Submit one package request for ATMOS review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {message && (
                <div
                  className={cn(
                    "rounded-xl border p-4 text-sm font-medium",
                    message.type === "success"
                      ? "border-green-500/20 bg-green-500/10 text-green-500"
                      : "border-red-500/20 bg-red-500/10 text-red-500",
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
                  className="rounded-lg"
                  required
                />
                <p className="px-1 text-[10px] uppercase text-muted-foreground">
                  This name will be visible to everyone on the calendar
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactInfo">Private Contact Info</Label>
                <Input
                  id="contactInfo"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Phone number or email"
                  className="rounded-lg"
                  required
                />
                <p className="px-1 text-[10px] uppercase text-muted-foreground">
                  This will only be seen by ATMOS staff
                </p>
              </div>

              <div className="space-y-4 rounded-2xl border border-muted/60 bg-muted/40 p-5">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Booking Summary
                </Label>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                        selectedPackage
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground",
                      )}
                    >
                      {selectedPackage ? "✓" : "1"}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Package
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-7">
                    {selectedPackage ? (
                      <>
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedPackage.name}
                        </Badge>
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
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                        dateRange.from && dateRange.to
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground",
                      )}
                    >
                      {dateRange.from && dateRange.to ? "✓" : "2"}
                    </div>
                    <span className="text-xs text-muted-foreground">Dates</span>
                  </div>
                  <div className="pl-7 text-sm font-bold">
                    {dateRange.from && dateRange.to ? (
                      <span>
                        {format(dateRange.from, "MMM d")} -{" "}
                        {format(dateRange.to, "MMM d")}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ({numDays} day{numDays > 1 ? "s" : ""})
                        </span>
                      </span>
                    ) : dateRange.from ? (
                      <span className="text-muted-foreground">
                        {format(dateRange.from, "MMM d")} -{" "}
                        <span className="italic">pick end date</span>
                      </span>
                    ) : (
                      <span className="font-normal italic text-destructive/70">
                        Select on calendar
                      </span>
                    )}
                  </div>
                </div>

                {selectedPackage && dateRange.from && dateRange.to && (
                  <div className="mt-3 flex items-end justify-between border-t border-muted/60 pt-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">
                        Estimated Total
                      </span>
                      <span className="text-2xl font-black tracking-tighter">
                        ${totalPricePerDay * numDays}
                      </span>
                    </div>
                    <div className="text-right text-[10px] italic text-muted-foreground">
                      ${totalPricePerDay}/day x {numDays} day
                      {numDays > 1 ? "s" : ""}
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="h-14 w-full rounded-xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                disabled={createRental.isPending || !isFormValid}
              >
                {createRental.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Package Request"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}