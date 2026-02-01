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

export default function TermsPage() {
  const { setForcedTheme } = useThemeOverride();

  useEffect(() => {
    setForcedTheme("light");
    return () => {
      setForcedTheme(undefined);
    };
  }, [setForcedTheme]);

  return (
    <main className="min-h-content bg-white text-black h">
      {/* Background accents */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-linear-to-tr from-indigo-300 via-fuchsia-300 to-cyan-200 opacity-40 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-64 w-64 translate-x-16 translate-y-16 rounded-full bg-linear-to-tr from-cyan-200 via-emerald-200 to-lime-200 opacity-40 blur-3xl" />
      </div>

      <section className="relative z-10 px-4 pb-12 pt-12">
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
            Terms and Conditions
          </h1>
          <p className="mb-8 text-sm text-gray-600 sm:text-base">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          <div className="prose prose-gray max-w-none space-y-8">
            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                1. Agreement to Terms
              </h2>
              <p className="leading-relaxed text-gray-700">
                By accessing or using the ATMOS website ("Website") and services
                ("Services"), you agree to be bound by these Terms and
                Conditions ("Terms"). If you do not agree to these Terms, please
                do not use our Website or Services.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                2. Use of the Website
              </h2>
              <h3 className="mt-6 mb-3 text-xl font-semibold">
                2.1 Eligibility
              </h3>
              <p className="leading-relaxed text-gray-700">
                You must be at least 18 years old to use our Services. By using
                our Services, you represent and warrant that you are at least 18
                years of age and have the legal capacity to enter into these
                Terms.
              </p>

              <h3 className="mt-6 mb-3 text-xl font-semibold">
                2.2 Acceptable Use
              </h3>
              <p className="mb-4 leading-relaxed text-gray-700">
                You agree to use our Website and Services only for lawful
                purposes and in accordance with these Terms. You agree not to:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-gray-700">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Transmit any harmful, offensive, or illegal content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the Website or Services</li>
                <li>
                  Use automated systems to access the Website without permission
                </li>
                <li>Impersonate any person or entity</li>
              </ul>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                3. Events and Tickets
              </h2>
              <h3 className="mt-6 mb-3 text-xl font-semibold">
                3.1 Event Information
              </h3>
              <p className="leading-relaxed text-gray-700">
                We strive to provide accurate information about our events,
                including dates, times, locations, and lineups. However, event
                details are subject to change without notice. We reserve the
                right to modify, cancel, or reschedule events at any time.
              </p>

              <h3 className="mt-6 mb-3 text-xl font-semibold">
                3.2 Ticket Sales
              </h3>
              <p className="mb-4 leading-relaxed text-gray-700">
                When purchasing tickets through our Website:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-gray-700">
                <li>All ticket sales are final unless otherwise stated</li>
                <li>
                  Refunds are subject to our refund policy and applicable laws
                </li>
                <li>Tickets are non-transferable unless explicitly stated</li>
                <li>
                  You must present valid identification and proof of purchase at
                  events
                </li>
                <li>
                  We reserve the right to refuse entry or remove individuals
                  from events
                </li>
              </ul>

              <h3 className="mt-6 mb-3 text-xl font-semibold">
                3.3 Event Conduct
              </h3>
              <p className="leading-relaxed text-gray-700">
                By attending our events, you agree to follow all venue rules and
                regulations, respect other attendees, and comply with all
                applicable laws. We reserve the right to remove any individual
                who violates these rules or engages in disruptive behavior.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">4. Merchandise</h2>
              <h3 className="mt-6 mb-3 text-xl font-semibold">
                4.1 Product Information
              </h3>
              <p className="leading-relaxed text-gray-700">
                We make every effort to display accurate product descriptions,
                images, and prices. However, we do not warrant that product
                descriptions or other content on the Website is accurate,
                complete, reliable, current, or error-free.
              </p>

              <h3 className="mt-6 mb-3 text-xl font-semibold">
                4.2 Orders and Payment
              </h3>
              <p className="mb-4 leading-relaxed text-gray-700">
                When placing an order:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-gray-700">
                <li>
                  All prices are in New Zealand Dollars (NZD) unless otherwise
                  stated
                </li>
                <li>Payment must be received before order processing</li>
                <li>We reserve the right to refuse or cancel any order</li>
                <li>Shipping costs and delivery times are estimates only</li>
              </ul>

              <h3 className="mt-6 mb-3 text-xl font-semibold">
                4.3 Returns and Refunds
              </h3>
              <p className="leading-relaxed text-gray-700">
                Returns and refunds are subject to our return policy and
                applicable consumer protection laws. Please contact us if you
                have any issues with your order.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                5. Intellectual Property
              </h2>
              <p className="mb-4 leading-relaxed text-gray-700">
                The Website and its original content, features, and
                functionality are owned by ATMOS and are protected by
                international copyright, trademark, patent, trade secret, and
                other intellectual property laws. You may not:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-gray-700">
                <li>
                  Reproduce, distribute, or create derivative works from our
                  content without permission
                </li>
                <li>
                  Use our trademarks, logos, or branding without authorization
                </li>
                <li>
                  Remove any copyright or proprietary notices from our materials
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">6. User Content</h2>
              <p className="mb-4 leading-relaxed text-gray-700">
                If you submit content to our Website (such as comments, reviews,
                or photos), you grant us a non-exclusive, royalty-free,
                perpetual, and worldwide license to use, reproduce, modify, and
                distribute such content. You represent that you have the right
                to grant this license and that your content does not violate any
                third-party rights.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">7. Disclaimers</h2>
              <p className="leading-relaxed text-gray-700">
                THE WEBSITE AND SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE"
                WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE
                DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED
                WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
                AND NON-INFRINGEMENT.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                8. Limitation of Liability
              </h2>
              <p className="leading-relaxed text-gray-700">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ATMOS SHALL NOT BE
                LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER
                INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE,
                GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF
                THE WEBSITE OR SERVICES.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                9. Indemnification
              </h2>
              <p className="leading-relaxed text-gray-700">
                You agree to indemnify, defend, and hold harmless ATMOS and its
                officers, directors, employees, and agents from and against any
                claims, liabilities, damages, losses, and expenses arising out
                of or in any way connected with your use of the Website or
                Services or your violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">10. Privacy</h2>
              <p className="leading-relaxed text-gray-700">
                Your use of the Website and Services is also governed by our
                Privacy Policy. Please review our Privacy Policy, which also
                governs your use of the Website, to understand our practices.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                11. Modifications to Terms
              </h2>
              <p className="leading-relaxed text-gray-700">
                We reserve the right to modify these Terms at any time. We will
                notify you of any material changes by posting the new Terms on
                this page and updating the "Last updated" date. Your continued
                use of the Website after such modifications constitutes
                acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                12. Governing Law
              </h2>
              <p className="leading-relaxed text-gray-700">
                These Terms shall be governed by and construed in accordance
                with the laws of New Zealand, without regard to its conflict of
                law provisions. Any disputes arising from these Terms or your
                use of the Website shall be subject to the exclusive
                jurisdiction of the courts of New Zealand.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">13. Severability</h2>
              <p className="leading-relaxed text-gray-700">
                If any provision of these Terms is found to be unenforceable or
                invalid, that provision shall be limited or eliminated to the
                minimum extent necessary, and the remaining provisions shall
                remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="mt-8 mb-4 text-2xl font-bold">
                14. Contact Information
              </h2>
              <p className="mb-4 leading-relaxed text-gray-700">
                If you have any questions about these Terms, please contact us:
              </p>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-gray-700">
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:finn@atmos-wlg.com"
                    className="text-blue-600 hover:underline"
                  >
                    finn@atmos-wlg.com
                  </a>
                </p>
                <p className="mt-2 text-gray-700">
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
