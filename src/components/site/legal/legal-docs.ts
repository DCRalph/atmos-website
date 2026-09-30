// Privacy policy and terms, from the previous /privacy and /terms pages. Em
// dashes were rewritten as commas or colons; wording is otherwise unchanged.

import { CONTACT } from "~/lib/site-constants";

/** One block of body copy in a legal section. */
export type LegalBlock =
  | { p: string; link?: { text: string; href: string } }
  | { sub: string }
  | { list: readonly string[] }
  | { terms: readonly { term: string; text: string }[] }
  | { contact: readonly { label: string; value: string; href: string }[] };

export type LegalSection = {
  /** Anchor id, e.g. `/privacy#cookies`. */
  id: string;
  n: string;
  title: string;
  blocks: readonly LegalBlock[];
};

export type LegalDoc = {
  id: "privacy" | "terms";
  title: string;
  updated: string;
  sections: readonly LegalSection[];
};

/**
 * Shown as "Last updated" on both documents. Bump it whenever the text of
 * either one changes.
 */
const LEGAL_UPDATED = "29 September 2026";

const contactBlock: LegalBlock = {
  contact: [
    { label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { label: "Website", value: "Contact page", href: "/contact" },
  ],
};

export const privacyDoc: LegalDoc = {
  id: "privacy",
  title: "Privacy policy",
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: "introduction",
      n: "1",
      title: "Introduction",
      blocks: [
        {
          p: 'Welcome to ATMOS ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our website and in using our services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website at atmosmedia.co.nz or use our services.',
        },
      ],
    },
    {
      id: "information-we-collect",
      n: "2",
      title: "Information we collect",
      blocks: [
        { sub: "2.1 Information you provide" },
        {
          p: "We may collect information that you voluntarily provide to us when you:",
        },
        {
          list: [
            "Register for an account or create a profile",
            "Subscribe to our newsletter",
            "Contact us through our contact form or email",
            "Purchase merchandise or tickets",
            "Participate in surveys, contests, or promotions",
            "Interact with us on social media",
          ],
        },
        {
          p: "This information may include your name, email address, phone number, postal address, payment information, and any other information you choose to provide.",
        },
        { sub: "2.2 Automatically collected information" },
        {
          p: "When you visit our website, we may automatically collect certain information about your device, including:",
        },
        {
          list: [
            "IP address",
            "Browser type and version",
            "Operating system",
            "Pages you visit and time spent on pages",
            "Referring website addresses",
            "Date and time of access",
          ],
        },
      ],
    },
    {
      id: "buying-tickets",
      n: "2a",
      title: "Buying tickets",
      blocks: [
        {
          p: "When you buy a ticket to one of our events we collect and hold:",
        },
        {
          list: [
            "Your email address and name, supplied by you, or by Apple Pay or Google Pay when you use them",
            "The names you give for the people using each ticket, if you choose to add them",
            "Your order: what you bought, what you paid, any discount code used, and the link you arrived from",
            "A record of each time a ticket is scanned at the door: when it happened, on which device, and by which staff member",
          ],
        },
        {
          p: "We use that to issue and deliver your tickets, let you in at the door, prevent the same ticket being used twice, handle refunds and support, and meet our tax record-keeping obligations. We never see or store your full card number. Payments are handled entirely by Stripe.",
        },
        {
          p: "Ticketing relies on a few overseas providers, so some of this information is held outside New Zealand under comparable privacy safeguards: Stripe (payments), Resend (ticket email), Amazon Web Services (file storage), and Apple and Google if you add a ticket to a wallet app.",
        },
        {
          p: "Buying a ticket does not sign you up to anything. We only email you about future events if you tick the box at checkout, and you can unsubscribe at any time without affecting tickets you have already bought.",
        },
        {
          p: "We keep order and scan records for seven years, which is what New Zealand tax law requires of business records, and then delete them.",
        },
      ],
    },
    {
      id: "how-we-use",
      n: "3",
      title: "How we use your information",
      blocks: [
        {
          p: "We use the information we collect for various purposes, including:",
        },
        {
          list: [
            "To provide, maintain, and improve our services",
            "To process transactions and send related information",
            "To send you newsletters, marketing communications, and event updates (with your consent)",
            "To respond to your inquiries and provide customer support",
            "To personalize your experience on our website",
            "To detect, prevent, and address technical issues and security threats",
            "To comply with legal obligations",
            "To analyze usage patterns and improve our website",
          ],
        },
      ],
    },
    {
      id: "sharing",
      n: "4",
      title: "Information sharing and disclosure",
      blocks: [
        {
          p: "We do not sell your personal information. We may share your information in the following circumstances:",
        },
        {
          terms: [
            {
              term: "Service providers",
              text: "We may share information with third-party service providers who perform services on our behalf, such as payment processing, email delivery, and website hosting.",
            },
            {
              term: "Legal requirements",
              text: "We may disclose information if required by law or in response to valid requests by public authorities.",
            },
            {
              term: "Business transfers",
              text: "In the event of a merger, acquisition, or sale of assets, your information may be transferred.",
            },
            {
              term: "With your consent",
              text: "We may share your information with your explicit consent.",
            },
          ],
        },
      ],
    },
    {
      id: "cookies",
      n: "5",
      title: "Cookies and tracking technologies",
      blocks: [
        {
          p: "We use cookies and similar tracking technologies to track activity on our website and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our website.",
        },
      ],
    },
    {
      id: "id-checks",
      n: "6",
      title: "ID checks at our events",
      blocks: [
        {
          p: "At R18 events, and at any event where a ticket is issued in a named person's name, our door staff may scan your identity document: a New Zealand driver licence, a passport, or a Kiwi Access Card. We do this to confirm you are old enough to be admitted, to check the ticket belongs to you, and to enforce entry bans.",
        },
        {
          p: "The document is read on the staff member's own device. The photograph of your document is never uploaded to us. From that reading we record:",
        },
        {
          list: [
            "Your name and date of birth, as printed on the document",
            "The document type, its number and its expiry date",
            "A cropped photograph of your face taken from the document, never an image of the whole document, so your address and any other details printed on it are not retained",
            "The date, event and device of each check, and its outcome",
          ],
        },
        {
          p: "This information is deleted automatically 90 days after your most recent check. The exception is where an entry ban is in force against you: in that case the record is kept for as long as the ban stands, because a ban we cannot match to a person does not work. We do not use any of it for marketing, and we do not share it with other venues or operators.",
        },
        {
          p: "You can ask us what we hold about you, ask us to correct it, or ask us to delete it early, using the contact details below. If you would rather not have your ID scanned, tell the staff member. They can check your ID by eye instead, though at an R18 event they must still be satisfied you are over 18 before admitting you.",
        },
      ],
    },
    {
      id: "security",
      n: "7",
      title: "Data security",
      blocks: [
        {
          p: "We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.",
        },
      ],
    },
    {
      id: "rights",
      n: "8",
      title: "Your rights",
      blocks: [
        {
          p: "Depending on your location, you may have certain rights regarding your personal information, including:",
        },
        {
          list: [
            "The right to access your personal information",
            "The right to correct inaccurate information",
            "The right to delete your personal information",
            "The right to object to processing of your personal information",
            "The right to data portability",
            "The right to withdraw consent",
          ],
        },
        {
          p: "To exercise these rights, please contact us using the information provided in the Contact section below.",
        },
      ],
    },
    {
      id: "children",
      n: "9",
      title: "Children's privacy",
      blocks: [
        {
          p: "Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.",
        },
      ],
    },
    {
      id: "transfers",
      n: "10",
      title: "International data transfers",
      blocks: [
        {
          p: "Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.",
        },
      ],
    },
    {
      id: "changes",
      n: "11",
      title: "Changes to this policy",
      blocks: [
        {
          p: 'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.',
        },
      ],
    },
    {
      id: "contact",
      n: "12",
      title: "Contact us",
      blocks: [
        {
          p: "If you have any questions about this Privacy Policy or our data practices, please contact us:",
        },
        contactBlock,
      ],
    },
  ],
};

