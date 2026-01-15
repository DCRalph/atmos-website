"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { orbitron } from "~/lib/fonts";

export function NewsletterSection({ className }: { className?: string }) {
  const newsletterSubscribe = api.newsletter.subscribe.useMutation();
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState<
    | { type: "success"; text: string }
    | { type: "error"; text: string }
    | null
  >(null);

  const playSubscribeSound = () => {
    try {
      const AudioContextCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const ctx = audioCtxRef.current ?? new AudioContextCtor();
      audioCtxRef.current = ctx;

      // Ensure context is running (some browsers start suspended)
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";

      const t0 = ctx.currentTime;
      // A quick “pop” pitch bend.
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.exponentialRampToValueAtTime(440, t0 + 0.08);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0);
      osc.stop(t0 + 0.13);
    } catch {
      // Non-critical: ignore audio failures.
    }
  };

  return (
    <section className={cn("relative mt-16 sm:mt-20", className)} aria-labelledby="newsletter-heading">
      {/* <h2
        id="newsletter-heading"
        className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}`}
      >
        Join the newsletter
      </h2> */}

      <div className="mb-6 sm:mb-8 border-b-2 border-white/10 pb-3 sm:pb-4" />


      <div className="group relative overflow-hidden rounded-none border-2 border-white/10 bg-black/90 p-8 sm:p-12 lg:p-16 backdrop-blur-sm transition-all hover:border-accent-muted/50">
        {/* Red accent bar */}
        <div className="absolute left-0 top-0 h-2 w-32 bg-accent-muted transition-all group-hover:w-48" />
        <div className="absolute right-0 top-0 h-2 w-32 bg-accent-muted transition-all group-hover:w-48" />

        {/* Content */}
        <div className="mx-auto max-w-3xl text-center">
          {/* Icon and heading */}
          {/* <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20">
              <Mail className="h-8 w-8 text-white/90" />
            </div>
          </div> */}

          <h3
            className={`mb-4 text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight ${orbitron.className}`}
          >
            Enter the <span>atmos</span><span className="text-accent-muted italic">phere</span>
          </h3>

          <p className="mb-8 text-base sm:text-lg text-white/70 max-w-2xl mx-auto">
            Be the first to here about our next events, get 5% off merch and everuthing else atmos straight to your inbox.
          </p>

          {/* Subscription form or success state */}
          {subscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mx-auto max-w-md"
            >
              <div className="flex flex-col items-center gap-4 rounded-none border-2 border-accent-muted/50 bg-black/60 p-8 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-none border-2 border-accent-muted bg-accent-muted/20">
                    <CheckCircle2 className="h-8 w-8 text-accent-muted" />
                  </div>
                </motion.div>
                <div className="text-center">
                  <p className="text-lg font-black uppercase tracking-wide text-white mb-1">You're all set!</p>
                  <p className="text-sm text-white/60">
                    Thanks for joining. We can't wait to share our latest updates with you.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <form
              className="mx-auto max-w-lg"
              onSubmit={async (e) => {
                e.preventDefault();
                setMessage(null);

                try {
                  await newsletterSubscribe.mutateAsync({ email });
                  playSubscribeSound();
                  setSubscribed(true);
                  setEmail("");
                } catch {
                  setMessage({
                    type: "error",
                    text: "Couldn't subscribe right now — please try again.",
                  });
                }
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email address"
                  required
                  className="flex-1 rounded-none border-2 border-white/20 bg-black/60 text-white placeholder:text-white/40 focus:border-accent-muted focus:ring-accent-muted/20 h-12 text-base"
                />

                <button
                  type="submit"
                  disabled={newsletterSubscribe.isPending}
                  className="h-12 rounded-none border-2 border-accent-muted bg-accent-muted px-6 text-sm font-black uppercase tracking-wider text-white transition-all hover:bg-[#DC2626] hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {newsletterSubscribe.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Joining…
                    </span>
                  ) : (
                    "Subscribe"
                  )}
                </button>
              </div>

              {message && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-4 text-sm text-center",
                    message.type === "error" ? "text-red-300/90" : "text-white/70",
                  )}
                >
                  {message.text}
                </motion.p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
