import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { MAX_RECIPIENTS, scopeForTarget, sendRequest } from "./send-request";

/** Unwraps a parse expected to succeed. */
function ok(body: unknown) {
  const result = sendRequest.safeParse(body);
  if (!result.success) assert.fail(result.error.message);
  return result.data;
}

function fails(body: unknown) {
  assert.equal(sendRequest.safeParse(body).success, false);
}

describe("send body", () => {
  test("a topic send gets ntfy's defaults", () => {
    const body = ok({ to: { topic: "team" }, message: "Card reader is down" });
    assert.deepEqual(body.to, { topic: "team" });
    assert.equal(body.priority, 3);
    assert.deepEqual(body.tags, []);
  });

  test("users and devices are deduplicated", () => {
    assert.deepEqual(ok({ to: { users: ["a", "b", "a"] }, message: "hi" }).to, {
      users: ["a", "b"],
    });
    assert.deepEqual(ok({ to: { devices: ["d"] }, message: "hi" }).to, {
      devices: ["d"],
    });
  });

  test("priority takes ntfy's names as well as numbers", () => {
    assert.equal(
      ok({ to: { topic: "team" }, message: "m", priority: "high" }).priority,
      4,
    );
    assert.equal(
      ok({ to: { topic: "team" }, message: "m", priority: 1 }).priority,
      1,
    );
    fails({ to: { topic: "team" }, message: "m", priority: 6 });
    fails({ to: { topic: "team" }, message: "m", priority: "loud" });
  });

  test("exactly one target", () => {
    fails({ to: { topic: "team", users: ["a"] }, message: "m" });
    fails({ to: {}, message: "m" });
    fails({ message: "m" });
  });

  test("bad targets", () => {
    fails({ to: { topic: "team,door" }, message: "m" });
    fails({ to: { users: [] }, message: "m" });
    const tooMany = Array.from(
      { length: MAX_RECIPIENTS + 1 },
      (_, i) => `u${i}`,
    );
    fails({ to: { users: tooMany }, message: "m" });
  });

  test("a misspelt field is refused, not ignored", () => {
    fails({ to: { topic: "team" }, body: "Card reader is down" });
    fails({ to: { topic: "team" }, message: "m", sound: "loud" });
  });

  test("a blank message is refused", () => {
    fails({ to: { topic: "team" }, message: "   " });
  });
});

describe("scope for a target", () => {
  test("announcements need their own scope", () => {
    assert.equal(scopeForTarget({ topic: "team" }), "notifications:topic");
    assert.equal(
      scopeForTarget({ topic: "announcements" }),
      "notifications:announce",
    );
  });

  test("people and devices are direct", () => {
    assert.equal(scopeForTarget({ users: ["a"] }), "notifications:direct");
    assert.equal(scopeForTarget({ devices: ["d"] }), "notifications:direct");
  });
});
