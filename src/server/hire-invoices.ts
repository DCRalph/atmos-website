import "server-only";

import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";
import { z } from "zod";

import { env } from "~/env";
import { formatContractDate, hireFieldsSchema } from "~/lib/contracts";
import { hireInvoiceDescription, hireInvoiceDueAt } from "~/lib/hire-invoices";
import { paidWithLabel } from "~/lib/ticketing/payment-methods";
import { parsePriceToCents } from "~/lib/ticketing/money";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email/send";
import { getStripe, paidWithFromCharge } from "~/server/stripe";
import { getTicketingSettings } from "~/server/ticketing/settings";
import {
  renderHireInvoiceEmail,
  renderHireInvoicePaidEmail,
} from "~/emails/rentals";
import { renderRentalPaidStaffEmail } from "~/emails/staff";
import { logActivity } from "~/server/utils/activity-log";
import { ActivityType } from "~Prisma/client";

/**
 * Tax invoices for equipment hire.
 *
 * Signing a hire agreement (online, or marked signed by an admin) issues a
 * Stripe Invoice for the hire fee printed on it, GST inclusive, due
 * `HIRE_FEE_DUE_DAYS` after collection, and emails the hirer a link to
 * `/invoices/<payToken>`. That page pays the invoice's own PaymentIntent with
 * the Payment Element, so the hirer never leaves the site; Stripe keeps the
 * numbering, the PDF and the money. Stripe never emails the hirer itself
 * (`auto_advance: false`): every email comes from here.
 *
 * Stripe is the authority on payment. The webhook (`invoice.paid`) and the
 * pay page's return both run `recordHireInvoicePaid`, which only acts once.
 */

