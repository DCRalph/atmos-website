import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { parsePublishRequest } from "./ntfy-request";

/** A publish, with only the parts a given test cares about spelled out. */
function parse({
  path = ["team"],
  query = "",
  headers = {},
  body = "",
}: {
  path?: string[];
  query?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}) {
  return parsePublishRequest({
    pathSegments: path,
    searchParams: new URLSearchParams(query),
    headers: new Headers(headers),
    body,
  });
}

/** Unwraps a parse expected to succeed. */
function ok(result: ReturnType<typeof parse>) {
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.ok(result.ok);
  return result.input;
}

describe("body publish", () => {
  test("the body is the message", () => {
    const input = ok(parse({ body: "Card reader is down" }));
    assert.equal(input.topic, "team");
    assert.equal(input.message, "Card reader is down");
    assert.equal(input.priority, 3);
    assert.equal(input.title, undefined);
  });

  test("an empty publish still says something", () => {
    // ntfy's own stand-in — a notification reading "" is worse than useless.
    assert.equal(ok(parse()).message, "triggered");
  });

  test("a header beats the body", () => {
    const input = ok(
      parse({ headers: { "X-Message": "from header" }, body: "from body" }),
    );
    assert.equal(input.message, "from header");
  });
});

describe("ntfy's header aliases", () => {
  test("the long form", () => {
    const input = ok(
      parse({
        headers: {
          "X-Title": "Side door",
          "X-Priority": "high",
          "X-Tags": "warning,door",
          "X-Click": "https://atmosmedia.co.nz/admin",
        },
        body: "Card reader is down",
      }),
    );
    assert.equal(input.title, "Side door");
    assert.equal(input.priority, 4);
    assert.deepEqual(input.tags, ["warning", "door"]);
    assert.equal(input.click, "https://atmosmedia.co.nz/admin");
  });

  test("the short form", () => {
    const input = ok(
      parse({ headers: { t: "Side door", p: "5", ta: "rotating_light" } }),
    );
    assert.equal(input.title, "Side door");
    assert.equal(input.priority, 5);
    assert.deepEqual(input.tags, ["rotating_light"]);
  });

  test("query params work the same, for a publish from a bare URL", () => {
    const input = ok(
      parse({ query: "title=Side+door&message=Reader+down&priority=min" }),
    );
    assert.equal(input.title, "Side door");
    assert.equal(input.message, "Reader down");
    assert.equal(input.priority, 1);
  });

  test("a header still wins over a query param", () => {
    const input = ok(
      parse({ query: "title=from+query", headers: { Title: "from header" } }),
    );
    assert.equal(input.title, "from header");
  });
});

describe("publish suffixes", () => {
  for (const suffix of ["publish", "send", "trigger"]) {
    test(`/{topic}/${suffix} is the same as /{topic}`, () => {
      assert.equal(
        ok(parse({ path: ["team", suffix], body: "hi" })).topic,
        "team",
      );
    });
  }
});

describe("JSON publish", () => {
  test("topic travels in the body", () => {
    const input = ok(
      parse({
        path: [],
        body: JSON.stringify({
          topic: "door",
          title: "Side door",
          message: "Reader down",
          priority: 4,
          tags: ["warning"],
        }),
      }),
    );
    assert.equal(input.topic, "door");
    assert.equal(input.title, "Side door");
    assert.equal(input.priority, 4);
    assert.deepEqual(input.tags, ["warning"]);
  });

  test("tags are taken as a comma string too", () => {
    const input = ok(
      parse({
        path: [],
        body: JSON.stringify({ topic: "team", tags: "a, b" }),
      }),
    );
    assert.deepEqual(input.tags, ["a", "b"]);
  });

  test("a body with no topic is refused", () => {
    const result = parse({ path: [], body: JSON.stringify({ message: "hi" }) });
    assert.equal(result.ok, false);
  });

  test("a topic in the path means the body is the message, JSON or not", () => {
    const body = JSON.stringify({ topic: "elsewhere", message: "hi" });
    assert.equal(ok(parse({ body })).message, body);
  });
});

describe("refusals", () => {
  test("a topic outside ntfy's character set", () => {
    assert.equal(parse({ path: ["not a topic"] }).ok, false);
  });

  test("multi-topic publish, which is not implemented", () => {
    assert.equal(parse({ path: ["team", "door"] }).ok, false);
  });

  test("a priority outside 1-5", () => {
    assert.equal(parse({ headers: { Priority: "9" } }).ok, false);
    assert.equal(parse({ headers: { Priority: "loud" } }).ok, false);
  });

  test("a message past ntfy's 4096", () => {
    assert.equal(parse({ body: "x".repeat(4097) }).ok, false);
  });
});
