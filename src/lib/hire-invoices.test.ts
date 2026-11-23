import { describe, expect, test } from "bun:test";

import {
  hireInvoiceDueAt,
  hirePaymentState,
  redactInvoiceToken,
} from "~/lib/hire-invoices";

// Collection on Sat 5 Dec 2026, stored as NZ midnight (NZDT, UTC+13).
const collection = new Date("2026-12-04T11:00:00.000Z");

describe("hireInvoiceDueAt", () => {
  test("is noon NZ, seven calendar days after collection", () => {
    const signed = new Date("2026-12-01T02:00:00.000Z");
    // Noon NZDT on Sat 12 Dec.
    expect(hireInvoiceDueAt(collection, signed).toISOString()).toBe(
      "2026-12-11T23:00:00.000Z",
    );
  });

  test("keeps the calendar day across the end of daylight saving", () => {
    // Collection at NZ midnight on Fri 2 Apr 2027; daylight saving ends on the 4th.
    const april = new Date("2027-04-01T11:00:00.000Z");
    // Noon NZST on Fri 9 Apr.
    expect(
      hireInvoiceDueAt(
        april,
        new Date("2027-03-30T00:00:00.000Z"),
      ).toISOString(),
    ).toBe("2027-04-09T00:00:00.000Z");
  });

  test("stands when signed on the due day before noon", () => {
    const morning = new Date("2026-12-11T20:00:00.000Z"); // 9am Sat 12 Dec NZ
    expect(hireInvoiceDueAt(collection, morning).toISOString()).toBe(
      "2026-12-11T23:00:00.000Z",
    );
  });

  test("moves to tomorrow when signed after it has passed", () => {
    const signedLate = new Date("2026-12-20T02:00:00.000Z"); // 3pm Sun 20 Dec NZ
    // Noon NZDT on Mon 21 Dec, the same all day.
    expect(hireInvoiceDueAt(collection, signedLate).toISOString()).toBe(
      "2026-12-20T23:00:00.000Z",
    );
    expect(
      hireInvoiceDueAt(collection, new Date("2026-12-20T10:00:00.000Z")),
    ).toEqual(hireInvoiceDueAt(collection, signedLate));
  });
});

describe("hirePaymentState", () => {
  const dueAt = new Date("2026-12-11T23:00:00.000Z"); // noon Sat 12 Dec in NZ

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

test("redactInvoiceToken hides pay tokens in URLs and element chains", () => {
  expect(
    redactInvoiceToken("https://atmosmedia.co.nz/invoices/abc_DEF-123?x=1"),
  ).toBe("https://atmosmedia.co.nz/invoices/redacted?x=1");
  expect(redactInvoiceToken('a:attr__href="/invoices/abc-123"')).toBe(
    'a:attr__href="/invoices/redacted"',
  );
});