/** The page a hirer pays their invoice on. The token is the credential. */
export function hireInvoiceUrl(payToken: string): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/invoices/${payToken}`;
}

let gstRate: Promise<string> | null = null;

/** The 15% GST-inclusive tax rate, found in Stripe or made the first time. */
function gstTaxRateId(): Promise<string> {
  gstRate ??= (async () => {
    const stripe = getStripe();
    for await (const rate of stripe.taxRates.list({ active: true })) {
      if (
        rate.inclusive &&
        rate.percentage === 15 &&
        rate.country === "NZ" &&
        rate.display_name === "GST"
      ) {
        return rate.id;
      }
    }
    const created = await stripe.taxRates.create({
      display_name: "GST",
      description: "New Zealand GST",
      percentage: 15,
      inclusive: true,
      country: "NZ",
      tax_type: "gst",
    });
    return created.id;
  })().catch((cause: unknown) => {
    gstRate = null;
    throw cause;
  });
  return gstRate;
}

/** The hirer's Stripe customer, by email, kept up to date with the agreement. */
async function hirerCustomer(hirer: {
  email: string | null;
  name: string;
  address: string;
}): Promise<string> {
  const stripe = getStripe();
  const details = {
    name: hirer.name,
    ...(hirer.address ? { address: { line1: hirer.address } } : {}),
  };
  if (hirer.email) {
    const found = await stripe.customers.list({ email: hirer.email, limit: 1 });
    const existing = found.data[0];
    if (existing) {
      await stripe.customers.update(existing.id, details);
      return existing.id;
    }
  }
  const created = await stripe.customers.create({
    ...details,
    ...(hirer.email ? { email: hirer.email } : {}),
  });
  return created.id;
}

/** What `issueHireInvoice` did. */
export type IssueOutcome =
  /** A new invoice went out. */
  | "issued"
  /** The open invoice already bills this fee. */
  | "unchanged"
  /** It is paid, possibly just now while being replaced. */
  | "paid"
  /** The agreement has no hire fee, so there is nothing to bill. */
  | "no-fee"
  /** Not a signed hire agreement with its rental still there. */
  | "not-ready";

/**
 * Issue the invoice for a signed hire agreement. Safe to call again: it does
 * nothing while the agreement's invoice is open for the same amount, or paid.
 * When the hire fee has changed since (the agreement went back to draft and
 * was signed again), the open Stripe invoice is voided first and then
 * replaced, keeping the same pay link, so the hirer can never pay both.
 */
export async function issueHireInvoice(
  contractId: string,
): Promise<IssueOutcome> {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      kind: true,
      status: true,
      title: true,
      fields: true,
      signedAt: true,
      sentTo: true,
      rental: { select: { startDate: true } },
      hireInvoice: true,
    },
  });
  if (contract?.kind !== "HIRE" || contract.status !== "SIGNED") {
    return "not-ready";
  }
  if (!contract.rental) return "not-ready";

  const fields = hireFieldsSchema.parse(contract.fields);
  const totalCents = parsePriceToCents(fields.hireFee);

  const existing = contract.hireInvoice;
  if (existing?.status === "PAID" || existing?.status === "REFUNDED") {
    return "paid";
  }
  if (existing?.status === "OPEN") {
    if (existing.totalCents === totalCents) return "unchanged";
    if ((await retireOpenInvoice(existing.stripeInvoiceId)) === "paid") {
      return "paid";
    }
  }
  if (!totalCents) return "no-fee";

  const stripe = getStripe();
  const settings = await getTicketingSettings();
  const email = z.email().safeParse(fields.email || contract.sentTo);
  const description = hireInvoiceDescription(fields);
  const dueAt = hireInvoiceDueAt(contract.rental.startDate, new Date());
  const gear = fields.items
    .filter((item) => item.name)
    .map((item) => `${item.quantity || "1"}× ${item.name}`)
    .join(", ");

  // Retries of the same signing reuse the same Stripe objects instead of
  // making a second invoice. The invoice being replaced is part of the key,
  // so issuing again after a void makes a new one.
  const key = `hire-invoice:${contract.id}:${contract.signedAt?.getTime() ?? 0}:${totalCents}:${existing?.stripeInvoiceId ?? "first"}`;

  const customer = await hirerCustomer({
    email: email.success ? email.data : null,
    name: fields.organisation || fields.name,
    address: fields.address,
  });
  const draft = await stripe.invoices.create(
    {
      customer,
      currency: "nzd",
      collection_method: "send_invoice",
      due_date: Math.floor(dueAt.getTime() / 1000),
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      description: `Tax invoice. ${description}.`,
      ...(settings.gstNumber
        ? { custom_fields: [{ name: "GST number", value: settings.gstNumber }] }
        : {}),
      metadata: { kind: "hire", contractId: contract.id },
    },
    { idempotencyKey: `${key}:invoice` },
  );
  await stripe.invoiceItems.create(
    {
      customer,
      invoice: draft.id,
      currency: "nzd",
      amount: totalCents,
      description: (gear ? `${description}: ${gear}` : description).slice(
        0,
        500,
      ),
      tax_rates: [await gstTaxRateId()],
    },
    { idempotencyKey: `${key}:item` },
  );
  const invoice = await stripe.invoices.finalizeInvoice(draft.id, {
    auto_advance: false,
  });

  const issued = {
    stripeInvoiceId: invoice.id,
    number: invoice.number ?? invoice.id,
    pdfUrl: invoice.invoice_pdf ?? null,
    description,
    totalCents: invoice.total,
    gstCents: (invoice.total_taxes ?? []).reduce(
      (sum, tax) => sum + tax.amount,
      0,
    ),
    dueAt,
    status: "OPEN" as const,
    emailedAt: null,
    emailedTo: null,
  };
  const row = existing
    ? await db.hireInvoice.update({ where: { id: existing.id }, data: issued })
    : await db.hireInvoice.create({
        data: {
          ...issued,
          contractId: contract.id,
          payToken: randomBytes(32).toString("base64url"),
        },
      });

  await logActivity({
    type: ActivityType.OTHER,
    action: `Invoice ${row.number} issued: ${contract.title}`,
    details: { contractId: contract.id, hireInvoiceId: row.id },
  });

  await emailHireInvoice(row.id);
  return "issued";
}

/**
 * Clear the way for deleting rentals: void each one's unpaid invoice in
 * Stripe, so the emailed pay link stops taking money for a hire that no
 * longer exists. A paid invoice is a record of money received, so deleting
 * its rental is refused until it has been refunded. Checks every invoice
 * with Stripe before voiding any, so a refusal changes nothing.
 */
export async function voidInvoicesForDeletedRentals(
  rentalIds: string[],
  userId: string,
): Promise<void> {
  const contracts = await db.contract.findMany({
    where: { rentalId: { in: rentalIds }, hireInvoice: { isNot: null } },
    select: {
      title: true,
      hireInvoice: {
        select: { id: true, number: true, status: true, stripeInvoiceId: true },
      },
    },
  });
  const paidRefusal = (number: string) =>
    new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Invoice ${number} for this hire has been paid. Refund it in Stripe before deleting.`,
    });

  // Stripe first: an invoice paid moments ago may not have reached us yet.
  for (const contract of contracts) {
    if (contract.hireInvoice?.status === "OPEN") {
      const live = await refreshHireInvoice(
        contract.hireInvoice.stripeInvoiceId,
      );
      if (live.status === "paid") contract.hireInvoice.status = "PAID";
    }
  }
  const invoices = contracts.flatMap((contract) =>
    contract.hireInvoice
      ? [{ ...contract.hireInvoice, title: contract.title }]
      : [],
  );
  const paid = invoices.find((invoice) => invoice.status === "PAID");
  if (paid) throw paidRefusal(paid.number);

  for (const invoice of invoices) {
    if (invoice.status !== "OPEN") continue;
    if ((await retireOpenInvoice(invoice.stripeInvoiceId)) === "paid") {
      throw paidRefusal(invoice.number);
    }
    await logActivity({
      type: ActivityType.OTHER,
      action: `Invoice ${invoice.number} voided to delete its rental (${invoice.title})`,
      details: { hireInvoiceId: invoice.id },
      userId,
    });
  }
}

