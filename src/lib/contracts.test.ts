import { describe, expect, test } from "bun:test";

import {
  hireDetails,
  performerDetails,
  type RentalForContract,
  type SetArtistForContract,
} from "~/lib/contracts";

// 11:30 pm NZDT on Saturday 14 November 2026.
const setStart = new Date("2026-11-14T10:30:00Z");

const setArtist: SetArtistForContract = {
  artistProfile: {
    displayName: "Nova",
    user: { name: "Aroha Smith", email: "aroha@example.com" },
  },
  item: {
    startsAt: setStart,
    endsAt: new Date("2026-11-14T12:00:00Z"),
    gig: {
      title: "Atmos Summer Opener",
      gigStartTime: new Date("2026-11-14T08:00:00Z"),
      venue: { name: "The Loft", address: "12 Cuba Street" },
    },
  },
};

describe("performerDetails", () => {
  test("fills the booking from the set, in New Zealand time", () => {
    const { setTime, arriveBy, ...rest } = performerDetails(setArtist, "Will");

    expect(rest).toEqual({
      legalName: "Aroha Smith",
      stageName: "Nova",
      email: "aroha@example.com",
      event: "Atmos Summer Opener",
      venue: "The Loft, 12 Cuba Street",
      date: "Saturday 14 November 2026",
      setLength: "90 minutes",
      atmosContact: "Will",
    });
    // Bun and browsers disagree on the space in "11:30 pm", so compare loosely.
    expect(setTime.replace(/\s/g, "")).toBe("11:30pm");
    expect(arriveBy.replace(/\s/g, "")).toBe("11:00pm");
  });

  test("dates a set after midnight on the day it is played", () => {
    const late = new Date("2026-11-14T11:30:00Z"); // 12:30 am Sunday
    const details = performerDetails(
      { ...setArtist, item: { ...setArtist.item, startsAt: late } },
      "",
    );

    expect(details.date).toBe("Sunday 15 November 2026");
  });

  test("leaves blanks for an unclaimed profile on an untimed set", () => {
    const details = performerDetails(
      {
        artistProfile: { displayName: "Kessler", user: null },
        item: {
          startsAt: null,
          endsAt: null,
          gig: { ...setArtist.item.gig, venue: null },
        },
      },
      "",
    );

    expect(details).toEqual({
      legalName: "",
      stageName: "Kessler",
      email: "",
      event: "Atmos Summer Opener",
      venue: "",
      date: "Saturday 14 November 2026",
      setTime: "",
      setLength: "",
      arriveBy: "",
      atmosContact: "",
    });
  });
});

describe("hireDetails", () => {
  const rental: RentalForContract = {
    userName: "Sam Taylor",
    contactInfo: "sam@example.com",
    startDate: new Date("2026-11-19T11:00:00Z"), // Friday 20 November, NZ
    endDate: new Date("2026-11-21T11:00:00Z"),
    discountedDailyPrice: 180,
    estimatedTotalPrice: 540,
    gearPackage: {
      items: [{ quantity: 2, gearItem: { name: "Speaker" } }],
    },
    rentalItems: [],
  };

  test("lists a package's gear and prices the hire", () => {
    expect(hireDetails(rental)).toEqual({
      name: "Sam Taylor",
      email: "sam@example.com",
      collection: "Friday 20 November 2026",
      return: "Sunday 22 November 2026",
      hireFee: "$540.00",
      dailyRate: "$180.00",
      items: [{ name: "Speaker", quantity: "2" }],
    });
  });

  test("lists hand-picked items when there are any", () => {
    const details = hireDetails({
      ...rental,
      gearPackage: null,
      rentalItems: [{ quantity: 1, gearItem: { name: "CDJ-3000" } }],
    });

    expect(details.items).toEqual([{ name: "CDJ-3000", quantity: "1" }]);
  });
});
