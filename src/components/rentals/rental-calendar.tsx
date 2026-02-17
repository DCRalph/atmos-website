"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Calendar, CalendarDayButton } from "~/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import {
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
  isSameDay,
  differenceInCalendarDays,
} from "date-fns";
import {
  Loader2,
  CheckCircle2,
  CalendarIcon,
  X,
  CircleDot,
  AlertTriangle,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { CalendarDay } from "react-day-picker";

export function RentalCalendar() {
  const [selectedGearIds, setSelectedGearIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [userName, setUserName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [focusedBookings, setFocusedBookings] = useState<{
    date: Date;
    rentals: any[];
  } | null>(null);

  const { data: gearItems, isLoading: gearLoading } =
    api.rentals.getAllGear.useQuery();
  const { data: rentals, isLoading: rentalsLoading } =
    api.rentals.getPublicRentals.useQuery();

  const createRental = api.rentals.createRentalRequest.useMutation({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: "Rental request submitted! Admin will review it.",
      });
      setUserName("");
      setContactInfo("");
      setDateRange({ from: undefined, to: undefined });
      setSelectedGearIds([]);
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({ type: "error", text: error.message });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const relevantRentals = useMemo(
    () =>
      rentals?.filter(
        (r) =>
          selectedGearIds.length === 0 ||
          selectedGearIds.includes(r.gearItemId),
      ) ?? [],
    [rentals, selectedGearIds],
  );

  // Pre-compute a Map<dateString, rental[]> for O(1) lookups instead of
  // running .some() on every render for every visible day cell.
  const rentalsByDate = useMemo(() => {
    const map = new Map<string, typeof relevantRentals>();
    for (const rental of relevantRentals) {
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
  }, [relevantRentals]);

  const getRentalsForDate = (date: Date) =>
    rentalsByDate.get(format(date, "yyyy-MM-dd")) ?? [];

  // Check if selected range has any conflicts
  const conflictsInRange = useMemo(() => {
    if (!dateRange.from || !dateRange.to || selectedGearIds.length === 0)
      return [];
    const conflicts: { date: Date; rentals: any[] }[] = [];
    const days = differenceInCalendarDays(dateRange.to, dateRange.from);
    for (let i = 0; i <= days; i++) {
      const d = new Date(dateRange.from);
      d.setDate(d.getDate() + i);
      const dayRentals = getRentalsForDate(d);
      if (dayRentals.length > 0) {
        conflicts.push({ date: d, rentals: dayRentals });
      }
    }
    return conflicts;
  }, [dateRange, rentalsByDate, selectedGearIds]);

  const modifiers = useMemo(
    () => ({
      booked: (date: Date) => getRentalsForDate(date).length > 0,
      partiallyBooked: (date: Date) => {
        if (selectedGearIds.length === 0) return false;
        const dayRentals = getRentalsForDate(date);
        // Some gear is booked but not all selected gear
        return (
          dayRentals.length > 0 &&
          dayRentals.length < selectedGearIds.length
        );
      },
      fullyBooked: (date: Date) => {
        if (selectedGearIds.length === 0)
          return getRentalsForDate(date).length > 0;
        const dayRentals = getRentalsForDate(date);
        const bookedGearIds = new Set(dayRentals.map((r) => r.gearItemId));
        return selectedGearIds.every((id) => bookedGearIds.has(id));
      },
    }),
    [rentalsByDate, selectedGearIds],
  );

  const modifiersClassNames = {
    booked: "bg-red-500/5 rounded-md",
    partiallyBooked: "bg-amber-500/5 rounded-md",
    fullyBooked: "bg-red-500/10 rounded-md",
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
      selectedGearIds.length === 0 ||
      !dateRange.from ||
      !dateRange.to ||
      !userName ||
      !contactInfo
    )
      return;

    createRental.mutate({
      gearItemIds: selectedGearIds,
      userName,
      contactInfo,
      startDate: dateRange.from,
      endDate: dateRange.to,
    });
  };

  const selectedGearItems =
    gearItems?.filter((g) => selectedGearIds.includes(g.id)) ?? [];
  const totalPricePerDay = selectedGearItems.reduce(
    (sum, item) => sum + item.price,
    0,
  );
  const numDays =
    dateRange.from && dateRange.to
      ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1
      : 0;

  const toggleGear = (id: string) => {
    setSelectedGearIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const isFormValid =
    selectedGearIds.length > 0 &&
    dateRange.from &&
    dateRange.to &&
    userName.trim() &&
    contactInfo.trim();

  return (
    <div className="grid gap-8 xl:grid-cols-12">
      {/* Left Column */}
      <div className="space-y-8 xl:col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Select Gear & Check Availability</CardTitle>
            <CardDescription>
              {selectedGearIds.length === 0
                ? "Showing all current bookings. Select items to filter and book."
                : `Showing bookings for ${selectedGearIds.length} selected item${selectedGearIds.length > 1 ? "s" : ""}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Gear Selection Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {gearItems?.map((item) => {
                const isSelected = selectedGearIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleGear(item.id)}
                    className={cn(
                      "relative flex flex-col rounded-xl border p-4 transition-all duration-200",
                      "cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-muted hover:border-primary/50 hover:bg-muted/50",
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h4 className="text-lg font-bold">{item.name}</h4>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleGear(item.id)}
                        className="mt-1"
                        tabIndex={-1}
                      />
                    </div>
                    {item.description && (
                      <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-end justify-between">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Per Day
                      </div>
                      <div className="font-mono text-xl font-bold">
                        ${item.price}
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
              {gearLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-xl bg-muted"
                  />
                ))}
            </div>

            {/* Calendar Section */}
            <div className="flex flex-col items-center border-t pt-6">
              <div className="mb-4 text-center">
                <h3 className="mb-1 text-lg font-bold">
                  2. Choose Your Dates
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select a start and end date. Tap booked days to see details.
                </p>
              </div>

              {/* Legend */}
              <div className="mb-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-primary/20 ring-1 ring-primary/40" />
                  <span>Your Selection</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-red-500/20 ring-1 ring-red-500/40" />
                  <span>Booked</span>
                </div>
                {selectedGearIds.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-amber-500/20 ring-1 ring-amber-500/40" />
                    <span>Partially Booked</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-muted ring-1 ring-muted-foreground/20" />
                  <span>Unavailable</span>
                </div>
              </div>

              {/* Calendar container */}
              <div className="relative w-full max-w-fit">
                <div className="overflow-auto rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
                  <Calendar
                    mode="range"
                    selected={
                      { from: dateRange.from, to: dateRange.to } as any
                    }
                    onSelect={(range: any) =>
                      setDateRange(
                        range || { from: undefined, to: undefined },
                      )
                    }
                    onDayClick={handleDayClick}
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                    disabled={{ before: new Date() }}
                    numberOfMonths={2}
                    showOutsideDays={false}
                    className="rounded-md"
                    classNames={{
                      months: "flex flex-col sm:flex-row gap-4 sm:gap-8",
                    }}
                    components={{
                      DayButton: (props) => {
                        const { day, modifiers: activeModifiers } = props;
                        const dayRentals = getRentalsForDate(day.date);
                        const isBooked = dayRentals.length > 0;
                        const bookedGearIds = new Set(
                          dayRentals.map((r) => r.gearItemId),
                        );
                        const isFullyBooked =
                          selectedGearIds.length > 0 &&
                          selectedGearIds.every((id) =>
                            bookedGearIds.has(id),
                          );
                        const isPartiallyBooked =
                          isBooked &&
                          !isFullyBooked &&
                          selectedGearIds.length > 1;
                        const isFocused =
                          focusedBookings &&
                          isSameDay(focusedBookings.date, day.date);

                        return (
                          <CalendarDayButton {...props}>
                            <div className="relative flex flex-col items-center">
                              <span>{day.date.getDate()}</span>
                              {isBooked && (
                                <div className="absolute -bottom-1 flex gap-0.5">
                                  {isFullyBooked ? (
                                    <span className="inline-block h-1 w-3 rounded-full bg-red-500" />
                                  ) : isPartiallyBooked ? (
                                    <span className="inline-block h-1 w-3 rounded-full bg-amber-500" />
                                  ) : (
                                    <span className="inline-block h-1 w-3 rounded-full bg-red-400/70" />
                                  )}
                                </div>
                              )}
                              {isFocused && (
                                <span className="absolute -right-2 -top-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                              )}
                            </div>
                          </CalendarDayButton>
                        );
                      },
                    }}
                  />
                </div>

                {/* Quick-clear date button */}
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

                {/* Focused bookings detail panel */}
                {focusedBookings && (
                  <div className="animate-in fade-in slide-in-from-top-2 absolute left-1/2 top-1/2 -translate-y-1/2 z-50 mt-3 w-full max-w-sm -translate-x-1/2 rounded-xl border bg-background p-4 shadow-xl duration-200">
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
                      {focusedBookings.rentals.map((rental: any) => {
                        const gearName =
                          gearItems?.find(
                            (g) => g.id === rental.gearItemId,
                          )?.name ?? "Unknown Gear";
                        return (
                          <div
                            key={rental.id}
                            className="flex flex-col gap-1 rounded-lg border border-muted bg-muted/50 p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>{rental.userName}</span>
                              <Badge
                                variant="secondary"
                                className="text-[9px]"
                              >
                                Booked
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CircleDot className="h-3 w-3" />
                                {gearName}
                              </span>
                              <span>
                                {format(
                                  new Date(rental.startDate),
                                  "MMM d",
                                )}{" "}
                                –{" "}
                                {format(
                                  new Date(rental.endDate),
                                  "MMM d",
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Conflict warning */}
              {conflictsInRange.length > 0 && selectedGearIds.length > 0 && (
                <div className="mt-4 flex w-full max-w-md items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {conflictsInRange.length} day
                      {conflictsInRange.length > 1 ? "s" : ""} in your
                      range overlap with existing bookings.
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      You can still submit — the admin will review
                      conflicts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Booking Form (Sticky) */}
      <div className="xl:col-span-4">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>3. Request Booking</CardTitle>
            <CardDescription>
              Submit your request for ATMOS review.
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

                {/* Step indicators */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                        selectedGearItems.length > 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground",
                      )}
                    >
                      {selectedGearItems.length > 0 ? "✓" : "1"}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Gear
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-7">
                    {selectedGearItems.length > 0 ? (
                      selectedGearItems.map((item) => (
                        <Badge
                          key={item.id}
                          variant="secondary"
                          className="gap-1 text-[10px]"
                        >
                          {item.name}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGear(item.id);
                            }}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm italic text-destructive/70">
                        None selected
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
                    <span className="text-xs text-muted-foreground">
                      Dates
                    </span>
                  </div>
                  <div className="pl-7 text-sm font-bold">
                    {dateRange.from && dateRange.to ? (
                      <span>
                        {format(dateRange.from, "MMM d")} –{" "}
                        {format(dateRange.to, "MMM d")}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ({numDays} day{numDays > 1 ? "s" : ""})
                        </span>
                      </span>
                    ) : dateRange.from ? (
                      <span className="text-muted-foreground">
                        {format(dateRange.from, "MMM d")} –{" "}
                        <span className="italic">pick end date</span>
                      </span>
                    ) : (
                      <span className="font-normal italic text-destructive/70">
                        Select on calendar
                      </span>
                    )}
                  </div>
                </div>

                {selectedGearItems.length > 0 &&
                  dateRange.from &&
                  dateRange.to && (
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
                        ${totalPricePerDay}/day × {numDays} day
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
                  "Submit Booking Request"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}