/**
 * Void an open invoice in Stripe before it is replaced. If Stripe refuses
 * because the hirer paid it in the meantime, that payment is recorded and
 * nothing replaces it.
 */
async function retireOpenInvoice(
  stripeInvoiceId: string,
): Promise<"voided" | "paid"> {
  try {
    await getStripe().invoices.voidInvoice(stripeInvoiceId);
  } catch (cause) {
    const live = await refreshHireInvoice(stripeInvoiceId);
    if (live.status === "paid") return "paid";
    // Uncollectible can still be paid, so only a true void is replaced.
    if (live.status !== "void") throw cause;
  }
  await recordHireInvoiceVoided(stripeInvoiceId);
  return "voided";
}

/**
 * Email an open invoice to its hirer, first time or again. Returns where it
 * went; throws when there is no address or the send fails.
 */
export async function emailHireInvoice(hireInvoiceId: string) {
  const invoice = await db.hireInvoice.findUniqueOrThrow({
    where: { id: hireInvoiceId },
    include: { contract: { select: { fields: true, sentTo: true } } },
  });
  if (invoice.status !== "OPEN") {
    throw new Error("Only an unpaid invoice can be emailed.");
  }
  const fields = hireFieldsSchema.parse(invoice.contract.fields);
  const to = z.email().safeParse(fields.email || invoice.contract.sentTo);
  if (!to.success) throw new Error("The agreement has no email address.");

  const [settings, staff] = await Promise.all([
    getTicketingSettings(),
    staffAddress(),
  ]);
  const result = await sendEmail({
    from: "rentals",
    to: to.data,
    replyTo: staff ?? undefined,
    ...renderHireInvoiceEmail({
      name: fields.name,
      number: invoice.number,
      description: invoice.description,
      totalCents: invoice.totalCents,
      gstCents: invoice.gstCents,
      dueOn: formatContractDate(invoice.dueAt),
      url: hireInvoiceUrl(invoice.payToken),
      legalName: settings.legalName,
      gstNumber: settings.gstNumber,
    }),
  });
  if (!result.ok) throw new Error(result.error ?? "The email did not send.");

  await db.hireInvoice.update({
    where: { id: invoice.id },
    data: { emailedAt: new Date(), emailedTo: to.data },
  });
  return { sentTo: to.data };
}

/** Where staff hear about rentals: the gear rental notification setting. */
async function staffAddress(): Promise<string | null> {
  const setting = await db.keyValueStore.findUnique({
    where: { key: "gearRentalNotification" },
  });
  return setting?.value ?? null;
}

/**
 * Record a Stripe invoice as paid, with how it was paid, then tell the hirer
 * and staff. Only the first caller acts: the webhook and the pay page's
 * return both land here.
 */
