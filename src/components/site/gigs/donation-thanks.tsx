"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Heart, Link2, Share2 } from "lucide-react";

import { env } from "~/env";
import { formatNZDCompact } from "~/lib/ticketing/money";
import { Button, buttonVariants } from "../ui";
import styles from "./donation-thanks.module.css";

type DonationGig = { title: string; gigHref: string };

/** A one-second thank-you, shown only after the donation page confirms payment. */
export function DonationThanks({
  gig,
  cents,
  reducedMotion = false,
}: {
  gig: DonationGig;
  cents: number;
  /** Allows the development preview to demonstrate the reduced-motion state. */
  reducedMotion?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className={styles.thanks} data-reduced-motion={reducedMotion}>
      <div className={styles.heading}>
        <span className={styles.heart} aria-hidden>
          <span className={styles.burst}>
            {Array.from({ length: 8 }, (_, index) => (
              <span
                key={index}
                style={{ transform: `rotate(${index * 45 + 15}deg)` }}
              >
                <i />
              </span>
            ))}
          </span>
          <Heart className="size-5 fill-current" />
        </span>
        <h1 ref={heading} tabIndex={-1} className="t-display">
          Thank you
        </h1>
      </div>
      <p className={styles.copy}>
        Your <strong>{formatNZDCompact(cents)}</strong> helps keep nights like
        this going. We really appreciate it.
      </p>
      <ShareDonation gig={gig} />
      <div className={styles.returnLinks}>
        <Link
          href={gig.gigHref}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to the gig
        </Link>
        <Link
          href="/gigs"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Upcoming gigs
        </Link>
      </div>
    </div>
  );
}

/** Share the public ask, excluding the donor's amount and Stripe return parameters. */
function ShareDonation({ gig }: { gig: DonationGig }) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const [sharing, setSharing] = useState(false);
  const url = new URL(`${gig.gigHref}/donate`, env.NEXT_PUBLIC_APP_URL).href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("copied");
    } catch {
      setFeedback("manual");
    }
  };

  const share = async () => {
    if (!navigator.share) return copy();
    setSharing(true);
    setFeedback("idle");
    try {
      await navigator.share({
        title: `Support ${gig.title}`,
        text: `I’m supporting ${gig.title}. Chip in if you’d like to help keep nights like this going.`,
        url,
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        await copy();
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className={styles.shareArea}>
      <div className={styles.shareButtons}>
        <Button
          variant="accent"
          size="md"
          onClick={share}
          disabled={sharing}
          aria-busy={sharing}
        >
          <Share2 className="size-4" aria-hidden />
          Share the love
        </Button>
        <Button variant="outline" size="md" onClick={copy}>
          {feedback === "copied" ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {feedback === "copied" ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p className={styles.shareFeedback} role="status">
        {feedback === "copied"
          ? "Link copied. Thanks for spreading the love."
          : feedback === "manual"
            ? "Select and copy the link below."
            : "Just the donation link. Your amount stays private."}
      </p>
      {feedback === "manual" ? (
        <label className={styles.manualLink}>
          <Link2 className="size-4" aria-hidden />
          <span className="sr-only">Donation link to copy</span>
          <input
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      ) : null}
    </div>
  );
}