export const termsDoc: LegalDoc = {
  id: "terms",
  title: "Terms and conditions",
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: "agreement",
      n: "1",
      title: "Agreement to terms",
      blocks: [
        {
          p: 'By accessing or using the ATMOS website ("Website") and services ("Services"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use our Website or Services.',
        },
      ],
    },
    {
      id: "use",
      n: "2",
      title: "Use of the website",
      blocks: [
        { sub: "2.1 Eligibility" },
        {
          p: "You must be at least 18 years old to use our Services. By using our Services, you represent and warrant that you are at least 18 years of age and have the legal capacity to enter into these Terms.",
        },
        { sub: "2.2 Acceptable use" },
        {
          p: "You agree to use our Website and Services only for lawful purposes and in accordance with these Terms. You agree not to:",
        },
        {
          list: [
            "Violate any applicable laws or regulations",
            "Infringe upon the rights of others",
            "Transmit any harmful, offensive, or illegal content",
            "Attempt to gain unauthorized access to our systems",
            "Interfere with or disrupt the Website or Services",
            "Use automated systems to access the Website without permission",
            "Impersonate any person or entity",
          ],
        },
      ],
    },
    {
      id: "events",
      n: "3",
      title: "Events and tickets",
      blocks: [
        { sub: "3.1 Event information" },
        {
          p: "We strive to provide accurate information about our events, including dates, times, locations, and lineups. However, event details are subject to change without notice. We reserve the right to modify, cancel, or reschedule events at any time.",
        },
        { sub: "3.2 Ticket sales" },
        { p: "When purchasing tickets through our Website:" },
        {
          list: [
            "All ticketed events are strictly 18+, and you must present valid photo identification at the door",
            "No refunds are offered because your plans changed. If we cancel an event, we refund in full",
            "Tickets are transferable, including through resale platforms, but must not be resold above face value",
            "We reserve the right to refuse entry or remove individuals from events",
          ],
        },
        {
          p: "Tickets bought through this Website are also governed by our ticket terms, which set out refunds, entry, safety and photography in full.",
          link: { text: "ticket terms", href: "/tickets/terms" },
        },
        { sub: "3.3 Event conduct" },
        {
          p: "By attending our events, you agree to follow all venue rules and regulations, respect other attendees, and comply with all applicable laws. We have a zero-tolerance policy for harmful or antisocial behaviour. If you feel unsafe or uncomfortable, tell venue security, bar staff or an Atmos crew member immediately.",
        },
        {
          p: "We do not condone drug use or excessive drinking. Free drinking water is available at all of our events, and if you or someone else needs medical assistance, alert staff immediately. We are here to help, not to judge. Anyone visibly overly intoxicated, or endangering themselves or others, will be removed without a refund.",
        },
        { sub: "3.4 Health and safety" },
        { p: "Our events are loud and use production effects. Please note:" },
        {
          list: [
            "Loud volumes are expected, and free earplugs are available",
            "Events include strobe lighting and haze effects",
            "We take reasonable precautions to prevent risks, but if you notice a hazard please report it to venue staff or an Atmos crew member",
          ],
        },
        { sub: "3.5 Photography and recording" },
        {
          p: "All of our events are photographed and filmed for promotional purposes. By purchasing a ticket you consent to being featured in recap content and future marketing material. If you would rather not be filmed or photographed, let one of our photographers or crew members know and we'll do our best to accommodate you.",
        },
      ],
    },
    {
      id: "merch",
      n: "4",
      title: "Merchandise",
      blocks: [
        { sub: "4.1 Product information" },
        {
          p: "We make every effort to display accurate product descriptions, images, and prices. However, we do not warrant that product descriptions or other content on the Website is accurate, complete, reliable, current, or error-free.",
        },
        { sub: "4.2 Orders and payment" },
        { p: "When placing an order:" },
        {
          list: [
            "All prices are in New Zealand Dollars (NZD) unless otherwise stated",
            "Payment must be received before order processing",
            "We reserve the right to refuse or cancel any order",
            "Shipping costs and delivery times are estimates only",
          ],
        },
        { sub: "4.3 Returns and refunds" },
        {
          p: "Returns and refunds are subject to our return policy and applicable consumer protection laws. Please contact us if you have any issues with your order.",
        },
      ],
    },
    {
      id: "ip",
      n: "5",
      title: "Intellectual property",
      blocks: [
        {
          p: "The Website and its original content, features, and functionality are owned by ATMOS and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not:",
        },
        {
          list: [
            "Reproduce, distribute, or create derivative works from our content without permission",
            "Use our trademarks, logos, or branding without authorization",
            "Remove any copyright or proprietary notices from our materials",
          ],
        },
      ],
    },
    {
      id: "user-content",
      n: "6",
      title: "User content",
      blocks: [
        {
          p: "If you submit content to our Website (such as comments, reviews, or photos), you grant us a non-exclusive, royalty-free, perpetual, and worldwide license to use, reproduce, modify, and distribute such content. You represent that you have the right to grant this license and that your content does not violate any third-party rights.",
        },
      ],
    },
    {
      id: "disclaimers",
      n: "7",
      title: "Disclaimers",
      blocks: [
        {
          p: 'THE WEBSITE AND SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
        },
      ],
    },
    {
      id: "liability",
      n: "8",
      title: "Limitation of liability",
      blocks: [
        {
          p: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, ATMOS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE WEBSITE OR SERVICES.",
        },
      ],
    },
    {
      id: "indemnification",
      n: "9",
      title: "Indemnification",
      blocks: [
        {
          p: "You agree to indemnify, defend, and hold harmless ATMOS and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses arising out of or in any way connected with your use of the Website or Services or your violation of these Terms.",
        },
      ],
    },
    {
      id: "privacy",
      n: "10",
      title: "Privacy",
      blocks: [
        {
          p: "Your use of the Website and Services is also governed by our Privacy Policy. Please review our Privacy Policy, which also governs your use of the Website, to understand our practices.",
          link: { text: "Privacy Policy", href: "/privacy" },
        },
      ],
    },
    {
      id: "modifications",
      n: "11",
      title: "Modifications to terms",
      blocks: [
        {
          p: 'We reserve the right to modify these Terms at any time. We will notify you of any material changes by posting the new Terms on this page and updating the "Last updated" date. Your continued use of the Website after such modifications constitutes acceptance of the updated Terms.',
        },
      ],
    },
    {
      id: "law",
      n: "12",
      title: "Governing law",
      blocks: [
        {
          p: "These Terms shall be governed by and construed in accordance with the laws of New Zealand, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Website shall be subject to the exclusive jurisdiction of the courts of New Zealand.",
        },
      ],
    },
    {
      id: "severability",
      n: "13",
      title: "Severability",
      blocks: [
        {
          p: "If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.",
        },
      ],
    },
    {
      id: "contact",
      n: "14",
      title: "Contact information",
      blocks: [
        {
          p: "If you have any questions about these Terms, please contact us:",
        },
        contactBlock,
      ],
    },
  ],
};

const blockText = (b: LegalBlock): string =>
  "p" in b
    ? b.p
    : "sub" in b
      ? b.sub
      : "list" in b
        ? b.list.join(" ")
        : "terms" in b
          ? b.terms.map((t) => `${t.term} ${t.text}`).join(" ")
          : "";

/** Minutes to read at ~230 words a minute, rounded up. */
export const readingMinutes = (doc: LegalDoc) => {
  const words = doc.sections
    .flatMap((s) => s.blocks.map(blockText))
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 230));
};
