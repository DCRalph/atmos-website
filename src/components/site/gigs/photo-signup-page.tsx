"use client";

import { useId, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

import { api } from "~/trpc/react";
import type { photoSignupGig } from "~/server/photo-signup";
import { cn } from "~/lib/utils";
import { AtmosLogo, Button, Media } from "../ui";
import { fmtDay } from "./gig-parts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What `/gigs/[id]/photo-signup` loads. */
type PhotoSignupGig = NonNullable<Awaited<ReturnType<typeof photoSignupGig>>>;

/**
 * The page a venue QR code lands on: the poster filling the screen, and one
 * glass panel asking for an email. Everything fits without scrolling, for
 * somebody in a dark room with one hand free. On a wide screen the poster is
 * held sharp beside the panel, over a blur of itself.
 */
export function PhotoSignupPage({
  gig,
  code,
}: {
  gig: PhotoSignupGig;
  /** The QR code that brought them, carried over by the short link. */
  code: string | null;
}) {
  const poster = gig.posterUrl;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      {poster ? (
        <Image
          src={poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover md:scale-110 md:blur-2xl md:brightness-50"
        />
      ) : null}
      <div
        aria-hidden
        className="scrim-bottom absolute inset-0 -z-10 md:bg-black/30 md:bg-none"
      />

      <div
        className={cn(
          "mx-auto flex min-h-dvh max-w-[900px] flex-col justify-end px-4 pt-24 pb-7 md:items-center md:justify-center md:py-16",
          poster &&
            "md:grid md:grid-cols-[minmax(0,340px)_minmax(0,380px)] md:gap-11",
        )}
      >
        {poster ? (
          <Media
            src={poster}
            alt={`${gig.title} poster`}
            sizes="340px"
            className="hidden aspect-[4/5] md:block"
          />
        ) : null}

        <div className="w-full md:max-w-[380px]">
          <section className="glass-dark space-y-4 rounded-[var(--site-r-panel)] rounded-tl-none p-[22px]">
            <p className="t-label text-[10px] text-[var(--site-accent-text)]">
              Photos coming soon
            </p>
            <Title gig={gig} />
            <SignupForm gig={gig} code={code} />
          </section>
          <Link
            href="/"
            className="mx-auto mt-5 block w-20 opacity-50 transition-opacity hover:opacity-100"
          >
            <AtmosLogo />
          </Link>
        </div>
      </div>
    </main>
  );
}

function Title({ gig }: { gig: PhotoSignupGig }) {
  return (
    <>
      <h1 className="t-display text-[30px] [overflow-wrap:anywhere]">
        {gig.title}
      </h1>
      <p className="t-label flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-white/80">
        <span>{fmtDay(gig.startsAt)}</span>
        <span>{gig.venue}</span>
      </p>
    </>
  );
}

/** The ask, then the confirmation in its place. */
function SignupForm({
  gig,
  code,
}: {
  gig: PhotoSignupGig;
  code: string | null;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const signup = api.photoSignup.signup.useMutation();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setInvalid(true);
    signup.mutate({ gigId: gig.id, email: email.trim(), code });
  };

  if (signup.isSuccess) {
    return (
      <div role="status" className="space-y-4">
        <p className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--site-accent)] text-[var(--site-accent-ink)]">
            <Check className="size-5" />
          </span>
          <span className="t-display text-[22px]">You&apos;re on it</span>
        </p>
        <p className="text-[15px] leading-relaxed text-white/75">
          We&apos;ll email{" "}
          <b className="font-semibold text-white">{email.trim()}</b> when the
          photos are up.
        </p>
        <button
          type="button"
          onClick={() => signup.reset()}
          className="t-label text-[11px] text-white/60 underline underline-offset-4 hover:text-white"
        >
          Wrong email? Change it
        </button>
      </div>
    );
  }

  const error = invalid
    ? "That email doesn't look right."
    : signup.error?.message;

  return (
    <form noValidate onSubmit={submit} className="space-y-3 pt-1">
      <div
        className={cn(
          "flex h-14 items-center rounded-full border bg-black/30 p-1.5 pl-5 focus-within:border-white/70",
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
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setInvalid(false);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : `${id}-consent`}
          placeholder="you@email.com"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/45"
        />
        <Button
          type="submit"
          variant="accent"
          className="h-full px-5"
          disabled={signup.isPending}
          aria-busy={signup.isPending}
        >
          {signup.isPending ? "Sending…" : "Notify me"}
        </Button>
      </div>
      {error ? (
        <p
          id={`${id}-err`}
          className="pl-5 text-[13px] text-[var(--site-danger-text)]"
        >
          {error}
        </p>
      ) : null}
      <p
        id={`${id}-consent`}
        className="text-[12px] leading-snug text-white/50"
      >
        By signing up you agree to get marketing emails from Atmos about future
        gigs.
      </p>
    </form>
  );
}
