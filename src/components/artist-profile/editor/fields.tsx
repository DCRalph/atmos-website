"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { inputClass } from "~/components/site/ui";

/**
 * Form pieces for the page editor's panels, in the site's look: labels in
 * stretched caps, pill inputs on black.
 */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="t-label block text-[10px] text-white/60">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-site-danger-text text-[13px]">{error}</p>
      ) : hint ? (
        <p className="text-[13px] leading-snug text-white/50">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, "h-11", className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        inputClass,
        "h-auto min-h-28 resize-y rounded-[22px] py-3 leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

/** A heading that splits a panel into parts. */
export function PanelSection({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-white/10 pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="t-label text-[11px] text-white">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Pill options, one picked. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T | null;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "t-label inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[10px] transition-colors",
            o.value === value
              ? "border-white bg-white text-black"
              : "border-white/15 text-white/75 hover:border-white/40 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A small round icon button for panel rows. */
export function IconAction({
  label,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/75 transition-colors hover:border-white/40 hover:text-white disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** A full-width row button in a panel (secondary actions). */
export function PanelButton({
  className,
  tone = "default",
  ...props
}: ComponentProps<"button"> & { tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      className={cn(
        "t-label inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-[10px] transition-colors disabled:pointer-events-none disabled:opacity-40",
        tone === "danger"
          ? "text-site-danger-text border-white/15 hover:border-[var(--site-danger)]"
          : "border-white/15 text-white/80 hover:border-white/40 hover:text-white",
        className,
      )}
      {...props}
    />
  );
}
