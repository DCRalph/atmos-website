import { describe, expect, test } from "bun:test";

import {
  classifyDecline,
  declineReasonLabel,
  paymentCardLabel,
  summariseDeclines,
  type DeclineRow,
} from "./declines";

const at = (second: number) => new Date(Date.UTC(2026, 9, 14, 7, 0, second));
const visa = (cardLast4: string) => ({
  paidWith: "card",
  cardBrand: "visa",
  cardLast4,
});

const row = (overrides: Partial<DeclineRow>): DeclineRow => ({
  orderId: "o1",
  orderNumber: "ATN-1",
  eventId: "e1",
  status: "FAILED",
  buyerName: null,
  email: "buyer@example.com",
  totalCents: 1200,
  paidAt: null,
  declinedAt: at(0),
  reason: "insufficient_funds",
  declined: visa("4410"),
  accepted: null,
  next: null,
  ...overrides,
});

describe("classifyDecline", () => {
  test("a retry on the same order that paid", () => {
    const decline = classifyDecline(
      row({
        status: "PAID",
        paidAt: at(41),
        accepted: { at: at(40), ...visa("4410") },
      }),
    );
    expect(decline.outcome).toBe("retried");
    expect(decline.paidAt).toEqual(at(40));
    expect(decline.switched).toBe(false);
  });

  test("a new order after giving up on this one", () => {
    const decline = classifyDecline(
      row({
        next: {
          id: "o2",
          orderNumber: "ATN-2",
          paidAt: at(113),
          ...visa("5036"),
        },
      }),
    );
    expect(decline.outcome).toBe("new_order");
    expect(decline.nextOrder).toEqual({ id: "o2", orderNumber: "ATN-2" });
    expect(decline.switched).toBe(true);
  });

  test("money taken on an order that was never issued", () => {
    const decline = classifyDecline(
      row({ accepted: { at: at(11), ...visa("3305") } }),
    );
    expect(decline.outcome).toBe("no_tickets");
    expect(decline.paidAt).toEqual(at(11));
  });

  test("still no tickets once that payment is refunded", () => {
    const decline = classifyDecline(
      row({ status: "REFUNDED", accepted: { at: at(11), ...visa("3305") } }),
    );
    expect(decline.outcome).toBe("no_tickets");
  });

  test("never paid", () => {
    const decline = classifyDecline(row({}));
    expect(decline.outcome).toBe("lost");
    expect(decline.switched).toBe(null);
  });
});

describe("summariseDeclines", () => {
  test("counts who came back, what was lost and the median time back", () => {
    const summary = summariseDeclines([
      classifyDecline(
        row({
          status: "PAID",
          paidAt: at(40),
          accepted: { at: at(40), ...visa("4410") },
        }),
      ),
      classifyDecline(
        row({
          next: {
            id: "o2",
            orderNumber: "ATN-2",
            paidAt: at(120),
            ...visa("5036"),
          },
        }),
      ),
      classifyDecline(row({ totalCents: 1000, reason: "generic_decline" })),
    ]);
    const { reasons, ...counts } = summary;
    expect(counts).toEqual({
      declined: 3,
      cameBack: 2,
      retried: 1,
      newOrder: 1,
      lost: 1,
      noTickets: 0,
      recoveredCents: 2400,
      lostCents: 1000,
      secondsBack: 80,
      sameCard: 1,
      switched: 1,
    });
    expect(reasons).toEqual([
      { label: "Insufficient funds", n: 2 },
      { label: "Declined", n: 1 },
    ]);
  });
});

describe("labels", () => {
  test("an unknown decline reason still reads", () => {
    expect(declineReasonLabel("new_kind_of_decline")).toBe(
      "New kind of decline",
    );
    expect(declineReasonLabel(null)).toBe("Declined");
  });

  test("wallets by name, cards by brand", () => {
    expect(paymentCardLabel(visa("4410"))).toBe("Visa ••4410");
    expect(
      paymentCardLabel({
        paidWith: "apple_pay",
        cardBrand: "visa",
        cardLast4: "7712",
      }),
    ).toBe("Apple Pay ••7712");
    expect(
      paymentCardLabel({
        paidWith: "afterpay_clearpay",
        cardBrand: null,
        cardLast4: null,
      }),
    ).toBe("Afterpay");
  });
});
