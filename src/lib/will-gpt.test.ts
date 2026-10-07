import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { callArgsSchema, parseToolArgs } from "./will-gpt";

describe("parseToolArgs", () => {
  test("unwraps an input sent as a JSON string, as some models do", () => {
    const args = parseToolArgs(
      callArgsSchema,
      JSON.stringify({
        path: "gigs.getAll",
        summary: "Search gigs for Froth",
        input: '{"search": "Froth"}',
      }),
    );
    assert.ok(args.ok);
    assert.deepEqual(args.data.input, { search: "Froth" });
  });

  test("says when the arguments are not JSON at all", () => {
    const args = parseToolArgs(callArgsSchema, '{"path": "gigs.create",');
    assert.ok(!args.ok);
    assert.match(args.error, /not valid JSON/);
  });
});
