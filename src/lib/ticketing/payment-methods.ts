import type { PaymentMethodKind } from "~Prisma/client";

/**
 * How somebody paid, in words.
 *
 * The enum separates `TERMINAL` from `TAP_TO_PAY` from `STRIPE` because the
 * money moves differently in each — an external eftpos machine that already
 * settled, a contactless tap taken inside our own flow that can decline, and
 * an online card. Reporting needs those apart, and so does anybody at a door
 * reading back how a ticket was bought.
 *
 * Shared rather than restated. This had drifted into four private copies, one
 * of which was missing `TAP_TO_PAY` entirely and quietly labelled door taps as
 * "Online" — the exact reporting distinction the enum exists to preserve.
 *
 * Client-safe: the import above is a type, so nothing from Prisma is bundled.
 */

/**
 * Every method, in the order a filter should offer them: how most tickets were
 * bought first, the door in the middle, the zero-value ones last.
 */
export const PAYMENT_METHODS = [
  "STRIPE",
  "CASH",
  "TERMINAL",
  "TAP_TO_PAY",
  "COMP",
  "FREE",
  "ADMIN",
] as const satisfies readonly PaymentMethodKind[];

const LABELS: Record<PaymentMethodKind, string> = {
  STRIPE: "Online",
  CASH: "Cash at the door",
  TERMINAL: "Card at the door",
  TAP_TO_PAY: "Tap to pay at the door",
  COMP: "Comp",
  FREE: "Free ticket",
  ADMIN: "Admin link",
};

/** Short form, for a table column or a chip that shares its line. */
const SHORT: Record<PaymentMethodKind, string> = {
  STRIPE: "Online",
  CASH: "Cash",
  TERMINAL: "Eftpos",
  TAP_TO_PAY: "Tap to pay",
  COMP: "Comp",
  FREE: "Free",
  ADMIN: "Admin",
};

/**
 * Takes a plain string, because most call sites hold one: the payment method
 * arrives through a tRPC boundary where the enum has been widened to `string`.
 * An unrecognised value falls back to "Online" rather than throwing — a door
 * screen should never blank out over a value added to the enum in a migration.
 */
export function paymentMethodLabel(method: string): string {
  return LABELS[method as PaymentMethodKind] ?? "Online";
}

export function paymentMethodShort(method: string): string {
  return SHORT[method as PaymentMethodKind] ?? "Online";
}
