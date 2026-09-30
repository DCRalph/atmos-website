"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import posthog from "posthog-js";
import { Check } from "lucide-react";
import { SOCIALS } from "~/lib/site-constants";
import { api } from "~/trpc/react";
import { PillRadioGroup } from "../inputs";
import { Button, inputClass } from "../ui";

const REASONS = [
  "General Inquiry",
  "Booking Request",
  "Partnership Opportunity",
  "Press & Media",
  "Technical Support",
  "Other",
] as const;
type Reason = (typeof REASONS)[number];

type Fields = {
  name: string;
  email: string;
  reason: Reason | "";
  message: string;
};
type Errors = Partial<Record<keyof Fields, string>>;

const empty: Fields = { name: "", email: "", reason: "", message: "" };
const fieldOrder = ["name", "email", "reason", "message"] as const;

const validate = (f: Fields): Errors => {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Please enter your name";
  if (!f.email.trim()) e.email = "Please enter your email";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
    e.email = "Please enter a valid email address";
  if (!f.reason) e.reason = "Please select a reason for contacting us";
  if (!f.message.trim()) e.message = "Please enter your message";
  return e;
};

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="mt-2 pl-5 text-[13px] text-[var(--site-danger-text)]">
      {error}
    </p>
  ) : null;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="t-label mb-2 block text-[10px] text-white/70"
      >
        {label}
      </label>
      {children}
      <FieldError id={`${id}-err`} error={error} />
    </div>
  );
}

/** The contact form. Posts through the tRPC contact mutation, which stores it and emails the team. */
export function ContactForm() {
  const [fields, setFields] = useState(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const create = api.contact.create.useMutation({
    onSuccess: (_data, variables) => {
      posthog.capture("contact_form_submitted", { reason: variables.reason });
      setSentTo(variables.email);
      setFields(empty);
    },
  });
  const sending = create.isPending;

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = validate(fields);
    setErrors(next);
    const first = fieldOrder.find((k) => next[k]);
    if (first) {
      const target =
        first === "reason"
          ? document.querySelector<HTMLInputElement>(
              'input[name="contact-reason"]',
            )
          : document.getElementById(`contact-${first}`);
      target?.focus();
      return;
    }
    if (!fields.reason) return;
    create.mutate({
      name: fields.name.trim(),
      email: fields.email.trim(),
      reason: fields.reason,
      message: fields.message.trim(),
    });
  };

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-start gap-5 py-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--site-accent)] text-[var(--site-accent-ink)]">
          <Check className="size-6" />
        </span>
        <h3 className="t-display text-[clamp(1.5rem,3vw,2.25rem)]">
          Message sent!
        </h3>
        <p className="max-w-[44ch] text-[15px] leading-relaxed text-white/70">
          We&apos;ll get back to you soon at {sentTo}. Need it sooner? DM us on
          Instagram at {SOCIALS.instagram.handle}.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setSentTo(null);
            create.reset();
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  const aria = (key: "name" | "email" | "message") => ({
    id: `contact-${key}`,
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `contact-${key}-err` : undefined,
    disabled: sending,
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-name" label="Name" error={errors.name}>
          <input
            {...aria("name")}
            autoComplete="name"
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Your name"
            className={inputClass}
          />
        </Field>
        <Field id="contact-email" label="Email" error={errors.email}>
          <input
            {...aria("email")}
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </Field>
      </div>
      <div>
        <PillRadioGroup
          name="contact-reason"
          legend="Reason"
          value={fields.reason}
          onChange={(v) => set("reason", v)}
          options={REASONS.map((r) => ({ value: r, label: r }))}
        />
        <FieldError id="contact-reason-err" error={errors.reason} />
      </div>
      <Field id="contact-message" label="Message" error={errors.message}>
        <textarea
          {...aria("message")}
          rows={6}
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="Tell us more"
          className="w-full resize-y rounded-[var(--site-r-panel)] border border-white/15 bg-white/[0.04] px-5 py-4 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/40 hover:border-white/30 focus:border-white/60 disabled:opacity-60 aria-[invalid=true]:border-[var(--site-danger)]"
        />
      </Field>
      {create.isError ? (
        <p role="alert" className="text-[14px] text-[var(--site-danger-text)]">
          Something went wrong. Please try again.
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={sending}
        aria-busy={sending}
        className="w-full sm:w-auto"
      >
        {sending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
