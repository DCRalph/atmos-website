import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  callArgsSchema,
  closeOff,
  parseToolArgs,
  type WillGptMessage,
} from "./will-gpt";

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

describe("closeOff", () => {
  const call = (id: string) => ({ id, name: "call", arguments: "{}" });
  const transcript: WillGptMessage[] = [
    { role: "user", text: "Add two gigs and delete one" },
    {
      role: "assistant",
      text: "",
      toolCalls: [call("ran"), call("interrupted"), call("waiting")],
    },
    { role: "tool", callId: "ran", status: "ok", output: "{}" },
  ];

  test("marks calls with no result as interrupted, except those awaiting approval", () => {
    const closed = closeOff(transcript, ["waiting"]);
    const results = closed.flatMap((message) =>
      message.role === "tool" ? [[message.callId, message.status]] : [],
    );
    assert.deepEqual(results, [
      ["ran", "ok"],
      ["interrupted", "error"],
    ]);
  });
});
