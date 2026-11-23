import { expect, test } from "bun:test";

import { redactShareToken, shareTokenFromPath } from "./share-link";

test("a share page's token is read from its path, and from no other page", () => {
  expect(shareTokenFromPath("/share/abc_123")).toBe("abc_123");
  expect(shareTokenFromPath("/share/abc_123/live")).toBe("abc_123");
  expect(shareTokenFromPath("/organiser/events/share")).toBe(null);
});

test("analytics never gets a share token, whatever follows it", () => {
  expect(
    redactShareToken("https://atmosmedia.co.nz/share/abc_123/live?mode=sales"),
  ).toBe("https://atmosmedia.co.nz/share/redacted/live?mode=sales");
  expect(redactShareToken("/share/abc_123?tab=orders")).toBe(
    "/share/redacted?tab=orders",
  );
  expect(redactShareToken("/events/share-the-night")).toBe(
    "/events/share-the-night",
  );
});
