"use client";

import { useEffect } from "react";
import { useThemeOverride } from "~/components/theme-overide-provider";
import Link from "next/link";

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 md:px-8">
      {children}
    </div>
  );
}

export default function TicketTermsPage() {
  const { setForcedTheme } = useThemeOverride();

  useEffect(() => {
    setForcedTheme("light");
    return () => {
      setForcedTheme(undefined);
    };
  }, [setForcedTheme]);

  return (
    <main className="min-h-content bg-white text-black">
      {/* Background accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-linear-to-tr from-indigo-300 via-fuchsia-300 to-cyan-200 opacity-40 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-64 w-64 translate-x-16 translate-y-16 rounded-full bg-linear-to-tr from-cyan-200 via-emerald-200 to-lime-200 opacity-40 blur-3xl" />
      </div>

      <section className="relative z-10 px-4 pt-12 pb-12">
        <Container>
          <div className="mb-8">
            <Link
              href="/"
              className="text-sm text-gray-600 transition-colors hover:text-black"
            >
              ← Back to Home
            </Link>
          </div>

          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Ticket Terms
          </h1>
          <p className="mb-8 text-sm text-gray-600 sm:text-base">Version v1</p>

          <div className="prose prose-gray max-w-none space-y-8">
            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                1. Buying a ticket
              </h2>
              <p className="mb-4 leading-relaxed text-gray-700">
                Tickets are sold by Atmos Media. All prices are in New Zealand
                dollars and include GST. Any booking fee is shown before you pay
                and forms part of the total.
              </p>
              <p className="leading-relaxed text-gray-700">
                Your ticket is confirmed once payment succeeds and we issue it.
                A reservation held during checkout is not a ticket until that
                happens.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                2. Refunds and exchanges
              </h2>
              <p className="mb-4 leading-relaxed text-gray-700">
                We don&apos;t refund tickets because your plans changed. Please
                be sure before you buy.
              </p>
              <p className="mb-4 leading-relaxed text-gray-700">
                If an event is cancelled, we refund the full amount you paid,
                including the booking fee, to the card you used. If an event is
                materially changed — a different date, or a venue that changes
                the nature of the event — you may request a refund by contacting
                us before the event.
              </p>
              <p className="leading-relaxed text-gray-700">
                Nothing here limits your rights under the Consumer Guarantees
                Act 1993 or the Fair Trading Act 1986.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">3. Entry</h2>
              <p className="mb-4 leading-relaxed text-gray-700">
                Each ticket admits one person once. The first scan of a QR code
                is the one that gets in — if you share or forward a ticket you
                intend to use yourself, you may be refused entry.
              </p>
              <p className="mb-4 leading-relaxed text-gray-700">
                Most of our events are R18. Where an event is marked R18 you
                must be 18 or over and able to show acceptable photo ID. No ID,
                no entry, no refund.
              </p>
              <p className="mb-4 leading-relaxed text-gray-700">
                Entry is subject to the venue&apos;s conditions and the law,
                including the Sale and Supply of Alcohol Act 2012. We and the
                venue may refuse entry to, or remove, anyone who is intoxicated,
                threatening, or behaving unsafely. No refund is given in those
                circumstances.
              </p>
              <p className="leading-relaxed text-gray-700">
                Unless an event says otherwise, leaving the venue ends your
                admission — there are no pass-outs.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">4. Lost tickets</h2>
              <p className="leading-relaxed text-gray-700">
                Your tickets always live at the link we email you, and you can
                have that email re-sent from the ticket page. If you lose access
                to the email address you bought with, contact us and we&apos;ll
                sort it out.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                5. Cancelled or rescheduled events
              </h2>
              <p className="leading-relaxed text-gray-700">
                Events can be affected by things outside our control. If we have
                to cancel, we&apos;ll email everyone who bought a ticket and
                refund in full. If we reschedule, your ticket is valid for the
                new date, and you can request a refund instead.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                6. Recording and photography
              </h2>
              <p className="leading-relaxed text-gray-700">
                Our events are often photographed or filmed. By attending, you
                accept that you may appear in that footage and that we may use
                it to promote future events.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                7. Your information
              </h2>
              <p className="mb-4 leading-relaxed text-gray-700">
                To sell you a ticket we collect your name, email address and
                payment details, and we record when your ticket is scanned at
                the door. We use that to issue and deliver your tickets, manage
                entry, and handle refunds and support.
              </p>
              <p className="mb-4 leading-relaxed text-gray-700">
                Payments are processed by Stripe, email is delivered by Resend,
                and files are stored with Amazon Web Services — which means some
                of your information is held overseas under comparable privacy
                safeguards. We handle it in line with the Privacy Act 2020 and
                our{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  privacy policy
                </Link>
                .
              </p>
              <p className="leading-relaxed text-gray-700">
                We only email you about future events if you asked us to. You
                can unsubscribe at any time, and that never affects tickets
                you&apos;ve already bought.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">8. Reselling</h2>
              <p className="leading-relaxed text-gray-700">
                Don&apos;t resell tickets above face value. We may cancel
                tickets we reasonably believe have been resold for profit,
                without a refund.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">9. Contact</h2>
              <p className="mb-4 leading-relaxed text-gray-700">
                Questions about a ticket or an order — get in touch:
              </p>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-gray-700">
                  <strong>Website:</strong>{" "}
                  <Link
                    href="/contact"
                    className="text-blue-600 hover:underline"
                  >
                    Contact Page
                  </Link>
                </p>
              </div>
            </section>
          </div>
        </Container>
      </section>
    </main>
  );
}
