"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import { TimeField } from "~/components/ui/time-field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

interface DateTimePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showTime?: boolean;
  /** Shows an × beside a set date that empties the field. For optional dates. */
  clearable?: boolean;
}

/**
 * A date and a time of day, on one row: the calendar button, the time field,
 * and the clear button when the field is optional.
 *
 * The time is the run sheet's `TimeField`, typed or picked and written in
 * am/pm, rather than `<input type="time">`: the native control renders at
 * three widths across browsers and shows a worse picker.
 */
export function DateTimePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  disabled = false,
  // required = false,
  showTime = true,
  clearable = false,
}: DateTimePickerProps) {
  const minutes = date ? date.getHours() * 60 + date.getMinutes() : null;

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) {
      onDateChange(undefined);
      return;
    }
    // Keep the time of day when only the day changes. A fresh date lands on
    // the evening, which is when gigs are, rather than on midnight.
    const next = new Date(selected);
    if (date) next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    else next.setHours(20, 0, 0, 0);
    onDateChange(next);
  };

  const handleTimeChange = (value: number | null) => {
    // A time with no date yet means today.
    const next = date ? new Date(date) : new Date();
    if (value === null) next.setHours(0, 0, 0, 0);
    else next.setHours(Math.floor(value / 60), value % 60, 0, 0);
    onDateChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "min-w-0 flex-1 justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
            disabled={disabled}
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">
              {date ? format(date, "EEE d MMM yyyy") : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            defaultMonth={date}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {showTime ? (
        <TimeField
          value={minutes}
          onChange={handleTimeChange}
          disabled={disabled}
          ariaLabel="Time"
          placeholder="Time"
          className="w-[104px] shrink-0"
          inputClassName="h-9"
        />
      ) : null}
      {clearable && date ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Clear date"
          disabled={disabled}
          onClick={() => onDateChange(undefined)}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
