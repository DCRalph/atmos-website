"use client";

import { useId, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useNewsletterSound } from "~/hooks/use-newsletter-sound";
import { AtmosLogo, Button } from "./ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Email capture pill for the newsletter. Validates before sending, shows the
 * server's error if it fails, and swaps to a confirmation once subscribed.
 */
export function NewsletterForm({
  cta = "Subscribe",
  className,
  onSubscribed,
}: {
  cta?: string;
  className?: string;
  /** Called once the address is on the list. */
  onSubscribed?: () => void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const sound = useNewsletterSound();
  const subscribe = api.newsletter.subscribe.useMutation({
    onSuccess: () => {
      void sound.play();
      onSubscribed?.();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (subscribe.isPending) return;
    if (!EMAIL.test(email.trim())) return setInvalid(true);
    sound.prepare();
    subscribe.mutate({ email: email.trim() });
  };

  if (subscribe.isSuccess) {
    return (
      <div
        role="status"
        className={cn(
          "newsletter-success relative flex min-h-14 items-center gap-3 rounded-full border border-white/25 px-2 py-1.5 pr-6",
          className,
        )}
      >
        <span
          aria-hidden
          className="newsletter-logo-burst pointer-events-none absolute bottom-full left-1/2 mb-3 w-24 -translate-x-1/2"
        >
          <AtmosLogo className="w-full" />
        </span>
        <span className="newsletter-check bg-site-accent text-site-accent-ink flex size-10 shrink-0 items-center justify-center rounded-full">
          <Check className="size-5" />
        </span>
        <span className="min-w-0 truncate text-[15px]">
          You&apos;re on the list.
        </span>
      </div>
    );
  }

  const error = invalid
    ? "That email doesn't look right."
    : subscribe.error?.message;

  return (
    <div className={className}>
      <form
        noValidate
        onSubmit={submit}
        className={cn(
          "flex h-14 items-center rounded-full border bg-black/30 p-1.5 pl-6 focus-within:border-white/70",
          error ? "border-site-danger" : "border-white/25",
        )}
      >
        <label className="sr-only" htmlFor={id}>
          Email
        </label>
        <input
          id={id}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setInvalid(false);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          placeholder="Email address"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/50"
        />
        <Button
          type="submit"
          className="h-full"
          disabled={subscribe.isPending}
          aria-busy={subscribe.isPending}
        >
          {subscribe.isPending ? "Joining…" : cta}
        </Button>
      </form>
      {error ? (
        <p
          id={`${id}-err`}
          className="text-site-danger-text mt-2 pl-6 text-[13px]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
