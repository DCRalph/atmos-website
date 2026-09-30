"use client";

import { useId, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "./ui";

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
  const subscribe = api.newsletter.subscribe.useMutation({
    onSuccess: () => onSubscribed?.(),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setInvalid(true);
    subscribe.mutate({ email: email.trim() });
  };

  if (subscribe.isSuccess) {
    return (
      <p
        role="status"
        className={cn(
          "flex h-14 items-center gap-3 rounded-full border border-white/25 px-2 pr-6",
          className,
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--site-accent)] text-[var(--site-accent-ink)]">
          <Check className="size-5" />
        </span>
        <span className="min-w-0 truncate text-[15px]">
          You&apos;re on the list.
        </span>
      </p>
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
          error ? "border-[var(--site-danger)]" : "border-white/25",
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
          className="mt-2 pl-6 text-[13px] text-[var(--site-danger-text)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
