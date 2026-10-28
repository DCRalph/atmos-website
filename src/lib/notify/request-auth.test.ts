import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { presentedCredential } from "./request-auth";

function credential(headers: Record<string, string>, query = "") {
  return presentedCredential(new Headers(headers), new URLSearchParams(query));
}

const base64 = (value: string) => Buffer.from(value).toString("base64");

describe("presented credential", () => {
  test("bearer", () => {
    assert.equal(
      credential({ authorization: "Bearer atmos_abc" }),
      "atmos_abc",
    );
  });

  test("basic, where the password is the key", () => {
    assert.equal(
      credential({ authorization: `Basic ${base64("kuma:atmos_abc")}` }),
      "atmos_abc",
    );
  });

  test("?auth= carries the whole header, base64url", () => {
    const auth = base64("Bearer atmos_abc")
      .replaceAll("+", "-")
      .replaceAll("/", "_");
    assert.equal(credential({}, `auth=${auth}`), "atmos_abc");
  });

  test("nothing usable", () => {
    assert.equal(credential({}), null);
    assert.equal(credential({ authorization: "Bearer " }), null);
    assert.equal(credential({ authorization: "Token atmos_abc" }), null);
  });
});
