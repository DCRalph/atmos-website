"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

interface DateTimePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showTime?: boolean;
}

export function DateTimePicker({
  date,
  onDateChange,
  placeholder = "Pick a date and time",
  disabled = false,
  // required = false,
  showTime = true,
}: DateTimePickerProps) {
  const [timeValue, setTimeValue] = React.useState<string>("");

  React.useEffect(() => {
    if (date) {
      // Format time as HH:mm
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      setTimeValue(`${hours}:${minutes}`);
    } else {
      setTimeValue("");
    }
  }, [date]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onDateChange(undefined);
      return;
    }

    if (date && timeValue) {
      // Preserve the time when changing the date
      const [hours, minutes] = timeValue.split(":").map(Number);
      const newDate = new Date(selectedDate);
      newDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      onDateChange(newDate);
    } else {
      // Set to selected date at midnight if no time is set
      const newDate = new Date(selectedDate);
      newDate.setHours(0, 0, 0, 0);
      onDateChange(newDate);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTimeValue(value);

    if (date && value) {
      const [hours, minutes] = value.split(":").map(Number);
      if (!isNaN(hours ?? 0) && !isNaN(minutes ?? 0)) {
        const newDate = new Date(date);
        newDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
        onDateChange(newDate);
      }
    } else if (date && !value) {
      // If time is cleared, keep the date but reset time to midnight
      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);
      onDateChange(newDate);
    }
  };

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? (
              showTime
                ? format(date, "PPP 'at' HH:mm")
                : format(date, "PPP")
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {showTime && (
        <div className="flex items-center gap-2">
          <Label htmlFor="time-input" className="text-sm text-muted-foreground">
            Time:
          </Label>
          <Input
            id="time-input"
            type="time"
            value={timeValue}
            onChange={handleTimeChange}
            className="w-32"
            disabled={disabled || !date}
          />
        </div>
      )}
    </div>
  );
}

