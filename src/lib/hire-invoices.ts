import { daysUntil, formatShortContractDate } from "~/lib/contracts";
import type { ContractStatus, HireInvoiceStatus } from "~Prisma/client";

/**
 * Rules for the tax invoice a signed hire agreement raises, shared by the
 * server that issues it and the admin table that shows it. Clause "Fees" of
 * the hire agreement: the hire fee is due within this many days of collection.
 */
export const HIRE_FEE_DUE_DAYS = 7;

/** Stripe refuses a due date that has already passed, so a late one is pushed to tomorrow. */
const MIN_LEAD_MS = 86_400_000;

/**
 * When a hire's fee is due: `HIRE_FEE_DUE_DAYS` after collection, or a day
 * from `now` when that has already gone by (an agreement signed late).
 */
export function hireInvoiceDueAt(collection: Date, now: Date): Date {
  const due = collection.getTime() + HIRE_FEE_DUE_DAYS * 86_400_000;
  return new Date(Math.max(due, now.getTime() + MIN_LEAD_MS));
}

/** What the invoice says it is for. */
export function hireInvoiceDescription(start: Date, end: Date): string {
  return `Equipment hire, ${formatShortContractDate(start)} to ${formatShortContractDate(end)}`;
}

/** "12 Dec", for due dates in tight spaces. */
export function shortDueDate(date: Date): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "short",
  }).format(date);
}

export type PaymentTone = "ok" | "warn" | "bad" | "mute";

/**
 * The admin rentals table's Payment column for one rental: its invoice if it
 * has one, otherwise how far its agreement has got. Null when there is
 * nothing to say yet (no agreement sent).
 */
export function hirePaymentState(
  contractStatus: ContractStatus | null,
  invoice: { status: HireInvoiceStatus; dueAt: Date } | null,
  now: Date,
): { label: string; tone: PaymentTone } | null {
  if (!invoice) {
    if (contractStatus === "SENT") {
      return { label: "Awaiting signature", tone: "mute" };
    }
    if (contractStatus === "SIGNED") {
      return { label: "Not invoiced", tone: "warn" };
    }
    return null;
  }
  switch (invoice.status) {
    case "PAID":
      return { label: "Paid", tone: "ok" };
    case "REFUNDED":
      return { label: "Refunded", tone: "mute" };
    case "VOID":
      return { label: "Void", tone: "mute" };
    case "OPEN": {
      const days = daysUntil(invoice.dueAt, now);
      if (days < 0) {
        return {
          label: `Overdue ${-days} day${days === -1 ? "" : "s"}`,
          tone: "bad",
        };
      }
      return {
        label: days === 0 ? "Due today" : `Due ${shortDueDate(invoice.dueAt)}`,
        tone: "warn",
      };
    }
  }
}
