import { notFound } from "next/navigation";

import { HireInvoicePay } from "~/components/tickets/hire-invoice-pay";
import {
  TicketShell,
  outlinePillClass,
  ticketPanelClass,
} from "~/components/tickets/ticket-shell";
import { formatContractDate, hireFieldsSchema } from "~/lib/contracts";
import { shortDueDate } from "~/lib/hire-invoices";
import { unlistedPageMetadata } from "~/lib/seo-constants";
import { formatNZD } from "~/lib/ticketing/money";
import { paidWithLabel } from "~/lib/ticketing/payment-methods";
import { contractSigningUrl } from "~/server/contracts";
import { db } from "~/server/db";
import { refreshHireInvoice } from "~/server/hire-invoices";
import { getTicketingSettings } from "~/server/ticketing/settings";

/**
 * Where a hirer pays the tax invoice for their signed hire agreement, from
 * the link in its email. The token is the only credential, as on the signing
 * page. Unpaid, it is the invoice with the payment form under it; paid, it is
 * the receipt.
 *
 * Every load of an unpaid invoice asks Stripe first, so a payment that
 * landed before its webhook shows as paid. See `~/server/hire-invoices`.
 */

export const metadata = unlistedPageMetadata(
  "Your invoice",
  "An equipment hire invoice from Atmos.",
);

export const dynamic = "force-dynamic";

const loadInvoice = (payToken: string) =>
  db.hireInvoice.findUnique({
    where: { payToken },
    include: {
      contract: { select: { fields: true, signToken: true } },
    },
  });

type Row = [label: string, value: string, detail?: string];

export default async function HireInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let invoice = (await loadInvoice(token)) ?? notFound();

  let clientSecret: string | null = null;
  if (invoice.status === "OPEN") {
    const live = await refreshHireInvoice(invoice.stripeInvoiceId).catch(
      (cause: unknown) => {
        console.error("[hire-invoice] could not reach Stripe", cause);
        return null;
      },
    );
    invoice = (await loadInvoice(token)) ?? notFound();
    if (invoice.status === "OPEN" && live?.status === "open") {
      clientSecret = live.confirmation_secret?.client_secret ?? null;
    }
  }

  const settings = await getTicketingSettings();
  const fields = hireFieldsSchema.parse(invoice.contract.fields);
  const total = formatNZD(invoice.totalCents);
  const when = (date: string, time: string) =>
    [date, time].filter(Boolean).join(", ");

  const gear: Row[] = fields.items
    .filter((item) => item.name)
    .map((item) => [item.name, `×${item.quantity || "1"}`]);
  const totals: Row[] = [
    ["Total incl. GST", total],
    ["Includes GST", formatNZD(invoice.gstCents)],
  ];
  const hire: Row[] = [
    ["Collection", when(fields.collectionDate, fields.collectionTime)],
    ["Return", when(fields.returnDate, fields.returnTime)],
  ];

  const state = {
    OPEN: {
      heading: (
        <>
          {total}
          <br />
          due {shortDueDate(invoice.dueAt)}
        </>
      ),
      lead: `${invoice.description}. Pay any time before ${formatContractDate(invoice.dueAt)}.`,
    },
    PAID: {
      heading: "Paid",
      lead: `Thanks ${fields.name}. ${total} received${invoice.paidAt ? ` on ${formatContractDate(invoice.paidAt)}` : ""}${invoice.paidWith ? ` with ${paidWithLabel(invoice.paidWith)}` : ""}.`,
    },
    REFUNDED: {
      heading: "Refunded",
      lead: `This invoice was paid and then refunded in full.`,
    },
    VOID: {
      heading: "Cancelled",
      lead: "This invoice has been cancelled, so there is nothing to pay. If you were sent a newer one, use the link in that email.",
    },
  }[invoice.status];

  const rows: Row[] =
    invoice.status === "PAID"
      ? [
          ["Amount", total],
          ["Includes GST", formatNZD(invoice.gstCents)],
          ...(invoice.refundedCents > 0
            ? ([["Refunded", formatNZD(invoice.refundedCents)]] as Row[])
            : []),
          ...hire,
        ]
      : [...gear, ...totals, ...hire];

  return (
    <TicketShell>
      <p className="t-label text-[11px] text-white/55">
        Tax invoice {invoice.number}
      </p>
      <h1 className="t-heading mt-3 text-[clamp(2rem,9vw,3rem)]">
        {state.heading}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-white/65">
        {state.lead}
      </p>

      <dl className={`${ticketPanelClass} mt-8 p-0`}>
        {rows.map(([label, value], index) => (
          <div
            key={`${label}-${index}`}
            className={`flex items-baseline justify-between gap-4 px-5 py-3 ${
              index > 0 ? "border-t border-white/10" : ""
            }`}
          >
            <dt className="text-[14px] text-white/55">{label}</dt>
            <dd className="text-right text-[14px] text-white tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {invoice.status === "OPEN" ? (
        <div className={`${ticketPanelClass} mt-4`}>
          {clientSecret ? (
            <HireInvoicePay
              clientSecret={clientSecret}
              totalCents={invoice.totalCents}
            />
          ) : (
            <p className="text-[14px] text-white/65">
              Payments can&apos;t be taken right now. Try again in a few
              minutes, or reply to the invoice email.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {invoice.pdfUrl ? (
          <a className={outlinePillClass} href={invoice.pdfUrl}>
            Invoice PDF
          </a>
        ) : null}
        {invoice.contract.signToken ? (
          <a
            className={outlinePillClass}
            href={contractSigningUrl(invoice.contract.signToken)}
          >
            Hire agreement
          </a>
        ) : null}
      </div>

      <p className="mt-8 text-[13px] leading-relaxed text-white/50">
        {settings.legalName}
        {settings.gstNumber ? ` · GST ${settings.gstNumber}` : ""}.
        {settings.supportEmail ? (
          <>
            {" "}
            Questions?{" "}
            <a
              className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              href={`mailto:${settings.supportEmail}`}
            >
              {settings.supportEmail}
            </a>
          </>
        ) : null}
      </p>
    </TicketShell>
  );
}
