import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ticket terms",
  description:
    "Terms of sale for tickets bought through Atmos Media, including refunds, entry conditions and privacy.",
  robots: { index: true, follow: true },
};

/**
 * Terms of ticket sale, version v1.
 *
 * `TicketOrder.termsVersion` records which version a buyer agreed to. If these
 * change materially, bump the version on the event rather than editing this
 * page in place, so historical orders still point at what was actually agreed.
 */
export default function TicketTermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8">
      <h1 className="text-4xl font-bold tracking-tight text-white">
        Ticket terms
      </h1>
      <p className="mt-2 text-sm text-white/40">Version v1</p>

      <div className="mt-10 space-y-8 text-white/70">
        <Section title="1. Buying a ticket">
          <p>
            Tickets are sold by Atmos Media. All prices are in New Zealand
            dollars and include GST. Any booking fee is shown before you pay and
            forms part of the total.
          </p>
          <p>
            Your ticket is confirmed once payment succeeds and we issue it. A
            reservation held during checkout is not a ticket until that happens.
          </p>
        </Section>

        <Section title="2. Refunds and exchanges">
          <p>
            We don&apos;t refund tickets because your plans changed. Please be
            sure before you buy.
          </p>
          <p>
            If an event is cancelled, we refund the full amount you paid,
            including the booking fee, to the card you used. If an event is
            materially changed — a different date, or a venue that changes the
            nature of the event — you may request a refund by contacting us
            before the event.
          </p>
          <p>
            Nothing here limits your rights under the Consumer Guarantees Act
            1993 or the Fair Trading Act 1986.
          </p>
        </Section>

        <Section title="3. Entry">
          <p>
            Each ticket admits one person once. The first scan of a QR code is
            the one that gets in — if you share or forward a ticket you intend
            to use yourself, you may be refused entry.
          </p>
          <p>
            Most of our events are R18. Where an event is marked R18 you must be
            18 or over and able to show acceptable photo ID. No ID, no entry, no
            refund.
          </p>
          <p>
            Entry is subject to the venue&apos;s conditions and the law,
            including the Sale and Supply of Alcohol Act 2012. We and the venue
            may refuse entry to, or remove, anyone who is intoxicated,
            threatening, or behaving unsafely. No refund is given in those
            circumstances.
          </p>
          <p>
            Unless an event says otherwise, leaving the venue ends your
            admission — there are no pass-outs.
          </p>
        </Section>

        <Section title="4. Lost tickets">
          <p>
            Your tickets always live at the link we email you, and you can have
            that email re-sent from the ticket page. If you lose access to the
            email address you bought with, contact us and we&apos;ll sort it
            out.
          </p>
        </Section>

        <Section title="5. Cancelled or rescheduled events">
          <p>
            Events can be affected by things outside our control. If we have to
            cancel, we&apos;ll email everyone who bought a ticket and refund in
            full. If we reschedule, your ticket is valid for the new date, and
            you can request a refund instead.
          </p>
        </Section>

        <Section title="6. Recording and photography">
          <p>
            Our events are often photographed or filmed. By attending, you
            accept that you may appear in that footage and that we may use it to
            promote future events.
          </p>
        </Section>

        <Section title="7. Your information">
          <p>
            To sell you a ticket we collect your name, email address and payment
            details, and we record when your ticket is scanned at the door. We
            use that to issue and deliver your tickets, manage entry, and handle
            refunds and support.
          </p>
          <p>
            Payments are processed by Stripe, email is delivered by Resend, and
            files are stored with Amazon Web Services — which means some of your
            information is held overseas under comparable privacy safeguards. We
            handle it in line with the Privacy Act 2020 and our{" "}
            <a href="/privacy" className="underline underline-offset-2">
              privacy policy
            </a>
            .
          </p>
          <p>
            We only email you about future events if you asked us to. You can
            unsubscribe at any time, and that never affects tickets you&apos;ve
            already bought.
          </p>
        </Section>

        <Section title="8. Reselling">
          <p>
            Don&apos;t resell tickets above face value. We may cancel tickets we
            reasonably believe have been resold for profit, without a refund.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about a ticket or an order — get in touch through our{" "}
            <a href="/contact" className="underline underline-offset-2">
              contact page
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
