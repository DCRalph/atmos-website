"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

import { AtmosLogo, Button } from "~/components/site/ui";
import { cn } from "~/lib/utils";
import { BasicThanks, Celebration, DonationAsk } from "./experience";
import { CELEBRATION_MS, experiences, type ExperienceId } from "./examples";
import { useReducedMotion } from "./use-reduced-motion";
import styles from "./donations.module.css";

/** One mounted experience at a time. A new run remounts its finite CSS timeline. */
export function DonationBoard({
  initialExperience,
  initialAmountCents,
}: {
  initialExperience: ExperienceId;
  initialAmountCents: number;
}) {
  const router = useRouter();
  const [experience, setExperience] = useState(initialExperience);
  const [phase, setPhase] = useState<"ask" | "playing" | "thanks">("ask");
  const [amountCents, setAmountCents] = useState(initialAmountCents);
  const [run, setRun] = useState(0);
  const [previewReducedMotion, setPreviewReducedMotion] = useState(false);
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = previewReducedMotion || systemReducedMotion;
  const thanksHref = `/ui-test/donations/thanks?experience=${experience}&amount=${amountCents}${reducedMotion ? "&motion=reduced" : ""}`;
  const selected =
    experiences.find((item) => item.id === experience) ?? experiences[0];

  useEffect(() => {
    if (experience !== "basic") router.prefetch(thanksHref);
  }, [router, thanksHref, experience]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setTimeout(
      () => router.push(thanksHref, { scroll: true }),
      reducedMotion ? 0 : CELEBRATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, run, reducedMotion, router, thanksHref]);

  const play = () => {
    setRun((previous) => previous + 1);
    if (experience === "basic") {
      setPhase("thanks");
      return;
    }
    if (reducedMotion) {
      router.push(thanksHref, { scroll: true });
      return;
    }
    setPhase("playing");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <main className={styles.playground} data-phase={phase}>
      <div inert={phase === "playing"}>
        <header className={styles.toolbar}>
          <div className={styles.toolbarTop}>
            <div className={styles.boardTitle}>
              <AtmosLogo className="w-20" eager />
              <h1>Donation experiences</h1>
            </div>
            <p className={styles.demoNote}>Interactive demos. No payments.</p>
          </div>

          <div className={styles.toolbarControls}>
            <nav className={styles.experienceNav} aria-label="Experience">
              {experiences.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={cn("t-label", styles.experienceButton)}
                  aria-pressed={experience === item.id}
                  onClick={() => {
                    setExperience(item.id);
                    setPhase("ask");
                    const url = new URL(window.location.href);
                    url.searchParams.set("experience", item.id);
                    window.history.replaceState(null, "", url);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className={styles.playbackControls}>
              <label className={styles.motionToggle}>
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  disabled={systemReducedMotion === true}
                  onChange={(event) =>
                    setPreviewReducedMotion(event.target.checked)
                  }
                />
                Reduced motion
              </label>
              <Button variant="outline" size="sm" onClick={play}>
                <Play className="size-3.5" aria-hidden />
                {experience === "basic"
                  ? phase === "thanks"
                    ? "Replay thank you"
                    : "Preview thank you"
                  : `Play ${CELEBRATION_MS / 1000} seconds`}
              </Button>
              {phase === "thanks" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPhase("ask")}
                >
                  Start again
                </Button>
              ) : null}
            </div>
          </div>
          <p className={styles.directionNote}>{selected.description}</p>
        </header>

        <div className={styles.stage}>
          {experience === "basic" && phase === "thanks" ? (
            <BasicThanks
              key={run}
              amountCents={amountCents}
              reducedMotion={reducedMotion}
            />
          ) : (
            <DonationAsk
              experience={experience}
              amountCents={amountCents}
              onAmountChange={setAmountCents}
              onDonate={play}
            />
          )}
        </div>
      </div>

      {phase === "playing" ? (
        <Celebration
          key={run}
          experience={experience}
          amountCents={amountCents}
          onSkip={() => router.push(thanksHref, { scroll: true })}
        />
      ) : null}
    </main>
  );
}
