"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

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
    <section className={cn("mt-16 sm:mt-20", className)} aria-labelledby="newsletter-heading">
      <h2
        id="newsletter-heading"
        className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4"
      >
        Join the newsletter
      </h2>

      <div className="rounded-xl border border-white/15 bg-white/5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-white/60 md:max-w-xl">
            Get updates on upcoming gigs, new releases, and Atmos news.
          </p>

          {subscribed ? (
            <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3 md:max-w-xl">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/90">Thanks for joining.</p>
                <p className="text-sm text-white/60">We can’t wait for you to see our stuff.</p>
              </div>
              <motion.span
                aria-hidden="true"
                className="text-3xl leading-none"
                initial={{ scale: 0.9, rotate: -10, y: 0 }}
                animate={{ scale: [0.9, 1.15, 1], rotate: [-10, 8, 0], y: [0, -3, 0] }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                👍
              </motion.span>
            </div>
          ) : (
            <form
              className="flex w-full flex-col gap-3 sm:flex-row md:max-w-xl"
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
                    text: "Couldn’t subscribe right now — please try again.",
                  });
                }
              }}
            >
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address"
                required
                className="bg-black/30 border-white/20 text-white placeholder:text-white/40"
              />

              <Button
                type="submit"
                variant="outline"
                disabled={newsletterSubscribe.isPending}
                className="border-white/20 text-white hover:bg-white/10"
              >
                {newsletterSubscribe.isPending ? "Joining…" : "Join"}
              </Button>
            </form>
          )}
        </div>

        {message ? (
          <p
            className={cn(
              "mt-4 text-sm",
              message.type === "error" ? "text-red-300/90" : "text-white/70",
            )}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
