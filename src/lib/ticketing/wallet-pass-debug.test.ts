import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  applyPatch,
  blankDraft,
  walletPassDebugDraftSchema,
  walletPassDebugRequestSchema,
} from "./wallet-pass-debug";

describe("applyPatch", () => {
  const base = {
    serialNumber: "t1",
    logoText: "ATMOS",
    semantics: { eventName: "Night", venueName: "Shed" },
    eventTicket: {
      headerFields: [{ key: "doors", value: "10 pm" }],
      backFields: [{ key: "terms", value: "..." }],
    },
  };

  test("top-level keys replace, null removes", () => {
    const out = applyPatch(base, { logoText: null, description: "Test" });
    assert.equal(out.logoText, undefined);
    assert.equal(out.description, "Test");
    assert.equal(out.serialNumber, "t1");
  });

  test("a slot edit leaves the other slots alone", () => {
    const out = applyPatch(base, {
      eventTicket: { headerFields: [{ key: "gate", value: "B" }] },
    });
    assert.deepEqual(out.eventTicket, {
      headerFields: [{ key: "gate", value: "B" }],
      backFields: [{ key: "terms", value: "..." }],
    });
  });

  test("semantics merge key by key and a null drops one", () => {
    const out = applyPatch(base, {
      semantics: { venueName: null, performerNames: ["A"] },
    });
    assert.deepEqual(out.semantics, {
      eventName: "Night",
      performerNames: ["A"],
    });
  });
});

describe("debug draft", () => {
  const draft = () => blankDraft({ kind: "standalone" });

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
    value.assets.push({ fileName: "../icon.png", dataBase64: "aGVsbG8=" });
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
