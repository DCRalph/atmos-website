import { z } from "zod";

const tickets = z
  .number({ error: "Enter a whole number of tickets." })
  .int("Enter a whole number of tickets.")
  .min(0, "Ticket counts cannot be negative.")
  .max(1_000_000, "Enter no more than 1,000,000 tickets.");
const cents = z
  .number({ error: "Enter an amount with up to two decimal places." })
  .int()
  .min(0, "Amounts cannot be negative.")
  .max(1_000_000_000, "Enter no more than $10,000,000.");

export const doorTotalsSchema = z
  .object({
    cashTickets: tickets,
    cashCents: cents,
    eftposTickets: tickets,
    eftposCents: cents,
    notes: z.string().trim().max(500),
  })
  .superRefine((totals, ctx) => {
    for (const method of ["cash", "eftpos"] as const) {
      if (totals[`${method}Cents`] > 0 && totals[`${method}Tickets`] === 0) {
        ctx.addIssue({
          code: "custom",
          path: [`${method}Tickets`],
          message: "Enter how many tickets these takings cover.",
        });
      }
    }
  });

export type DoorTotals = z.infer<typeof doorTotalsSchema>;

/** Aggregate historical sales without treating them as orders or admissions. */
export function sumDoorTotals(
  totals: Pick<
    DoorTotals,
    "cashTickets" | "cashCents" | "eftposTickets" | "eftposCents"
  > | null,
) {
  return {
    tickets: totals ? totals.cashTickets + totals.eftposTickets : 0,
    revenueCents: totals ? totals.cashCents + totals.eftposCents : 0,
  };
}
