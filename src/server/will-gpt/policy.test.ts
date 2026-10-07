import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { isOffered, riskOf } from "./policy";

describe("riskOf", () => {
  test("queries only read", () => {
    assert.equal(riskOf("gigs.getAll", "query"), "read");
    assert.equal(riskOf("patrons.purge", "query"), "read");
  });

  test("plain creates and edits write without asking", () => {
    assert.equal(riskOf("gigs.create", "mutation"), "write");
    assert.equal(riskOf("gigs.update", "mutation"), "write");
    assert.equal(riskOf("rentals.adminCreatePackage", "mutation"), "write");
  });

  test("anything else asks first, including verbs nobody listed", () => {
    assert.equal(riskOf("gigs.delete", "mutation"), "destructive");
    assert.equal(riskOf("gigs.saveAll", "mutation"), "destructive");
    assert.equal(riskOf("notify.send", "mutation"), "destructive");
    assert.equal(riskOf("ticketEvents.setStatus", "mutation"), "destructive");
    assert.equal(riskOf("gigs.someVerbAddedLater", "mutation"), "destructive");
  });

  test("overrides beat the verb both ways", () => {
    assert.equal(riskOf("invites.create", "mutation"), "destructive");
    assert.equal(riskOf("users.addPermission", "mutation"), "destructive");
    assert.equal(riskOf("homeGigs.setPlacements", "mutation"), "write");
  });
});

describe("isOffered", () => {
  test("offers every read, including public ones", () => {
    assert.equal(isOffered("crew.getAll", "query", undefined), true);
  });

  test("offers only staff writes", () => {
    assert.equal(
      isOffered("gigs.create", "mutation", { permission: "ADMIN" }),
      true,
    );
    assert.equal(
      isOffered("ticketEvents.create", "mutation", {
        permission: "EVENT_ORGANISER",
      }),
      true,
    );
    assert.equal(
      isOffered("creatorThemes.create", "mutation", { permission: "CREATOR" }),
      false,
    );
    assert.equal(
      isOffered("ticketCheckout.start", "mutation", undefined),
      false,
    );
  });

  test("never offers Will GPT to itself", () => {
    assert.equal(
      isOffered("willGpt.run", "mutation", { permission: "ADMIN" }),
      false,
    );
  });
});
