import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  createStandalonePassDraft,
  walletPassDebugDraftSchema,
  walletPassDebugRequestSchema,
} from "./wallet-pass-debug";

function draft() {
  return createStandalonePassDraft({
    passTypeIdentifier: "pass.nz.co.atmos.debug",
    teamIdentifier: "ATMOS123",
    serialNumber: "atmos.debug.test",
    now: new Date("2026-09-07T00:00:00.000Z"),
  });
}

describe("standalone Wallet pass draft", () => {
  test("is valid and contains no ticketing or update linkage", () => {
    const value = walletPassDebugDraftSchema.parse(draft());

    assert.equal(value.manifest.serialNumber, "atmos.debug.test");
    assert.equal(value.manifest.webServiceURL, undefined);
    assert.equal(value.manifest.authenticationToken, undefined);
    assert.equal(value.manifest.relevantDate, "2026-09-14T00:00:00.000Z");
    assert.ok(Array.isArray(value.manifest.barcodes));
  });

  test("requires a recipient only for email delivery", () => {
    assert.equal(
      walletPassDebugRequestSchema.safeParse({
        action: "download",
        draft: draft(),
      }).success,
      true,
    );
    assert.equal(
      walletPassDebugRequestSchema.safeParse({
        action: "send",
        draft: draft(),
      }).success,
      false,
    );
  });

  test("rejects asset paths outside the pass bundle", () => {
    const value = draft();
    value.assets.push({
      fileName: "../icon.png",
      dataBase64: "aGVsbG8=",
    });
    assert.equal(walletPassDebugDraftSchema.safeParse(value).success, false);
  });

  test("accepts localized image variants", () => {
    const value = draft();
    value.assets.push({
      fileName: "zh-Hans-CN.lproj/thumbnail@2x.png",
      dataBase64: "aGVsbG8=",
    });
    value.localizations.push({
      language: "zh-Hans-CN",
      translations: { EVENT: "\u6d3b\u52a8" },
    });
    assert.equal(walletPassDebugDraftSchema.safeParse(value).success, true);
  });
});
