import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { applyPatch, patchOf, patchRows } from "./patch-input";

// Shaped like a run sheet row: a required field, a defaulted list, a nullable.
const ROW = z.object({
  id: z.string().optional(),
  kind: z.enum(["SET", "DOORS"]),
  leadMinutes: z.array(z.number()).default([]),
  notes: z.string().nullish(),
});
const LIST = z.array(ROW).superRefine((rows, ctx) => {
  if (rows.filter((row) => row.kind === "DOORS").length > 1) {
    ctx.addIssue({ code: "custom", message: "One doors row" });
  }
});

describe("patchOf", () => {
  test("a field left out stays out, even one with a default", () => {
    assert.deepEqual(patchOf(ROW).parse({}), {});
    // What `.partial()` alone does, which is why this exists.
    assert.deepEqual(ROW.partial().parse({}), { leadMinutes: [] });
  });

  test("a field given is still validated", () => {
    assert.equal(patchOf(ROW).safeParse({ kind: "ENCORE" }).success, false);
  });

  test("keeps the field types", () => {
    type Patch = z.output<ReturnType<typeof patchOf<typeof ROW.shape>>>;
    // @ts-expect-error kind is still the enum, only optional
    const wrong: Patch = { kind: "ENCORE" };
    void wrong;
  });
});

describe("applyPatch", () => {
  test("undefined keeps the stored value and null clears it", () => {
    const stored = { title: "Old", notes: "Keep" as string | null, cap: 10 };
    assert.deepEqual(
      applyPatch(stored, { title: "New", notes: null, cap: undefined }),
      { title: "New", notes: null, cap: 10 },
    );
  });
});

describe("patchRows", () => {
  const stored = new Map([
    ["a", { id: "a", kind: "SET", leadMinutes: [15, 5], notes: "Loud" }],
    ["b", { id: "b", kind: "DOORS", leadMinutes: [], notes: null }],
  ]);

  test("a row naming a stored row keeps what it leaves out", () => {
    const rows = patchRows(LIST, stored, [
      { id: "b" },
      { id: "a", notes: "Quiet" },
    ]);
    assert.deepEqual(rows, [
      { id: "b", kind: "DOORS", leadMinutes: [], notes: null },
      { id: "a", kind: "SET", leadMinutes: [15, 5], notes: "Quiet" },
    ]);
  });

  test("remove drops a row, and new rows take the defaults", () => {
    const rows = patchRows(LIST, stored, [
      { id: "a" },
      { id: "b", remove: true },
      { kind: "SET" },
    ]);
    assert.deepEqual(rows, [
      { id: "a", kind: "SET", leadMinutes: [15, 5], notes: "Loud" },
      { kind: "SET", leadMinutes: [] },
    ]);
  });

  test("an incomplete new row or a broken list is a bad request", () => {
    const badRequest = (error: unknown) =>
      error instanceof TRPCError && error.code === "BAD_REQUEST";
    assert.throws(() => patchRows(LIST, stored, [{ notes: "?" }]), badRequest);
    assert.throws(
      () => patchRows(LIST, stored, [{ id: "b" }, { kind: "DOORS" }]),
      badRequest,
    );
  });
});
