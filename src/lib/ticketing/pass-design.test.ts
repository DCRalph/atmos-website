import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { DEFAULT_PASS_THEME } from "./pass-theme";
import {
  normaliseEventPassDesign,
  resolvePassDesign,
  resolveTicketPassDesign,
  type PassLevel,
} from "./pass-design";

const AAA: PassLevel = {
  code: "AAA",
  short: "AAA",
  rank: 3,
  passDesign: { accentHex: "#C9A227", backgroundHex: "#111111" },
};

describe("resolveTicketPassDesign", () => {
  test("takes each field from the first layer that sets it", () => {
    const { design } = resolveTicketPassDesign(
      {
        stripStyle: "PHOTO",
        stripImageId: "event-photo",
        backgroundHex: "#222222",
        labelHex: "#333333",
        levels: { AAA: { backgroundHex: "#444444" } },
      },
      AAA,
    );

    assert.equal(design.backgroundHex, "#444444"); // this level here
    assert.equal(design.accentHex, "#C9A227"); // the level
    assert.equal(design.labelHex, "#333333"); // the event
    assert.equal(design.stripImageId, "event-photo");
    assert.equal(design.foregroundHex, DEFAULT_PASS_THEME.foregroundHex);
  });

  test("chips a level above GA only when it brings its own accent", () => {
    assert.ok(resolveTicketPassDesign({}, AAA).chip);
    assert.equal(
      resolveTicketPassDesign({}, { ...AAA, passDesign: {} }).chip,
      null,
    );
    assert.equal(
      resolveTicketPassDesign(
        { accentHex: "#ff0000" },
        { ...AAA, passDesign: {} },
      ).chip,
      null,
    );
    assert.equal(resolveTicketPassDesign({}, { ...AAA, rank: 0 }).chip, null);
  });

  test("an explicit chip setting beats the rank rule", () => {
    assert.equal(
      resolveTicketPassDesign({ levels: { AAA: { showChip: false } } }, AAA)
        .chip,
      null,
    );
    assert.ok(
      resolveTicketPassDesign(
        {},
        { ...AAA, rank: 0, passDesign: { showChip: true } },
      ).chip,
    );
  });
});

describe("resolvePassDesign", () => {
  test("a photo band with no photo falls back to the house band", () => {
    const design = resolvePassDesign([{ stripStyle: "PHOTO" }]);
    assert.equal(design.stripStyle, DEFAULT_PASS_THEME.stripStyle);
    assert.equal(design.stripImageId, null);
  });

  test("a photo set on a lower layer is not drawn under a themed band", () => {
    const design = resolvePassDesign([
      { stripStyle: "BARS" },
      { stripStyle: "PHOTO", stripImageId: "photo" },
    ]);
    assert.equal(design.stripStyle, "BARS");
    assert.equal(design.stripImageId, null);
  });
});

describe("normaliseEventPassDesign", () => {
  test("drops empty level overrides and sorts the rest", () => {
    assert.deepEqual(
      JSON.stringify(
        normaliseEventPassDesign({
          levels: {
            VIP: { showChip: true },
            GA: {},
            AAA: { showTitle: false },
          },
        }),
      ),
      JSON.stringify({
        levels: { AAA: { showTitle: false }, VIP: { showChip: true } },
      }),
    );
  });
});
