import { describe, mock, test } from "bun:test";
import assert from "node:assert/strict";

import { ALL_SCOPES, isApiScope, SCOPE_PRESETS } from "~/lib/developer/scopes";
import { milestonesCrossed } from "~/lib/developer/updates";
import { updateFromActivity } from "./update-from-activity";

// Bun runs outside React; the server-only marker is a no-op in the server runtime.
mock.module("server-only", () => ({}));
const { ENDPOINTS, matchEndpoint } = await import("./registry");
const { openApiSpec } = await import("./openapi");
const { requiredScopes, scopesOf } = await import("./endpoint");

describe("endpoint list", () => {
  test("no two endpoints share a method and path", () => {
    const seen = ENDPOINTS.map((e) => `${e.method} ${e.path}`);
    assert.equal(new Set(seen).size, seen.length);
  });

  test("every scope an endpoint names exists", () => {
    for (const endpoint of ENDPOINTS) {
      for (const scope of [
        ...scopesOf(endpoint.scope),
        ...(endpoint.widenedBy ?? []),
      ]) {
        assert.ok(isApiScope(scope), `${endpoint.path}: ${scope}`);
      }
    }
  });

  test("matches paths with their params, and says which methods a path takes", () => {
    const found = matchEndpoint("GET", "/events/ev1/stats");
    assert.equal(found.kind, "found");
    assert.deepEqual(found.kind === "found" && found.params, { id: "ev1" });
    assert.deepEqual(matchEndpoint("PUT", "/gigs"), {
      kind: "wrong_method",
      allow: ["GET", "POST"],
    });
    assert.equal(matchEndpoint("GET", "/gigs/a/b/c").kind, "none");
  });

  test("the spec builds, with every operation in it", () => {
    const spec = openApiSpec();
    const operations = Object.values(spec.paths).flatMap((methods) =>
      Object.values(methods),
    );
    assert.equal(operations.length, ENDPOINTS.length);
  });
});

describe("scopes that depend on the request", () => {
  const scopeOf = (method: string, path: string) => {
    const found = matchEndpoint(method, path);
    assert.equal(found.kind, "found");
    return found.kind === "found" ? found.endpoint.scope : null;
  };

  test("a run sheet beyond the line-up needs gigs:sensitive", () => {
    const scope = scopeOf("POST", "/gigs");
    assert.deepEqual(requiredScopes(scope, { runSheet: [{ kind: "SET" }] }), [
      "gigs:write",
    ]);
    assert.deepEqual(requiredScopes(scope, { runSheet: [{ kind: "DOORS" }] }), [
      "gigs:write",
      "gigs:sensitive",
    ]);
  });

  test("cancelling an event needs events:cancel", () => {
    const scope = scopeOf("POST", "/events/ev1/status");
    assert.deepEqual(requiredScopes(scope, { status: "PUBLISHED" }), [
      "events:write",
    ]);
    assert.deepEqual(requiredScopes(scope, { status: "CANCELLED" }), [
      "events:write",
      "events:cancel",
    ]);
  });
});

describe("presets", () => {
  test("only name real scopes", () => {
    for (const preset of SCOPE_PRESETS) {
      for (const scope of preset.scopes) assert.ok(isApiScope(scope), scope);
    }
  });

  test("read only holds nothing that writes or reveals people", () => {
    const readOnly = SCOPE_PRESETS.find((p) => p.label === "Read only");
    const flagged = ALL_SCOPES.filter((entry) => entry.dangerous).map(
      (entry) => entry.scope,
    );
    for (const scope of readOnly?.scopes ?? []) {
      assert.ok(scope.endsWith(":read"), scope);
      assert.ok(!flagged.includes(scope), scope);
    }
  });
});

describe("updates from the activity log", () => {
  test("gig activity names its gig", () => {
    assert.deepEqual(updateFromActivity("GIG_PUBLISHED", { gigId: "g1" }), {
      type: "gig.published",
      gigId: "g1",
    });
    assert.equal(updateFromActivity("GIG_UPDATED", {}), null);
  });

  test("a status change is told apart from other event activity", () => {
    assert.deepEqual(
      updateFromActivity("TICKET_EVENT_UPDATED", {
        eventId: "e1",
        status: "SALES_PAUSED",
      }),
      {
        type: "event.status_changed",
        eventId: "e1",
        data: { status: "SALES_PAUSED" },
      },
    );
    // Expiring holds logs as an event update too, and is not one.
    assert.equal(
      updateFromActivity("TICKET_EVENT_UPDATED", { eventId: "e1" }),
      null,
    );
  });

  test("refunds carry the amount when there is one", () => {
    assert.deepEqual(
      updateFromActivity("TICKET_ORDER_REFUNDED", {
        orderId: "o1",
        amountCents: 2500,
      }),
      { type: "order.refunded", orderId: "o1", data: { amountCents: 2500 } },
    );
  });

  test("activity the feed has no type for is left out", () => {
    assert.equal(updateFromActivity("API_KEY_CREATED", { keyId: "k" }), null);
  });
});

describe("sales milestones", () => {
  test("fire once, as the line is crossed", () => {
    assert.deepEqual(milestonesCrossed(20, 30, 100), [25]);
    assert.deepEqual(milestonesCrossed(25, 30, 100), []);
    assert.deepEqual(milestonesCrossed(70, 100, 100), [75, 90, 100]);
  });

  test("need a capacity and a sale", () => {
    assert.deepEqual(milestonesCrossed(0, 10, 0), []);
    assert.deepEqual(milestonesCrossed(10, 10, 100), []);
  });
});
