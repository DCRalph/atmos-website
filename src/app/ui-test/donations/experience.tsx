"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Heart,
  Link2,
  RotateCcw,
  Share2,
} from "lucide-react";

import { AtmosLogo, Button } from "~/components/site/ui";
import { DonationThanks as DonationThankYou } from "~/components/site/gigs/donation-thanks";
import { formatNZDCompact } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";
import { upcomingGigs } from "../design/fixtures";
import {
  CELEBRATION_MS,
  experiences,
  sampleAmounts,
  type ExperienceId,
} from "./examples";
import { useReducedMotion } from "./use-reduced-motion";
import styles from "./donations.module.css";
const gig = upcomingGigs[0];
const gigHref = `/gigs/${gig.slug}`;
// Always share the public ask, never a test URL or Stripe's return parameters.
const donationUrl = `https://atmosmedia.co.nz${gigHref}/donate`;
const celebrationStyle: CSSProperties & { "--sequence-duration": string } = {
  "--sequence-duration": `${CELEBRATION_MS}ms`,
};

function Backdrop({ experience }: { experience: ExperienceId }) {
  return (
    <div className={styles.backdrop} aria-hidden>
      <Image
        src={experience === "encore" ? "/home/atmos-46.jpg" : gig.poster}
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className={cn(
          styles.backdropImage,
          experience === "encore" && styles.photoBackdrop,
        )}
      />
    </div>
  );
}

function Poster({ className }: { className?: string }) {
  return (
    <Image
      src={gig.poster}
      alt={`${gig.title} poster`}
      width={820}
      height={1024}
      priority
      unoptimized
      sizes="(min-width: 768px) 400px, 240px"
      className={cn(styles.poster, className)}
    />
  );
}

