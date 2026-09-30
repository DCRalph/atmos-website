"use client";

import { NewsletterForm } from "../newsletter-form";

/** Inline "Join the atmosphere" signup that closes the home page. */
export function HomeNewsletter() {
  return (
    <section
      aria-labelledby="home-newsletter"
      className="grid grid-cols-1 gap-8 border-t border-white/10 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-10"
    >
      <h2
        id="home-newsletter"
        className="t-heading text-[clamp(2.1rem,7.5vw,6rem)]"
      >
        Join the{" "}
        <span className="text-[var(--site-accent-text)]">atmosphere</span>
      </h2>
      <div className="space-y-5">
        <p className="max-w-[44ch] text-[15px] text-white/70">
          10% off merch, and first word on upcoming gigs.
        </p>
        <NewsletterForm />
      </div>
    </section>
  );
}
