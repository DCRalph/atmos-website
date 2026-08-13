import "server-only";

import { randomBytes } from "node:crypto";

import { DoorReceiptOutcome } from "~Prisma/client";
import { db } from "~/server/db";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import { env } from "~/env";

/**
 * Receipts for card payments taken at a door.
 *
 * Apple's App Review checklist 5.10: "Regardless of whether a transaction is
 * approved or declined, it must be possible to send a confidential digital
 * receipt to the customer."
 *
 * The declined half is what shapes this. A declined tap releases its hold and
 * cancels the `TicketOrder`, so by the time anyone wants a receipt there is no
 * order to hang one off — hence `DoorPaymentReceipt` as its own record, written
 * for every terminal outcome rather than only for the sales that worked.
 *
 * Everything printed on it is read back from Stripe here rather than accepted
 * from the app. The handset saying "approved, Visa, 4242" is not evidence, and
 * a receipt is exactly the artefact somebody would later wave at a bank.
 */

/** Unguessable: the customer has no account, so the link is the credential. */
function receiptToken(): string {
  return randomBytes(24).toString("base64url");
}

export function doorReceiptUrl(token: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/receipts/${token}`;
}

type CardDetails = {
  cardBrand: string | null;
  last4: string | null;
  declineCode: string | null;
};

/**
 * What the card actually was, straight from Stripe.
 *
 * Best-effort: a receipt with no brand on it is still a receipt, and failing
 * the sale because the card metadata could not be read would be absurd.
 */
async function readCardDetails(paymentIntentId: string): Promise<CardDetails> {
  const empty: CardDetails = {
    cardBrand: null,
    last4: null,
    declineCode: null,
  };
  if (!isStripeConfigured()) return empty;

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge", "latest_charge.payment_method_details"],
    });

    const charge =
      typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    const present = charge?.payment_method_details?.card_present ?? null;

    return {
      cardBrand: present?.brand ?? null,
      last4: present?.last4 ?? null,
      declineCode:
        charge?.outcome?.seller_message ??
        intent.last_payment_error?.decline_code ??
        intent.last_payment_error?.message ??
        null,
    };
  } catch {
    return empty;
  }
}

export async function recordDoorReceipt({
  eventId,
  orderId,
  paymentIntentId,
  outcome,
  amountCents,
  createdByUserId,
  deviceLabel,
}: {
  eventId: string;
  orderId?: string | null;
  paymentIntentId?: string | null;
  outcome: DoorReceiptOutcome;
  amountCents: number;
  createdByUserId?: string | null;
  deviceLabel?: string | null;
}): Promise<{ receiptId: string; token: string; url: string }> {
  const card = paymentIntentId
    ? await readCardDetails(paymentIntentId)
    : { cardBrand: null, last4: null, declineCode: null };

  const token = receiptToken();

  const receipt = await db.doorPaymentReceipt.create({
    data: {
      token,
      eventId,
      orderId: orderId ?? null,
      paymentIntentId: paymentIntentId ?? null,
      outcome,
      amountCents,
      cardBrand: card.cardBrand,
      last4: card.last4,
      // Only meaningful when something went wrong; a seller message on an
      // approved charge is just noise on the receipt.
      declineCode:
        outcome === DoorReceiptOutcome.APPROVED ? null : card.declineCode,
      createdByUserId: createdByUserId ?? null,
      deviceLabel: deviceLabel ?? null,
    },
    select: { id: true, token: true },
  });

  return {
    receiptId: receipt.id,
    token: receipt.token,
    url: doorReceiptUrl(receipt.token),
  };
}

export { DoorReceiptOutcome };