export async function recordHireInvoicePaid(
  stripeInvoice: Stripe.Invoice,
): Promise<void> {
  if (stripeInvoice.status !== "paid") return;
  const invoice = await db.hireInvoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
    include: { contract: { select: { title: true, fields: true } } },
  });
  if (invoice?.status !== "OPEN") return;

  const stripe = getStripe();
  const payments = await stripe.invoicePayments.list({
    invoice: stripeInvoice.id,
    status: "paid",
    limit: 1,
  });
  const intentRef = payments.data[0]?.payment.payment_intent;
  const intent =
    typeof intentRef === "string"
      ? await stripe.paymentIntents.retrieve(intentRef, {
          expand: ["latest_charge"],
        })
      : (intentRef ?? null);
  const charge =
    intent && typeof intent.latest_charge === "object"
      ? intent.latest_charge
      : null;
  const paidAt = stripeInvoice.status_transitions.paid_at;
  // A refund can land before this does, and its event would have found no row.
  const refundedCents = charge?.amount_refunded ?? 0;

  const { count } = await db.hireInvoice.updateMany({
    where: { id: invoice.id, status: "OPEN" },
    data: {
      status: "PAID",
      paidAt: paidAt ? new Date(paidAt * 1000) : new Date(),
      paidWith: paidWithFromCharge(charge),
      stripePaymentIntentId: intent?.id ?? null,
      refundedCents,
      ...(refundedCents >= invoice.totalCents ? { status: "REFUNDED" } : {}),
    },
  });
  if (count === 0) return;

  const paidWith = paidWithFromCharge(charge);
  await logActivity({
    type: ActivityType.OTHER,
    action: `Invoice ${invoice.number} paid: ${invoice.contract.title}`,
    details: { hireInvoiceId: invoice.id, stripeInvoiceId: stripeInvoice.id },
  });

  const fields = hireFieldsSchema.parse(invoice.contract.fields);
  const to = z.email().safeParse(invoice.emailedTo ?? fields.email);
  const staff = await staffAddress();
  const sends: Promise<unknown>[] = [];
  if (to.success) {
    sends.push(
      sendEmail({
        from: "rentals",
        to: to.data,
        replyTo: staff ?? undefined,
        ...renderHireInvoicePaidEmail({
          name: fields.name,
          number: invoice.number,
          totalCents: invoice.totalCents,
          paidWith: paidWith ? paidWithLabel(paidWith) : null,
          url: hireInvoiceUrl(invoice.payToken),
        }),
      }),
    );
  }
  if (staff) {
    sends.push(
      sendEmail({
        from: "notifications",
        to: staff,
        ...renderRentalPaidStaffEmail({
          name: fields.name,
          totalCents: invoice.totalCents,
          number: invoice.number,
          description: invoice.description,
          adminUrl: `${env.NEXT_PUBLIC_APP_URL}/admin/rentals`,
        }),
      }),
    );
  }
  // The payment stands whether or not these arrive.
  await Promise.allSettled(sends);
}

/**
 * The same, from the invoice's payment intent: `payment_intent.succeeded`
 * reaches the webhook even where it is not subscribed to `invoice.paid`.
 * Does nothing when the intent pays no hire invoice.
 */
export async function recordHireInvoicePaidByIntent(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  const stripe = getStripe();
  const payments = await stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: intent.id },
    limit: 1,
  });
  const ref = payments.data[0]?.invoice;
  if (!ref) return;
  const invoiceId = typeof ref === "string" ? ref : ref.id;
  const known = await db.hireInvoice.findUnique({
    where: { stripeInvoiceId: invoiceId },
    select: { status: true },
  });
  if (known?.status !== "OPEN") return;
  await recordHireInvoicePaid(await stripe.invoices.retrieve(invoiceId));
}

/** Mark an invoice void because Stripe says it is. */
export async function recordHireInvoiceVoided(stripeInvoiceId: string) {
  await db.hireInvoice.updateMany({
    where: { stripeInvoiceId, status: "OPEN" },
    data: { status: "VOID" },
  });
}

/**
 * Keep a paid invoice's refund current from Stripe's `charge.refunded`.
 * Returns false when the payment is not a hire invoice's.
 */
export async function recordHireInvoiceRefund(
  paymentIntentId: string,
  refundedCents: number,
): Promise<boolean> {
  const invoice = await db.hireInvoice.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, totalCents: true },
  });
  if (!invoice) return false;
  // Refund events can arrive out of order; the amount only ever grows.
  await db.hireInvoice.updateMany({
    where: { id: invoice.id, refundedCents: { lt: refundedCents } },
    data: {
      refundedCents,
      status: refundedCents >= invoice.totalCents ? "REFUNDED" : "PAID",
    },
  });
  return true;
}

/** Void an unpaid invoice from admin, in Stripe and here. */
export async function voidHireInvoice(hireInvoiceId: string, userId: string) {
  const invoice = await db.hireInvoice.findUniqueOrThrow({
    where: { id: hireInvoiceId },
  });
  if (invoice.status !== "OPEN") {
    throw new Error("Only an unpaid invoice can be voided.");
  }
  await getStripe().invoices.voidInvoice(invoice.stripeInvoiceId);
  await recordHireInvoiceVoided(invoice.stripeInvoiceId);
  await logActivity({
    type: ActivityType.OTHER,
    action: `Invoice ${invoice.number} voided`,
    details: { hireInvoiceId: invoice.id },
    userId,
  });
}

/**
 * Bring an open invoice up to date with Stripe, for the pay page: a payment
 * that went through before its webhook arrived, or a void made in Stripe.
 * Returns the Stripe invoice, so the page can use its payment secret.
 */
export async function refreshHireInvoice(stripeInvoiceId: string) {
  const invoice = await getStripe().invoices.retrieve(stripeInvoiceId, {
    expand: ["confirmation_secret"],
  });
  if (invoice.status === "paid") await recordHireInvoicePaid(invoice);
  if (invoice.status === "void") await recordHireInvoiceVoided(invoice.id);
  return invoice;
}
