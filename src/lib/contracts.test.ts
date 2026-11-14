import { describe, expect, test } from "bun:test";

import {
  atmosParty,
  CONTRACT_VERSION,
  contractDefaults,
  defaultBondCents,
  editedOnly,
  HIRE_COLUMN_FIELDS,
  hireColumns,
  hireFields,
  hireFieldsSchema,
  maskAccountNumber,
  NO_DEFAULTS,
  PERFORMER_COLUMN_FIELDS,
  performerColumns,
  performerFields,
  performerFieldsSchema,
  resolveFields,
  tidyHireFields,
  tidyPerformerFields,
  type RentalForContract,
  type SetArtistForContract,
} from "~/lib/contracts";

const defaults = contractDefaults(
  {
    legalEntity: "Example Limited",
    nzbn: "9429000000000",
    contactPhone: "021 000 0000",
    defaultBond: "20%",
    versionLabel: "",
  },
  "Will",
);

// 11:30 pm NZDT on Saturday 14 November 2026.
const setStart = new Date("2026-11-14T10:30:00Z");

const setArtist: SetArtistForContract = {
  feeCents: 40000,
  feeIncludesGst: false,
  guestListPlaces: 2,
  contractNotes: null,
  artistProfile: {
    displayName: "Nova",
    user: { name: "Aroha S", email: "account@example.com" },
    privateDetails: {
      legalName: "Aroha Smith",
      contactEmail: null,
      phone: "021 555 0142",
      address: null,
      gstNumber: null,
      bankAccountName: "A Smith",
      bankAccountNumber: "12-3456-0123456-00",
    },
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

describe("performerFields", () => {
  test("fills the contract from the booking and the artist's private details", () => {
    const { setTime, arriveBy, ...rest } = performerFields(setArtist, defaults);

    expect(rest).toEqual({
      legalName: "Aroha Smith",
      stageName: "Nova",
      // No contact email entered, so the account's stands in.
      email: "account@example.com",
      phone: "021 555 0142",
      address: "",
      gstNumber: "",
      bankAccountName: "A Smith",
      bankAccountNumber: "12-3456-0123456-00",
      event: "Atmos Summer Opener",
      venue: "The Loft, 12 Cuba Street",
      date: "Saturday 14 November 2026",
      setLength: "90 minutes",
      guestListPlaces: "2",
      fee: "$400.00",
      gstIncluded: "No",
      atmosContact: "Will, 021 000 0000",
      notes: "",
      atmosParty:
        "Example Limited (NZBN 9429000000000), trading as Atmos Media",
      version: CONTRACT_VERSION,
    });
    // Bun and browsers disagree on the space in "11:30 pm", so compare loosely.
    expect(setTime.replace(/\s/g, "")).toBe("11:30pm");
    expect(arriveBy.replace(/\s/g, "")).toBe("11:00pm");
  });

  test("dates a set after midnight on the day it is played", () => {
    const late = new Date("2026-11-14T11:30:00Z"); // 12:30 am Sunday
    const fields = performerFields(
      { ...setArtist, item: { ...setArtist.item, startsAt: late } },
      NO_DEFAULTS,
    );

    expect(fields.date).toBe("Sunday 15 November 2026");
  });

  test("leaves blanks for an unclaimed profile on an untimed, unpriced set", () => {
    const fields = performerFields(
      {
        feeCents: null,
        feeIncludesGst: null,
        guestListPlaces: null,
        contractNotes: null,
        artistProfile: {
          displayName: "Kessler",
          user: null,
          privateDetails: null,
        },
        item: {
          startsAt: null,
          endsAt: null,
          gig: { ...setArtist.item.gig, venue: null },
        },
      },
      NO_DEFAULTS,
    );

    expect(fields).toEqual({
      ...performerFieldsSchema.parse({}),
      stageName: "Kessler",
      event: "Atmos Summer Opener",
      date: "Saturday 14 November 2026",
    });
  });
});

const rental: RentalForContract = {
  userName: "Sam Taylor",
  contactInfo: "sam@example.com",
  startDate: new Date("2026-11-19T11:00:00Z"), // Friday 20 November, NZ
  endDate: new Date("2026-11-21T11:00:00Z"),
  discountedDailyPrice: 180,
  estimatedTotalPrice: 540,
  phone: null,
  organisation: null,
  address: null,
  useLocation: "Te Aro Park",
  collectionTime: "4:00 pm",
  returnTime: null,
  bondCents: 50000,
  gearPackage: {
    items: [
      {
        quantity: 2,
        gearItem: {
          name: "Speaker",
          replacementValueCents: 120000,
          serialNumbers: ["SPK-01", "SPK-02"],
        },
      },
    ],
  },
  rentalItems: [],
};

describe("hireFields", () => {
  test("lists a package's gear with its serials and replacement value", () => {
    expect(hireFields(rental, defaults)).toEqual({
      name: "Sam Taylor",
      organisation: "",
      email: "sam@example.com",
      phone: "",
      address: "",
      collectionDate: "Fri 20 Nov 2026",
      collectionTime: "4:00 pm",
      returnDate: "Sun 22 Nov 2026",
      returnTime: "",
      useLocation: "Te Aro Park",
      hireFee: "$540.00",
      dailyRate: "$180.00",
      bond: "$500.00",
      atmosContact: "Will, 021 000 0000",
      atmosParty:
        "Example Limited (NZBN 9429000000000), trading as Atmos Media",
      version: CONTRACT_VERSION,
      items: [
        {
          name: "Speaker",
          quantity: "2",
          serial: "SPK-01, SPK-02",
          replacementValue: "$1,200.00 each",
          condition: "",
        },
      ],
    });
  });

  test("starts an unbonded hire on the default bond", () => {
    // 20% of two $1,200 speakers.
    expect(hireFields({ ...rental, bondCents: null }, defaults).bond).toBe(
      "$480.00",
    );
    expect(defaultBondCents("500", [])).toBe(50000);
    expect(defaultBondCents("20%", [])).toBe(null);
    expect(defaultBondCents("", [])).toBe(null);
  });

  test("lists hand-picked items when there are any", () => {
    const fields = hireFields(
      {
        ...rental,
        gearPackage: null,
        rentalItems: [
          {
            quantity: 1,
            gearItem: {
              name: "CDJ-3000",
              replacementValueCents: null,
              serialNumbers: [],
            },
          },
        ],
      },
      NO_DEFAULTS,
    );

    expect(fields.items.map((item) => item.name)).toEqual(["CDJ-3000"]);
    expect(fields.items[0]?.replacementValue).toBe("");
  });
});

test("names Atmos by its brand until a legal entity is set", () => {
  expect(atmosParty({ legalEntity: "", nzbn: "9429000000000" })).toBe(
    "Atmos Media",
  );
  expect(atmosParty({ legalEntity: "Example Limited", nzbn: "" })).toBe(
    "Example Limited, trading as Atmos Media",
  );
});

describe("resolveFields", () => {
  // What the database said when the draft was saved, and the draft itself,
  // which deliberately says something else about the fee.
  const baseline = performerFields(setArtist, defaults);
  const saved = { ...baseline, fee: "TBC" };
  // Since then the set has moved and the phone number has been removed.
  const live = { ...baseline, setTime: "11:45 pm", phone: "" };

  test("shows the database until something is saved", () => {
    expect(
      resolveFields({
        live,
        saved: null,
        baseline: null,
        locked: false,
        refresh: false,
      }),
    ).toEqual({ fields: live, stale: [] });
  });

  test("shows a saved draft as saved, and names what the database changed since", () => {
    const resolved = resolveFields({
      live,
      saved,
      baseline,
      locked: false,
      refresh: false,
    });

    expect(resolved.fields).toEqual(saved);
    // The cleared phone counts. The fee does not: only the draft changed it.
    expect(resolved.stale).toEqual(["phone", "setTime"]);
  });

  test("takes the current values for those fields on refresh", () => {
    const resolved = resolveFields({
      live,
      saved,
      baseline,
      locked: false,
      refresh: true,
    });

    expect(resolved).toEqual({
      fields: { ...saved, setTime: "11:45 pm", phone: "" },
      stale: [],
    });
  });

  test("never moves a sent contract, or one opened by another admin", () => {
    expect(
      resolveFields({ live, saved, baseline, locked: true, refresh: true }),
    ).toEqual({ fields: saved, stale: [] });

    const reopened = { ...baseline, atmosContact: "Someone else" };
    expect(
      resolveFields({
        live: reopened,
        saved: baseline,
        baseline,
        locked: false,
        refresh: false,
      }).stale,
    ).toEqual([]);
  });
});

describe("writing a saved contract back", () => {
  test("only sends back the fields that were edited", () => {
    const before = performerFields(setArtist, defaults);
    const after = { ...before, fee: "$450", phone: "" };
    const columns = performerColumns(after);

    expect(
      editedOnly(
        columns.booking,
        PERFORMER_COLUMN_FIELDS.booking,
        before,
        after,
      ),
    ).toEqual({ feeCents: 45000 });
    expect(
      editedOnly(
        columns.privateDetails,
        PERFORMER_COLUMN_FIELDS.privateDetails,
        before,
        after,
      ),
    ).toEqual({ phone: null });
  });

  test("turns typed text into columns, and into null when it does not parse", () => {
    const fields = performerFieldsSchema.parse({
      fee: "TBC",
      gstIncluded: "y",
      guestListPlaces: "plus one",
      notes: " Rider: two waters ",
    });

    expect(performerColumns(fields).booking).toEqual({
      feeCents: null,
      feeIncludesGst: true,
      guestListPlaces: null,
      contractNotes: "Rider: two waters",
    });
  });

  test("saves the hire agreement's own fields to the rental", () => {
    const before = hireFields(rental, defaults);
    const after = {
      ...before,
      name: "Samantha Taylor",
      bond: "300",
      organisation: "Loft Events",
    };

    expect(
      editedOnly(hireColumns(after), HIRE_COLUMN_FIELDS, before, after),
    ).toEqual({
      userName: "Samantha Taylor",
      bondCents: 30000,
      organisation: "Loft Events",
    });
  });

  test("saves money and answers the way the database prints them back", () => {
    const typed = performerFieldsSchema.parse({
      fee: " 400 ",
      gstIncluded: "n",
      guestListPlaces: "plus one",
    });
    const tidy = tidyPerformerFields(typed);

    expect([tidy.fee, tidy.gstIncluded, tidy.guestListPlaces]).toEqual([
      "$400.00",
      "No",
      "plus one",
    ]);
  });

  test("drops equipment rows nobody typed in", () => {
    const fields = hireFieldsSchema.parse({
      bond: "500",
      items: [{ name: "Speaker", quantity: "2" }, {}, { condition: " " }],
    });
    const tidy = tidyHireFields(fields);

    expect(tidy.bond).toBe("$500.00");
    expect(tidy.items.map((item) => item.name)).toEqual(["Speaker"]);
  });
});

test("masks a bank account number down to its last four digits", () => {
  expect(maskAccountNumber("12-3456-0123456-00")).toBe("••-••••-•••••56-00");
  expect(maskAccountNumber("123")).toBe("123");
});