/** The poster and payment panel shared by the ask and the restrained thank-you. */
function DonationFrame({
  experience,
  children,
}: {
  experience: ExperienceId;
  children: ReactNode;
}) {
  return (
    <div className={styles.ask} data-basic={experience === "basic"}>
      <Backdrop experience={experience} />
      <figure className={styles.askArtwork}>
        <Poster />
        <figcaption>{gig.venue} · broderbeats</figcaption>
      </figure>
      <div className={styles.panelColumn}>
        <section className={cn("glass-dark", styles.askPanel)}>
          {children}
        </section>
        {experience === "basic" ? (
          <Link href="/" className={styles.basicBrand} aria-label="Atmos home">
            <AtmosLogo />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** The start of each demo, so the celebration follows an intentional donation. */
export function DonationAsk({
  experience,
  amountCents,
  onAmountChange,
  onDonate,
}: {
  experience: ExperienceId;
  amountCents: number;
  onAmountChange: (cents: number) => void;
  onDonate: () => void;
}) {
  return (
    <DonationFrame experience={experience}>
      {experience === "basic" ? (
        <>
          <p className={cn("t-label", styles.basicLabel)}>Support the night</p>
          <h2 className={cn("t-display", styles.askTitle)}>{gig.title}</h2>
        </>
      ) : (
        <>
          <h2 className={cn("t-display", styles.askTitle)}>
            Support the night.
          </h2>
          <p className={styles.gigName}>{gig.title}</p>
        </>
      )}
      <p className={styles.bodyCopy}>
        A little from you helps keep nights like this going.
      </p>
      <fieldset className={styles.amounts}>
        <legend>Choose your contribution</legend>
        <div>
          {sampleAmounts.map((cents) => (
            <button
              key={cents}
              type="button"
              className="t-label"
              aria-pressed={cents === amountCents}
              onClick={() => onAmountChange(cents)}
            >
              {formatNZDCompact(cents)}
            </button>
          ))}
        </div>
      </fieldset>
      <Button
        variant="accent"
        size="lg"
        className={styles.donateButton}
        onClick={onDonate}
      >
        <Heart className="size-4 fill-current" aria-hidden />
        Try donating {formatNZDCompact(amountCents)}
      </Button>
      <p className={styles.sampleNote}>
        {experience === "basic"
          ? "Sample donation. Plays a 1-second thank you."
          : `Sample donation. Plays a ${CELEBRATION_MS / 1000}-second thank you.`}
      </p>
    </DonationFrame>
  );
}

/** Preview the same component used after a real donation. */
export function BasicThanks({
  amountCents,
  reducedMotion = false,
}: {
  amountCents: number;
  reducedMotion?: boolean;
}) {
  return (
    <DonationFrame experience="basic">
      <DonationThankYou
        gig={{ title: gig.title, gigHref }}
        cents={amountCents}
        reducedMotion={reducedMotion}
      />
    </DonationFrame>
  );
}

function SupporterPass({ stamped = true }: { stamped?: boolean }) {
  return (
    <div className={styles.supporterPass}>
      <div className={styles.passHeader}>
        <AtmosLogo className="w-20" />
        <span className="t-label">With love from the crew</span>
      </div>
      <Poster />
      <div className={styles.passFooter}>
        <span className="t-display">You backed the night.</span>
        <Heart className="fill-current" aria-hidden />
      </div>
      {stamped ? (
        <div className={cn("t-display", styles.stamp)} aria-hidden>
          Big
          <br />
          love
        </div>
      ) : null}
    </div>
  );
}

/** Native sharing when supported; copying and a selectable link work everywhere else. */
function ShareActions({ compact = false }: { compact?: boolean }) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const [sharing, setSharing] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(donationUrl);
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
        url: donationUrl,
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
      {compact ? null : (
        <>
          <h3>Good nights travel.</h3>
          <p>Pass this on to someone who loves the scene.</p>
        </>
      )}
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
      <p className={styles.shareFeedback} role="status" aria-live="polite">
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
            value={donationUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      ) : null}
    </div>
  );
}

/** A dedicated supporter page: the donation form and demo toolbar are gone. */
export function DonationThanks({
  experience,
  amountCents,
  previewReducedMotion = false,
}: {
  experience: ExperienceId;
  amountCents: number;
  previewReducedMotion?: boolean;
}) {
  const [replaying, setReplaying] = useState(false);
  const [run, setRun] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = previewReducedMotion || systemReducedMotion;
  const selected =
    experiences.find((item) => item.id === experience) ?? experiences[0];

  useEffect(() => {
    if (!replaying) {
      headingRef.current?.focus({ preventScroll: true });
      return;
    }
    const timer = window.setTimeout(
      () => setReplaying(false),
      reducedMotion ? 0 : CELEBRATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [replaying, run, reducedMotion]);

  return (
    <main
      className={cn(styles.playground, styles.donorPage)}
      data-destination="thanks"
      data-phase={replaying ? "playing" : "thanks"}
      data-experience={experience}
      data-reduced-motion={reducedMotion}
    >
      <div inert={replaying}>
        <header className={styles.donorHeader}>
          <Link href="/" aria-label="Atmos home">
            <AtmosLogo className="w-28" eager />
          </Link>
          <span className={styles.demoNote}>
            Sample donation · Thank-you preview
          </span>
        </header>

        <div className={styles.donorHero}>
          <section className={styles.donorMessage}>
            <Heart className={styles.donorHeart} aria-hidden />
            <h1
              ref={headingRef}
              tabIndex={-1}
              className={cn("t-display", styles.donorTitle)}
            >
              {selected.headline}
            </h1>
            <p className={styles.donorCopy}>
              Your <strong>{formatNZDCompact(amountCents)}</strong> for{" "}
              <strong>{gig.headline}</strong> means a lot. Thanks for helping
              keep nights like this going.
            </p>
            <p className={styles.donorSignoff}>Big love, the Atmos crew.</p>
          </section>

          <figure className={styles.donorMedia}>
            <Image
              src="/home/atmos-46.jpg"
              alt="An Atmos DJ playing to the room under the stage lights"
              fill
              priority
              sizes="(min-width: 900px) 48vw, 100vw"
              className={styles.donorPhoto}
            />
            <div className={styles.donorMemento}>
              {experience === "supporter-pass" ? <SupporterPass /> : <Poster />}
            </div>
            <figcaption className={cn("t-label", styles.donorPhotoCaption)}>
              Made better
              <br />
              by you.
            </figcaption>
          </figure>
        </div>

        <div className={styles.donorReceipt}>
          <p className={styles.received}>
            <Check className="size-4" aria-hidden />
            {formatNZDCompact(amountCents)} received. Thank you.
          </p>
          <span>
            {gig.title} · {gig.venue}
          </span>
        </div>

        <section className={styles.donorShare} aria-label="Share your support">
          <div>
            <h2 className="t-display">
              A little love.
              <br />A little louder.
            </h2>
            <p>There’s room for your people in this story too.</p>
          </div>
          <ShareActions />
        </section>

        <footer className={styles.donorFooter}>
          <Link href={gigHref}>
            <ArrowLeft className="size-4" aria-hidden />
            Back to the gig
          </Link>
          <Link href="/gigs">
            Find your next night
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <div className={styles.donorDemoControls}>
            <Button
              variant="outline"
              size="sm"
              disabled={reducedMotion}
              onClick={() => {
                setRun((previous) => previous + 1);
                setReplaying(true);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Replay celebration
            </Button>
            <Link
              href={`/ui-test/donations?experience=${experience}&amount=${amountCents}`}
            >
              Try another experience
            </Link>
          </div>
        </footer>
      </div>

      {replaying ? (
        <Celebration
          key={run}
          experience={experience}
          amountCents={amountCents}
          onSkip={() => setReplaying(false)}
        />
      ) : null}
    </main>
  );
}

/** One finite confetti drop, staggered across the viewport without a canvas loop. */
function Confetti() {
  return (
    <div className={styles.confetti}>
      {Array.from({ length: 36 }, (_, index) => (
        <span
          key={index}
          style={{
            left: `${(index * 37) % 100}%`,
            animationDelay: `${1950 + (index % 9) * 70}ms`,
            animationDuration: `${1650 + (index % 5) * 130}ms`,
          }}
        >
          <i style={{ transform: `rotate(${index * 29}deg)` }} />
        </span>
      ))}
    </div>
  );
}

/** A five-second takeover, ending in a blackout before the new page appears. */
export function Celebration({
  experience,
  amountCents,
  onSkip,
}: {
  experience: ExperienceId;
  amountCents: number;
  onSkip: () => void;
}) {
  const skipButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    skipButton.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className={styles.celebration}
      data-experience={experience}
      style={celebrationStyle}
    >
      <p className="sr-only" role="status">
        Sample donation of {formatNZDCompact(amountCents)} received. Thank you
        for supporting {gig.title}.
      </p>
      <div className={styles.sequence} aria-hidden>
        <Confetti />
        {experience === "soundwave" ? (
          <>
            <div className={styles.equalizer}>
              {Array.from({ length: 17 }, (_, index) => (
                <i
                  key={index}
                  style={{ animationDelay: `${150 + index * 35}ms` }}
                />
              ))}
            </div>
            <div className={styles.waves}>
              <i />
              <i />
              <i />
            </div>
            <div className={styles.burst}>
              {Array.from({ length: 24 }, (_, index) => (
                <span
                  key={index}
                  className={styles.sparkRay}
                  style={{ transform: `rotate(${index * 15}deg)` }}
                >
                  <i style={{ animationDelay: `${650 + index * 9}ms` }} />
                </span>
              ))}
            </div>
            <div className={styles.soundwaveCore}>
              <div className={styles.bigHeart}>
                <Heart className="fill-current" />
              </div>
              <p className={cn("t-display", styles.sequenceAmount)}>
                Your {formatNZDCompact(amountCents)}. Thank you.
              </p>
            </div>
            <div className={cn("t-display", styles.waveMessage)}>
              <span>You keep</span>
              <span>the night</span>
              <span>going.</span>
            </div>
            <p className={cn("t-label", styles.waveSignature)}>
              With love, from the crew.
            </p>
          </>
        ) : experience === "supporter-pass" ? (
          <>
            <div className={cn("t-display", styles.passBackdropText)}>
              Part of
              <br />
              the night.
            </div>
            <div className={styles.passArrival}>
              <SupporterPass />
            </div>
            <div className={styles.passThankYou}>
              <p className="t-display">Made better by you.</p>
              <span>
                {formatNZDCompact(amountCents)}. Thank you for backing the
                night.
              </span>
            </div>
          </>
        ) : (
          <>
            <Image
              src="/home/atmos-46.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className={styles.encorePhoto}
            />
            <div className={styles.encoreShade} />
            <div className={styles.stageLights}>
              <i />
              <i />
              <i />
            </div>
            <div className={styles.curtainLeft} />
            <div className={styles.curtainRight} />
            <div className={cn("t-heading", styles.encoreMessage)}>
              <span>Big</span>
              <span>love.</span>
            </div>
            <div className={styles.encoreCaption}>
              <p className="t-display">
                From all of us.
                <br />
                To you.
              </p>
              <span>
                Your {formatNZDCompact(amountCents)} keeps the music going.
              </span>
            </div>
          </>
        )}
        <AtmosLogo className={styles.sequenceLogo} />
      </div>
      <button
        ref={skipButton}
        type="button"
        className={styles.skipButton}
        onClick={onSkip}
        onKeyDown={(event) => {
          if (event.key === "Escape") onSkip();
        }}
      >
        Skip animation
      </button>
    </div>
  );
}
