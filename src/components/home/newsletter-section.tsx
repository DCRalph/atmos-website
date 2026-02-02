"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { orbitron } from "~/lib/fonts";

export function NewsletterSection({ className }: { className?: string }) {
  const newsletterSubscribe = api.newsletter.subscribe.useMutation();
  const subscribeAudioRef = useRef<HTMLAudioElement | null>(null);

  type FieldErrors = {
    email?: string;
  };

  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<
    { type: "success"; text: string } | { type: "error"; text: string } | null
  >(null);

  useEffect(() => {
    // Hint the browser to fetch the audio early.
    subscribeAudioRef.current?.load();
  }, []);

  const playSubscribeSound = () => {
    try {
      const audio = subscribeAudioRef.current;
      if (!audio) return;

      audio.currentTime = 0;
      audio.volume = 0.6;
      void audio.play();
    } catch {
      // Non-critical: ignore audio failures.
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {};

    if (!email.trim()) {
      newErrors.email = "Please enter your email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <section
      className={cn("relative mt-16 sm:mt-24", className)}
      aria-labelledby="newsletter-heading"
    >
      <audio ref={subscribeAudioRef} preload="auto" src="/subscribe.mp3" />
      {/* <h2
        id="newsletter-heading"
        className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}`}
      >
        Join the newsletter
      </h2> */}

      {/* <div className="mb-6 border-b-2 border-white/10 pb-3 sm:mb-8 sm:pb-4" /> */}

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "50% 0px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative"
      >
        {/* Content */}
        <div className="mx-auto max-w-3xl text-center">
          {/* Icon and heading */}
          {/* <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20">
              <Mail className="h-8 w-8 text-white/90" />
            </div>
          </div> */}

          <div className="absolute top-1/2 left-1/2 -z-10 h-1/2 w-2/3 -translate-x-1/2 -translate-y-1/2 bg-white/30 blur-3xl" />

          <h3
            className={`mb-4 text-3xl font-black tracking-tight uppercase sm:text-4xl md:text-5xl ${orbitron.className}`}
          >
            Enter the <span>atmos</span>
            <span className="text-accent-strong italic">phere</span>
          </h3>

          <p className="mx-auto mb-8 max-w-2xl text-base text-white/70 sm:text-lg">
            Get 10% off merch and be the first to find out about our upcoming
            events.
          </p>

          {/* Subscription form or success state */}
          {subscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mx-auto max-w-md"
            >
              <div className="border-accent-muted/50 flex flex-col items-center gap-4 rounded-none border-2 bg-black/60 p-8 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className="border-accent-muted bg-accent-muted/20 flex h-16 w-16 items-center justify-center rounded-none border-2">
                    <CheckCircle2 className="text-accent-muted h-8 w-8" />
                  </div>
                </motion.div>
                <div className="text-center">
                  <p className="mb-1 text-lg font-black tracking-wide text-white uppercase">
                    You're all set!
                  </p>
                  <p className="text-sm text-white/60">
                    Thanks for joining. We can't wait to share our latest
                    updates with you.
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
                if (!validateForm()) return;

                try {
                  await newsletterSubscribe.mutateAsync({
                    email: email.trim(),
                  });
                  playSubscribeSound();
                  setSubscribed(true);
                  setEmail("");
                  setErrors({});
                } catch {
                  setMessage({
                    type: "error",
                    text: "Couldn't subscribe right now — please try again.",
                  });
                }
              }}
            >
              <div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError("email");
                    }}
                    aria-label="Email address"
                    className={cn(
                      "focus:border-accent-muted focus:ring-accent-muted/20 h-16 flex-1 rounded-none border-2 bg-black/60 text-base text-white placeholder:text-white/40",
                      "h-12",
                    )}
                  />

                  <button
                    type="submit"
                    disabled={newsletterSubscribe.isPending}
                    className="border-accent-strong bg-accent-strong hover:border-accent-muted hover:bg-accent-muted h-12 rounded-none border-2 px-6 text-sm font-black tracking-wider text-white uppercase transition-all hover:shadow-[0_0_20px_var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50"
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

                {errors.email && (
                  <p className="mt-2 font-mono text-sm text-red-500">
                    {errors.email}
                  </p>
                )}
              </div>

              {message && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-4 text-center text-sm",
                    message.type === "error"
                      ? "text-red-300/90"
                      : "text-white/70",
                  )}
                >
                  {message.text}
                </motion.p>
              )}
            </form>
          )}

          {/* <Button className="mt-4" onClick={playSubscribeSound}>
            <Play className="h-4 w-4" />
            test sound
          </Button> */}
        </div>
      </motion.div>
    </section>
  );
}
