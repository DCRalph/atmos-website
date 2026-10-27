import { describe, expect, test } from "bun:test";

import { headcountTimeline, leadTime, ticketChannel } from "./event-summary";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 10, 9, minute));

describe("ticketChannel", () => {
  test("staff-issued comps and links are not door sales", () => {
    expect(
      ticketChannel({ paymentMethod: "COMP", atDoor: true, isComp: true }),
    ).toBe("COMP");
    expect(
      ticketChannel({ paymentMethod: "ADMIN", atDoor: true, isComp: false }),
    ).toBe("LINK");
  });

  test("door sales split by how they paid", () => {
    expect(
      ticketChannel({
        paymentMethod: "TAP_TO_PAY",
        atDoor: true,
        isComp: false,
      }),
    ).toBe("DOOR_TAP");
    expect(
      ticketChannel({ paymentMethod: "TERMINAL", atDoor: true, isComp: false }),
    ).toBe("DOOR_EFTPOS");
    expect(
      ticketChannel({ paymentMethod: "CASH", atDoor: true, isComp: false }),
    ).toBe("DOOR_CASH");
  });

  test("a website order is online, paid or free", () => {
    expect(
      ticketChannel({ paymentMethod: "STRIPE", atDoor: false, isComp: false }),
    ).toBe("ONLINE");
    expect(
      ticketChannel({ paymentMethod: "FREE", atDoor: false, isComp: false }),
    ).toBe("FREE");
  });
});

describe("headcountTimeline", () => {
  test("departures bring the count down and the peak stays put", () => {
    const { points, peak } = headcountTimeline([
      { ticketId: "a", result: "ADMITTED", at: at(0) },
      { ticketId: "b", result: "ADMITTED", at: at(1) },
      // A duplicate scan of someone already inside changes nothing.
      { ticketId: "a", result: "DUPLICATE", at: at(2) },
      { ticketId: "a", result: "DEPARTED", at: at(3) },
      { ticketId: "a", result: "REENTRY", at: at(4) },
      { ticketId: "b", result: "ADMISSION_REVERTED", at: at(5) },
    ]);

    expect(points.map((point) => point.y)).toEqual([1, 2, 1, 2, 1]);
    expect(peak).toEqual({ count: 2, at: at(1) });
  });

  test("no scans, no peak", () => {
    expect(headcountTimeline([])).toEqual({ points: [], peak: null });
  });
});

describe("leadTime", () => {
  test("buckets by hours before doors", () => {
    expect(leadTime(-1)).toBe("night");
    expect(leadTime(0)).toBe("day");
    expect(leadTime(24)).toBe("week");
    expect(leadTime(24 * 7)).toBe("month");
    expect(leadTime(24 * 28)).toBe("early");
  });
});
