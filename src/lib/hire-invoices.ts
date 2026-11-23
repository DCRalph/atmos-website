import { daysUntil } from "~/lib/contracts";
import { dayKey, nzDate } from "~/lib/tasks/time";
import type { ContractStatus, HireInvoiceStatus } from "~Prisma/client";

/**
 * Rules for the tax invoice a signed hire agreement raises, shared by the
 * server that issues it and the admin table that shows it. Clause "Fees" of
 * the hire agreement: the hire fee is due within this many days of collection.
 */
export const HIRE_FEE_DUE_DAYS = 7;

/** The NZ calendar day `days` after `date`'s, as "YYYY-MM-DD". */
function nzDayAfter(date: Date, days: number): string {
  const [year = 0, month = 1, day = 1] = dayKey(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/**
 * When a hire's fee is due: noon in New Zealand, `HIRE_FEE_DUE_DAYS`
 * calendar days after collection, or tomorrow when that has already gone by
 * (an agreement signed late; Stripe refuses a due date in the past). Noon
 * keeps it on the same day whatever daylight saving does, and gives the same
 * answer all day, so a retried issue asks Stripe for the same invoice.
 */
export function hireInvoiceDueAt(collection: Date, now: Date): Date {
  const due = nzDate(nzDayAfter(collection, HIRE_FEE_DUE_DAYS), 12);
  const earliest = nzDate(nzDayAfter(now, 1), 12);
  return due < earliest ? earliest : due;
}

/** What the invoice says it is for, in the signed agreement's own words. */
export function hireInvoiceDescription(fields: {
  collectionDate: string;
  returnDate: string;
}): string {
  const dates = [fields.collectionDate, fields.returnDate].filter(Boolean);
  return dates.length > 0
    ? `Equipment hire, ${dates.join(" to ")}`
    : "Equipment hire";
}

/**
 * A pay link's token is its credential, so analytics only ever see
 * `/invoices/redacted`: page URLs, and the link on a signed agreement.
 */
export const redactInvoiceToken = (value: string): string =>
  value.replace(/\/invoices\/[^/?#\s"']+/g, "/invoices/redacted");

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
