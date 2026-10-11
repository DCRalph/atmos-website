"use client";

import { useId, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";

import { api } from "~/trpc/react";
import type { donateGig } from "~/server/donations";
import { donationCentsSchema } from "~/lib/donations";
import { formatNZDCompact, parsePriceToCents } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";
import { AtmosLogo, Button, Media, buttonVariants } from "../ui";

/** What `/gigs/[id]/donate` loads. */
type DonateGig = NonNullable<Awaited<ReturnType<typeof donateGig>>>;

/**
 * The donate page: the poster filling the screen and one glass panel with
 * three suggested amounts, a custom one, and the button out to Stripe. Laid
 * out like the photo signup page, so it fits a phone without scrolling and
 * holds the poster sharp beside the panel on a wide screen.
 */
export function DonatePage({
  gig,
  thankedCents,
}: {
  gig: DonateGig;
  /** Set when Stripe has just sent them back paid. */
  thankedCents: number | null;
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
            {thankedCents !== null ? (
              <Thanks gig={gig} cents={thankedCents} />
            ) : (
              <>
                <p className="t-label text-[10px] text-[var(--site-accent-text)]">
                  Support the night
                </p>
                <h1 className="t-display text-[30px] [overflow-wrap:anywhere]">
                  {gig.title}
                </h1>
                <p className="text-[15px] leading-relaxed text-white/75">
                  Donations pay the artists and keep the door cheap, so anyone
                  can come. Chip in and help keep nights like this going.
                </p>
                <DonateForm gig={gig} />
              </>
            )}
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

/** Three suggestions or a custom amount, then off to Stripe. */
function DonateForm({ gig }: { gig: DonateGig }) {
  const id = useId();
  // The recommended suggestion starts picked. Without one, nothing does.
  const [picked, setPicked] = useState<number | "custom" | null>(
    gig.recommendedIndex,
  );
  const [custom, setCustom] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const checkout = api.donations.checkout.useMutation({
    onSuccess: ({ url }) => window.location.assign(url),
  });

  const cents =
    picked === "custom"
      ? parsePriceToCents(custom)
      : picked === null
        ? null
        : (gig.amountsCents[picked] ?? null);
  // Still pending while the browser leaves for Stripe.
  const busy = checkout.isPending || checkout.isSuccess;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = donationCentsSchema.safeParse(cents);
    if (!parsed.success) {
      return setInvalid(
        picked === null
          ? "Pick an amount."
          : cents === null
            ? "Enter an amount, like 15."
            : (parsed.error.issues[0]?.message ?? "That amount won't work."),
      );
    }
    checkout.mutate({ gigId: gig.id, amountCents: parsed.data });
  };

  const error = invalid ?? checkout.error?.message;

  return (
    <form noValidate onSubmit={submit} className="space-y-3 pt-1">
      <div
        role="radiogroup"
        aria-label="Suggested amounts"
        className="grid grid-cols-3 gap-2"
      >
        {gig.amountsCents.map((amount, index) => {
          const on = picked === index;
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setPicked(index);
                setInvalid(null);
              }}
              className={cn(
                "t-display relative h-16 rounded-full border text-[22px] tabular-nums transition-colors",
                on
                  ? "border-[var(--site-accent)] bg-[var(--site-accent)] text-[var(--site-accent-ink)]"
                  : "border-white/25 bg-black/30 hover:border-white/60",
              )}
            >
              {index === gig.recommendedIndex ? (
                <span className="t-label absolute -top-2 left-1/2 -translate-x-1/2 rounded-[var(--site-r-chip)] bg-white px-1.5 py-[3px] text-[8px] whitespace-nowrap text-black">
                  Most give
                </span>
              ) : null}
              {formatNZDCompact(amount)}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "flex h-14 items-center gap-2 rounded-full border bg-black/30 px-5 focus-within:border-white/70",
          picked === "custom" && error
            ? "border-[var(--site-danger)]"
            : picked === "custom"
              ? "border-white/70"
              : "border-white/25",
        )}
      >
        <label className="sr-only" htmlFor={id}>
          Other amount, in dollars
        </label>
        <span aria-hidden className="text-[16px] text-white/55">
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={custom}
          onFocus={() => setPicked("custom")}
          onChange={(e) => {
            setCustom(e.target.value);
            setPicked("custom");
            setInvalid(null);
          }}
          aria-invalid={picked === "custom" && !!error}
          aria-describedby={error ? `${id}-err` : undefined}
          placeholder="Other amount"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/45"
        />
      </div>

      {error ? (
        <p
          id={`${id}-err`}
          role="alert"
          className="pl-5 text-[13px] text-[var(--site-danger-text)]"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={busy}
        aria-busy={busy}
      >
        <Heart className="size-4 fill-current" aria-hidden />
        {busy
          ? "Opening checkout…"
          : cents !== null && cents > 0
            ? `Donate ${formatNZDCompact(cents)}`
            : "Donate"}
      </Button>
      <p className="text-center text-[12px] leading-snug text-white/50">
        Secure checkout with Stripe. Apple Pay, Google Pay or card.
      </p>
    </form>
  );
}

/** After Stripe sends them back paid. */
function Thanks({ gig, cents }: { gig: DonateGig; cents: number }) {
  return (
    <div role="status" className="space-y-4">
      <p className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--site-accent)] text-[var(--site-accent-ink)]">
          <Heart className="size-5 fill-current" />
        </span>
        <span className="t-display text-[24px]">Thank you</span>
      </p>
      <p className="text-[15px] leading-relaxed text-white/75">
        Your{" "}
        <b className="font-semibold text-white">{formatNZDCompact(cents)}</b>{" "}
        helps keep nights like this going. We really appreciate it.
      </p>
      <div className="flex gap-2">
        <Link
          href={gig.gigHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-10 flex-1",
          )}
        >
          Back to the gig
        </Link>
        <Link
          href="/gigs"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-10 flex-1",
          )}
        >
          Upcoming gigs
        </Link>
      </div>
    </div>
  );
}
