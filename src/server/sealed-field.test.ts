import { describe, expect, test } from "bun:test";

import { openField, sealField } from "~/server/sealed-field";

describe("sealed fields", () => {
  const sealed = sealField("12-3456-0123456-00", "artist-1", "secret");

  test("round trip without storing the value in the clear", () => {
    expect(sealed.includes("3456")).toBe(false);
    expect(openField(sealed, "artist-1", "secret")).toBe("12-3456-0123456-00");
  });

  test("do not open on another row or under another secret", () => {
    expect(() => openField(sealed, "artist-2", "secret")).toThrow();
    expect(() => openField(sealed, "artist-1", "other")).toThrow();
  });
});
