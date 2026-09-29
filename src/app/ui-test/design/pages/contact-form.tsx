"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import { Button } from "../primitives";
import { inputClass } from "../sections/checkout";

type Fields = { name: string; email: string; subject: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;
type Phase = "idle" | "sending" | "sent";

const empty: Fields = { name: "", email: "", subject: "", message: "" };
// Illustrative sender, used to preview the sending and sent states.
const sample: Fields = {
  name: "Mia Walker",
  email: "mia@example.com",
  subject: "Collab",
  message:
    "Keen to talk about a collab over summer. Who's the best person to chat to?",
};

const validate = (f: Fields): Errors => {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Add your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email))
    e.email = "Enter an email we can reply to.";
  if (!f.subject.trim()) e.subject = "Add a subject.";
  if (f.message.trim().length < 10)
    e.message = "Tell us a bit more, at least 10 characters.";
  return e;
};

/** Seeds the form from a board state: errors as if sent empty, sending held mid-send, sent. */
function initialFor(state: string): {
  fields: Fields;
  errors: Errors;
  phase: Phase;
} {
  if (state === "errors")
    return { fields: empty, errors: validate(empty), phase: "idle" };
  if (state === "sending")
    return { fields: sample, errors: {}, phase: "sending" };
  if (state === "sent") return { fields: sample, errors: {}, phase: "sent" };
  return { fields: empty, errors: {}, phase: "idle" };
}

const fieldOrder = ["name", "email", "subject", "message"] as const;
const quickSubjects = ["Booking", "Collab", "Question"] as const;

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
        className="mx-label mb-2 block text-[10px] text-white/70"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-2 pl-5 text-[13px] text-[#ff8a8a]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The real contact form (name, email, subject, message) in the new system.
 * Render with `key={state}` so switching board states re-seeds it. The
 * "sending" board state holds on "Sending…" so it can be inspected.
 * `subjectPills` adds one-tap subjects taken from the page's subtitle.
 */
export function ContactForm({
  state,
  subjectPills = false,
}: {
  state: string;
  subjectPills?: boolean;
}) {
  const { toast } = useBoard();
  const [init] = useState(() => initialFor(state));
  const [fields, setFields] = useState(init.fields);
  const [errors, setErrors] = useState<Errors>(init.errors);
  const [phase, setPhase] = useState<Phase>(init.phase);
  const hold = state === "sending";

  useEffect(() => {
    if (phase !== "sending" || hold) return;
    const t = setTimeout(() => {
      setPhase("sent");
      toast({ title: "Message sent", tone: "success" });
    }, 1200);
    return () => clearTimeout(t);
  }, [phase, hold, toast]);

  const set = (key: keyof Fields, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = validate(fields);
    setErrors(next);
    const first = fieldOrder.find((k) => next[k]);
    if (first) {
      document.getElementById(`contact-${first}`)?.focus();
      return;
    }
    setPhase("sending");
  };

  if (phase === "sent") {
    return (
      <div role="status" className="flex flex-col items-start gap-5 py-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]">
          <Check className="size-6" />
        </span>
        <h3 className="mx-display text-[clamp(1.5rem,3vw,2.25rem)]">
          Message sent successfully!
        </h3>
        <p className="max-w-[44ch] text-[15px] leading-relaxed text-white/70">
          We&apos;ll reply to {fields.email}. Need it sooner? DM us on Instagram
          at @atmos.nz.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setFields(empty);
            setErrors({});
            setPhase("idle");
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  const sending = phase === "sending";
  const aria = (key: keyof Fields) => ({
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
      <Field id="contact-subject" label="Subject" error={errors.subject}>
        <input
          {...aria("subject")}
          value={fields.subject}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="What's this about?"
          className={inputClass}
        />
        {subjectPills ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {quickSubjects.map((s) => (
              <button
                key={s}
                type="button"
                disabled={sending}
                aria-pressed={fields.subject === s}
                onClick={() => set("subject", s)}
                className={cn(
                  "h-9 rounded-full border px-4 text-[13px] transition-colors",
                  fields.subject === s
                    ? "border-white bg-white text-black"
                    : "border-white/15 text-white/75 hover:border-white/40",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </Field>
      <Field id="contact-message" label="Message" error={errors.message}>
        <textarea
          {...aria("message")}
          rows={6}
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="Tell us more"
          className="w-full resize-y rounded-[var(--mx-r-panel)] border border-white/15 bg-white/[0.04] px-5 py-4 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/40 hover:border-white/30 focus:border-white/60 disabled:opacity-60 aria-[invalid=true]:border-[#ff6b6b]"
        />
      </Field>
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
