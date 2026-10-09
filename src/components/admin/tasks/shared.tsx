"use client";
import type { ComponentProps, ReactNode } from "react";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { dayKey, nzDate, nzParts } from "~/lib/tasks/time";
import { statusLabels } from "~/lib/tasks/status";
import type { RouterOutputs } from "~/trpc/react";
export type TaskRow = RouterOutputs["tasks"]["list"][number];
export function TaskDatePicker({
  date,
  onChange,
  clearable = false,
}: {
  date: Date | undefined;
  onChange: (date: Date | undefined) => void;
  clearable?: boolean;
}) {
  const p = date ? nzParts(date) : null;
  // The existing picker speaks browser-local time. Give it an Auckland wall clock.
  const wall = p
    ? new Date(p.year, p.month - 1, p.day, p.hour, p.minute)
    : undefined;
  return (
    <DateTimePicker
      date={wall}
      clearable={clearable}
      onDateChange={(value) =>
        onChange(
          value
            ? nzDate(
                `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
                value.getHours(),
                value.getMinutes(),
              )
            : undefined,
        )
      }
    />
  );
}
// Radix items need nonempty values; form state keeps "" for clearing and validation.
const EMPTY_OPTION = "__empty__";

export function TaskSelect({
  value,
  onValueChange,
  options,
  "aria-label": ariaLabel,
  ...props
}: Pick<ComponentProps<typeof Select>, "disabled" | "required"> & {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  "aria-label"?: string;
}) {
  return (
    <Select
      {...props}
      value={value}
      onValueChange={(next) => onValueChange(next === EMPTY_OPTION ? "" : next)}
    >
      <SelectTrigger aria-label={ariaLabel} className="w-full min-w-0">
        <SelectValue
          placeholder={options.find((option) => !option.value)?.label}
        />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value || EMPTY_OPTION}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function TaskField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
export function taskFlag(task: TaskRow) {
  return task.atRisk
    ? "At risk"
    : task.unassigned
      ? "Unassigned"
      : task.waiting
        ? "Waiting"
        : task.overdue
          ? task.flagged
            ? "Late, flagged"
            : "Overdue"
          : task.upForGrabs
            ? "Up for grabs"
            : statusLabels[task.status];
}
export function taskGroup(task: TaskRow, now = new Date()) {
  if (task.status === "PROPOSED") return "Proposed";
  if (task.waiting) return "Waiting";
  if (task.status === "BLOCKED") return "Blocked";
  if (task.status === "IN_REVIEW") return "In review";
  if (task.overdue) return "Overdue";
  const delta =
    (nzDate(dayKey(task.projectedDueAt)).getTime() -
      nzDate(dayKey(now)).getTime()) /
    86400_000;
  return delta < 1 ? "Today" : delta < 7 ? "This week" : "Later";
}
