import { describe, expect, test } from "bun:test";

import { hireInvoiceDueAt, hirePaymentState } from "~/lib/hire-invoices";

// Collection on Sat 5 Dec 2026, stored as NZ midnight (NZDT, UTC+13).
const collection = new Date("2026-12-04T11:00:00.000Z");

describe("hireInvoiceDueAt", () => {
  test("is seven days after collection", () => {
    const signed = new Date("2026-12-01T02:00:00.000Z");
    expect(hireInvoiceDueAt(collection, signed).toISOString()).toBe(
      "2026-12-11T11:00:00.000Z",
    );
  });

  test("moves to a day from now when signed after it has passed", () => {
    const signedLate = new Date("2026-12-20T02:00:00.000Z");
    expect(hireInvoiceDueAt(collection, signedLate).toISOString()).toBe(
      "2026-12-21T02:00:00.000Z",
    );
  });
});

describe("hirePaymentState", () => {
  const dueAt = new Date("2026-12-11T11:00:00.000Z"); // Sat 12 Dec in NZ

  test("follows the agreement until there is an invoice", () => {
    expect(hirePaymentState(null, null, collection)).toBe(null);
    expect(hirePaymentState("DRAFT", null, collection)).toBe(null);
    expect(hirePaymentState("SENT", null, collection)?.label).toBe(
      "Awaiting signature",
    );
    expect(hirePaymentState("SIGNED", null, collection)).toEqual({
      label: "Not invoiced",
      tone: "warn",
    });
  });

  test("counts an open invoice's due date on the NZ calendar", () => {
    const open = { status: "OPEN" as const, dueAt };
    expect(hirePaymentState("SIGNED", open, collection)).toEqual({
      label: "Due 12 Dec",
      tone: "warn",
    });
    // 11pm on the due day in NZ is still the due day.
    expect(
      hirePaymentState("SIGNED", open, new Date("2026-12-12T10:00:00.000Z"))
        ?.label,
    ).toBe("Due today");
    expect(
      hirePaymentState("SIGNED", open, new Date("2026-12-12T12:00:00.000Z")),
    ).toEqual({ label: "Overdue 1 day", tone: "bad" });
    expect(
      hirePaymentState("SIGNED", open, new Date("2026-12-15T01:00:00.000Z"))
        ?.label,
    ).toBe("Overdue 3 days");
  });

  test("settled invoices say so", () => {
    expect(
      hirePaymentState("SIGNED", { status: "PAID", dueAt }, collection),
    ).toEqual({ label: "Paid", tone: "ok" });
    expect(
      hirePaymentState("SIGNED", { status: "VOID", dueAt }, collection)?.label,
    ).toBe("Void");
  });
});
