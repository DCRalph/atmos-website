import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { hasScope, permissionsToScopes, scopesToPermissions } from "./scopes";

describe("scopes", () => {
  test("round-trip through the plugin's shape", () => {
    const permissions = scopesToPermissions([
      "notifications:topic",
      "notifications:direct",
      "notifications:topic",
    ]);
    assert.deepEqual(permissions, { notifications: ["topic", "direct"] });
    assert.deepEqual(permissionsToScopes(permissions), [
      "notifications:topic",
      "notifications:direct",
    ]);
  });

  test("unknown stored scopes are dropped, not shown", () => {
    assert.deepEqual(
      permissionsToScopes({
        notifications: ["topic", "launch"],
        tickets: ["read"],
      }),
      ["notifications:topic"],
    );
  });

  test("hasScope needs the exact action", () => {
    const permissions = scopesToPermissions(["notifications:topic"]);
    assert.equal(hasScope(permissions, "notifications:topic"), true);
    assert.equal(hasScope(permissions, "notifications:announce"), false);
    assert.equal(hasScope(null, "notifications:topic"), false);
  });
});
