import { describe, expect, test } from "bun:test";

import {
  maskEmail,
  offerAmountCents,
  readOfferId,
  signOfferId,
} from "./refund-offers";

describe("offerAmountCents", () => {
  // Two $40 tickets and a $6 booking fee.
  const order = {
    totalCents: 8600,
    refundedCents: 0,
    subtotalCents: 8000,
    discountCents: 0,
    tickets: [{ pricePaidCents: 4000 }, { pricePaidCents: 4000 }],
  };

  test("everything is what is left of what they paid", () => {
    expect(offerAmountCents(order, "everything")).toBe(8600);
  });

  test("tickets only keeps the booking fee", () => {
    expect(offerAmountCents(order, "ticketsOnly")).toBe(8000);
  });

  test("tickets only takes the discount off, never the fee", () => {
    // $80 of tickets with $20 off, plus the $6 fee: $66 paid.
    const discounted = { ...order, totalCents: 6600, discountCents: 2000 };
    expect(offerAmountCents(discounted, "ticketsOnly")).toBe(6000);
    expect(offerAmountCents(discounted, "everything")).toBe(6600);
  });

  test("never more than is left after an earlier refund", () => {
    const partly = {
      ...order,
      refundedCents: 4300,
      tickets: [{ pricePaidCents: 4000 }],
    };
    expect(offerAmountCents(partly, "everything")).toBe(4300);
    expect(offerAmountCents(partly, "ticketsOnly")).toBe(4000);
    expect(
      offerAmountCents({ ...order, refundedCents: 8600 }, "ticketsOnly"),
    ).toBe(0);
  });
});

describe("offer links", () => {
  test("round trip, and refuse an edited id or the wrong key", () => {
    const token = signOfferId("key", "offer1");
    expect(readOfferId("key", token)).toBe("offer1");
    expect(readOfferId("key", token.replace("offer1", "offer2"))).toBe(null);
    expect(readOfferId("other", token)).toBe(null);
    expect(readOfferId("key", "offer1")).toBe(null);
  });
});

test("maskEmail keeps the first letter and the domain", () => {
  expect(maskEmail("sam.taylor@gmail.com")).toBe("s•••@gmail.com");
});
