"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Mail, CheckCircle2 } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { orbitron } from "~/lib/fonts";

export function NewsletterSection({ className }: { className?: string }) {
  const newsletterSubscribe = api.newsletter.subscribe.useMutation();

  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState<
    | { type: "success"; text: string }
    | { type: "error"; text: string }
    | null
  >(null);

  return (
    <section className={cn("relative mt-16 sm:mt-20", className)} aria-labelledby="newsletter-heading">
      {/* <h2
        id="newsletter-heading"
        className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}`}
      >
        Join the newsletter
      </h2> */}

      <div className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}" />

      {/* Decorative background elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/10 via-white/5 to-white/2 p-8 sm:p-12 lg:p-16 backdrop-blur-sm">
        {/* Content */}
        <div className="mx-auto max-w-3xl text-center">
          {/* Icon and heading */}
          {/* <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20">
              <Mail className="h-8 w-8 text-white/90" />
            </div>
          </div> */}

          <h3
            className={`mb-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight ${orbitron.className}`}
          >
            Stay in the Loop
          </h3>

          <p className="mb-8 text-base sm:text-lg text-white/70 max-w-2xl mx-auto">
            Get updates on upcoming gigs, new releases, and Atmos news delivered straight to your inbox.
          </p>

          {/* Subscription form or success state */}
          {subscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mx-auto max-w-md"
            >
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/20 bg-linear-to-br from-white/10 to-white/5 p-8 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  </div>
                </motion.div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white/90 mb-1">You're all set!</p>
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
                  className="flex-1 bg-black/40 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-white/20 h-12 text-base"
                />

                <Button
                  type="submit"
                  variant="outline"
                  disabled={newsletterSubscribe.isPending}
                  className="h-12 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/40 font-semibold px-6 transition-all"
                >
                  {newsletterSubscribe.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Joining…
                    </span>
                  ) : (
                    "Subscribe"
                  )}
                </Button>
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
