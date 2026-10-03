"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import {
  GlassCheckbox,
  GlassSelect,
  GlassSwitch,
  PillRadioGroup,
} from "../inputs";
import { Button, VariantTag } from "../primitives";
import { inputClass } from "./checkout";

const topics = [
  { value: "booking", label: "Booking an artist" },
  { value: "tickets", label: "Help with tickets" },
  { value: "equipment", label: "Equipment hire" },
  { value: "press", label: "Press" },
  { value: "other", label: "Something else" },
] as const;
type Topic = (typeof topics)[number]["value"];

const MAX = 600;

function ContactForm() {
  const { toast } = useBoard();
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: undefined as Topic | undefined,
    message: "",
    consent: false,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof typeof form, string>>
  >({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear a field's error as soon as it's edited.
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Tell us who you are.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email))
      next.email = "We need a working email to reply to.";
    if (!form.topic)
      next.topic = "Pick what it's about so it reaches the right person.";
    if (form.message.trim().length < 10)
      next.message = "Add a bit more detail, at least 10 characters.";
    if (!form.consent) next.consent = "Needed so we can reply.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setState("sending");
    setTimeout(() => {
      setState("sent");
      toast({
        title: "Message sent. We reply within two days.",
        tone: "success",
      });
    }, 1200);
  };

  if (state === "sent") {
    return (
      <div className="flex flex-col items-start gap-5 border border-white/10 p-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]">
          <Check className="size-6" />
        </span>
        <h3 className="mx-display text-3xl">Sent</h3>
        <p className="max-w-[40ch] text-[15px] text-white/70">
          Thanks {form.name.split(" ")[0]}. We&apos;ll reply to {form.email},
          usually within two days.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setForm({
              name: "",
              email: "",
              topic: undefined,
              message: "",
              consent: false,
            });
            setState("idle");
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  const err = (key: keyof typeof form) =>
    errors[key] ? (
      <p id={`cf-${key}-err`} className="mt-2 pl-5 text-[13px] text-[#ff8a8a]">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="cf-name"
            className="mx-label mb-2 block text-[10px] text-white/70"
          >
            Name
          </label>
          <input
            id="cf-name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "cf-name-err" : undefined}
            className={inputClass}
          />
          {err("name")}
        </div>
        <div>
          <label
            htmlFor="cf-email"
            className="mx-label mb-2 block text-[10px] text-white/70"
          >
            Email
          </label>
          <input
            id="cf-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "cf-email-err" : undefined}
            className={inputClass}
          />
          {err("email")}
        </div>
      </div>
      <div>
        <label
          htmlFor="cf-topic"
          className="mx-label mb-2 block text-[10px] text-white/70"
        >
          About
        </label>
        <GlassSelect
          id="cf-topic"
          label="About"
          placeholder="Choose a topic"
          value={form.topic}
          onValueChange={(v) => set("topic", v)}
          options={topics}
          invalid={!!errors.topic}
        />
        {err("topic")}
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label
            htmlFor="cf-message"
            className="mx-label text-[10px] text-white/70"
          >
            Message
          </label>
          <span
            className={cn(
              "mx-num text-[12px]",
              form.message.length > MAX - 50
                ? "text-[var(--mx-accent-text)]"
                : "text-white/45",
            )}
          >
            {form.message.length} / {MAX}
          </span>
        </div>
        <textarea
          id="cf-message"
          rows={5}
          maxLength={MAX}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "cf-message-err" : undefined}
          className="w-full resize-y rounded-[var(--mx-r-panel)] border border-white/15 bg-white/[0.04] px-5 py-4 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/40 hover:border-white/30 focus:border-white/60 aria-[invalid=true]:border-[#ff6b6b]"
          placeholder="Dates, venue, what you need"
        />
        {err("message")}
      </div>
      <div>
        <GlassCheckbox
          id="cf-consent"
          checked={form.consent}
          onCheckedChange={(c) => set("consent", c)}
          invalid={!!errors.consent}
        >
          Atmos can use these details to reply to me.
        </GlassCheckbox>
        {errors.consent ? (
          <p className="mt-2 pl-8 text-[13px] text-[#ff8a8a]">
            {errors.consent}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={state === "sending"}
        aria-busy={state === "sending"}
        className="w-full sm:w-auto"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

function Preferences() {
  const [prefs, setPrefs] = useState({
    gigs: true,
    drops: false,
    radio: true,
    sms: false,
  });
  const [city, setCity] = useState<"wgtn" | "akl" | "chch" | "everywhere">(
    "wgtn",
  );
  const { toast } = useBoard();
  const toggle = (key: keyof typeof prefs, label: string) => (on: boolean) => {
    setPrefs((p) => ({ ...p, [key]: on }));
    toast({ title: `${label} ${on ? "on" : "off"}`, tone: "info" });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-5 divide-y divide-white/10">
        <GlassSwitch
          checked={prefs.gigs}
          onCheckedChange={toggle("gigs", "Gig announcements")}
          label="Gig announcements"
          description="Lineups and presale codes before tickets go public."
        />
        <div className="pt-5">
          <GlassSwitch
            checked={prefs.drops}
            onCheckedChange={toggle("drops", "Merch drops")}
            label="Merch drops"
            description="New tees and restocks."
          />
        </div>
        <div className="pt-5">
          <GlassSwitch
            checked={prefs.radio}
            onCheckedChange={toggle("radio", "Atmos Radio")}
            label="Atmos Radio"
            description="New mixes when they land."
          />
        </div>
        <div className="pt-5">
          <GlassSwitch
            checked={prefs.sms}
            onCheckedChange={() => undefined}
            label="Text messages"
            description="Coming soon."
            disabled
          />
        </div>
      </div>
      <PillRadioGroup
        name="city"
        legend="Where do you go out?"
        value={city}
        onChange={setCity}
        options={[
          { value: "wgtn", label: "Pōneke" },
          { value: "akl", label: "Tāmaki" },
          { value: "chch", label: "Ōtautahi" },
          { value: "everywhere", label: "Anywhere" },
        ]}
      />
    </div>
  );
}

export function FormsSection() {
  return (
    <div className="grid gap-14 px-5 pb-16 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-20">
      <div>
        <VariantTag className="px-0 md:px-0">
          Contact · submit empty to see every error
        </VariantTag>
        <ContactForm />
      </div>
      <div>
        <VariantTag className="px-0 md:px-0">
          Preferences · switches and radio pills
        </VariantTag>
        <Preferences />
      </div>
    </div>
  );
}
