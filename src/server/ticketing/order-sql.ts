import { Prisma } from "~Prisma/client";

/**
 * SQL fragments over `ticket_order o`, shared by the analytics and the
 * campaign results so "bought" and "a checkout" mean the same everywhere.
 */

/**
 * Orders somebody went through a checkout for: paid, and not a comp, an admin
 * link or a lifetime pass, which are minted as paid orders nobody bought.
 */
export const BOUGHT_ORDER = Prisma.sql`
  o.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
  AND o."paymentMethod" NOT IN ('COMP', 'ADMIN', 'LIFETIME')
  AND o."paidAt" IS NOT NULL
`;

/** Started on the website, by a buyer, rather than sold at the door. */
export const ONLINE_ORDER = Prisma.sql`
  o."paymentMethod" IN ('STRIPE', 'FREE') AND o."soldByUserId" IS NULL
`;

/**
 * One buyer's visit. Changing the basket swaps the held order for a new one,
 * so counting orders would count one buyer several times. Orders from before
 * visits were recorded fall back to the buyer's address, then to themselves.
 */
export const VISIT = Prisma.sql`COALESCE(o."visitId", o."ipAddress", o.id)`;
