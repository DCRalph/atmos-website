"use client";

import posthog from "posthog-js";
import { ContactForm } from "~/components/site/contact/contact-form";
import { CONTACT } from "~/lib/site-constants";

/** Contact page: the form is the way in, with email as a quiet fallback beneath it. Held to a centred column on wide screens. */
export default function ContactPage() {
  return (
    <main className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-white/10 px-5 pt-12 pb-10 md:px-10 md:pt-20 md:pb-14">
        <h1 className="t-heading text-[clamp(2.75rem,9vw,5.5rem)]">
          Hit us up
        </h1>
        <p className="max-w-[36ch] text-[16px] text-white/70 md:pb-2 md:text-[17px]">
          Bookings, collabs, questions. Send us a message.
        </p>
      </div>

      <section className="grid gap-8 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-12">
        <h2 className="t-heading text-[clamp(1.75rem,4vw,2.75rem)]">
          Drop us a line
        </h2>
        <div>
          <ContactForm />
          <p className="mt-8 text-[13px] text-white/50">
            Can&apos;t use the form? Email{" "}
            <a
              href={`mailto:${CONTACT.email}`}
              onClick={() =>
                posthog.capture("contact_link_clicked", { type: "email" })
              }
              className="underline underline-offset-4 hover:text-white"
            >
              {CONTACT.email}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
