import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getTicketingSettings } from "~/server/ticketing/settings";
import { formatNZD } from "~/lib/ticketing/money";

/**
 * A receipt for a card payment taken at a door.
 *
 * Apple's App Review checklist 5.10 asks for a *confidential* digital receipt
 * that can be sent for approved and declined transactions alike. Both words
 * matter here:
 *
 * - **Confidential.** The token in the URL is the only credential, because the
 *   customer is a stranger with no Atmos account. So the page shows the payment
 *   and nothing else — no order contents, no ticket QR codes, no other sales
 *   from the same night. Somebody who is shown this on a phone screen, or who
 *   is forwarded it, learns only what was already on the terminal.
 * - **Declined.** A refused card leaves no order behind, so this renders from
 *   the receipt row alone and never assumes there is a sale attached.
 *
 * A server component, deliberately: there is no session to read, and rendering
 * it on the server keeps the token out of any client-side query cache.
 */

export const metadata: Metadata = {
  title: "Receipt — Atmos",
  robots: { index: false, follow: false },
};

const OUTCOME_COPY = {
  APPROVED: {
    heading: "Payment received",
    status: "Approved",
    explain:
      "Paid in person with Tap to Pay on iPhone. Your tickets were issued at the door.",
  },
  DECLINED: {
    heading: "Payment declined",
    status: "Declined",
    explain:
      "The card was refused by the bank, so nothing has been charged. If you were let in, you paid another way.",
  },
  TIMED_OUT: {
    heading: "Payment not completed",
    status: "Not completed",
    explain: "The card was never read, so nothing has been charged.",
  },
} as const;

export default async function DoorReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const receipt = await db.doorPaymentReceipt.findUnique({
    where: { token },
    select: {
      outcome: true,
      amountCents: true,
      cardBrand: true,
      last4: true,
      declineCode: true,
      createdAt: true,
      event: { select: { name: true } },
      order: { select: { orderNumber: true } },
    },
  });

  // A bad token is a page that does not exist, not a page that says "wrong
  // token" — there is nothing to be gained by confirming a guess got close.
  if (!receipt) notFound();

  const settings = await getTicketingSettings();
  const copy = OUTCOME_COPY[receipt.outcome];

  const rows: [string, string][] = [
    ["Amount", formatNZD(receipt.amountCents)],
    ["Status", copy.status],
    ...(receipt.cardBrand ?? receipt.last4
      ? ([
          [
            "Card",
            [receipt.cardBrand, receipt.last4 ? `•••• ${receipt.last4}` : null]
              .filter(Boolean)
              .join(" "),
          ],
        ] as [string, string][])
      : []),
    ...(receipt.order
      ? ([["Order", receipt.order.orderNumber]] as [string, string][])
      : []),
    [
      "When",
      receipt.createdAt.toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
        dateStyle: "medium",
        timeStyle: "short",
      }),
    ],
    ["Paid to", settings.legalName],
    ...(settings.gstNumber
      ? ([["GST number", settings.gstNumber]] as [string, string][])
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-16 md:px-8">
      <p className="text-xs font-bold tracking-[0.22em] text-white/40 uppercase">
        Atmos
      </p>

      <h1 className="mt-4 text-3xl font-black tracking-tight uppercase">
        {copy.heading}
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-white/60">
        {receipt.event.name}
        <br />
        {copy.explain}
        {receipt.outcome !== "APPROVED" && receipt.declineCode
          ? ` Reason given: ${receipt.declineCode}.`
          : null}
      </p>

      <dl className="mt-8 border-2 border-white/10">
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-4 px-5 py-3 ${
              index > 0 ? "border-t border-white/10" : ""
            }`}
          >
            <dt className="text-sm text-white/50">{label}</dt>
            <dd className="text-right text-sm font-medium text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 text-xs leading-relaxed text-white/40">
        Atmos never sees or stores your full card number. The payment was read
        by Apple on the staff member&rsquo;s iPhone and processed by Stripe.
        {settings.supportEmail ? (
          <>
            {" "}
            Questions?{" "}
            <a
              className="underline hover:text-white/70"
              href={`mailto:${settings.supportEmail}`}
            >
              {settings.supportEmail}
            </a>
          </>
        ) : null}
      </p>
    </main>
  );
}
