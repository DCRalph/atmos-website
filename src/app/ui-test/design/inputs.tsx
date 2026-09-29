"use client";

import type { ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "./board-state";

/** Pill trigger, glass listbox. Keyboard and typeahead come from Radix. */
export function GlassSelect<T extends string>({
  value,
  onValueChange,
  options,
  label,
  placeholder,
  invalid,
  className,
  id,
}: {
  value: T | undefined;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  label: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  id?: string;
}) {
  const { portalContainer } = useBoard();
  return (
    <Select.Root value={value} onValueChange={(v) => onValueChange(v as T)}>
      <Select.Trigger
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        className={cn(
          "mx-label flex h-12 w-full items-center justify-between gap-3 rounded-full border border-white/15 bg-white/[0.04] pr-4 pl-5 text-[12px] text-white outline-none hover:border-white/30 aria-[invalid=true]:border-[#ff6b6b] data-[placeholder]:text-white/45 data-[state=open]:border-white/60",
          className,
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="size-4 text-white/60" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={portalContainer}>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="mx-glass-dark mx-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-[90] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--mx-r-panel)] rounded-tl-none p-1.5"
        >
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="mx-label relative flex h-11 cursor-default items-center rounded-[10px] pr-10 pl-4 text-[11px] text-white/80 outline-none select-none data-[disabled]:opacity-35 data-[highlighted]:bg-white/10 data-[highlighted]:text-white data-[state=checked]:text-white"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-4">
                  <Check className="size-4 text-[var(--mx-accent-text)]" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function GlassSwitch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-6",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span>
        <span className="block text-[15px]">{label}</span>
        {description ? (
          <span className="mt-1 block text-[13px] text-white/55">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors duration-200",
          checked
            ? "border-transparent bg-[var(--mx-accent)]"
            : "border-white/20 bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 left-1 size-5 -translate-y-1/2 rounded-full transition-transform duration-200 ease-out",
            checked ? "translate-x-5 bg-[var(--mx-accent-ink)]" : "bg-white",
          )}
        />
      </button>
    </label>
  );
}

export function GlassCheckbox({
  checked,
  onCheckedChange,
  children,
  invalid,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  invalid?: boolean;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        aria-invalid={invalid}
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[var(--mx-r-chip)] border border-white/35 transition-colors hover:border-white aria-[invalid=true]:border-[#ff6b6b] data-[state=checked]:border-white data-[state=checked]:bg-white"
      >
        <Checkbox.Indicator>
          <Check className="size-3.5 text-black" strokeWidth={3} />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <label
        htmlFor={id}
        className="cursor-pointer text-[14px] leading-snug text-white/80"
      >
        {children}
      </label>
    </div>
  );
}

/** Radio set rendered as pill segments; native inputs for free keyboard support. */
export function PillRadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  legend,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  legend: string;
}) {
  return (
    <fieldset>
      <legend className="mx-label mb-3 text-[10px] text-white/70">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="flex h-10 items-center rounded-full border border-white/15 px-4 text-[14px] text-white/75 transition-colors peer-checked:border-white peer-checked:bg-white peer-checked:text-black peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--mx-accent-text)] hover:border-white/40">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
