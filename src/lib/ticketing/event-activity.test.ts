import { describe, expect, test } from "bun:test";

import {
  decodeActivityCursor,
  encodeActivityCursor,
  mergeActivityPage,
} from "./event-activity";

const row = (minute: number, id: string) => ({
  at: new Date(Date.UTC(2026, 10, 18, 9, minute)),
  id,
});

describe("mergeActivityPage", () => {
  test("interleaves sources newest first and cuts at the limit", () => {
    const orders = [row(5, "o2"), row(1, "o1")];
    const scans = [row(4, "s2"), row(3, "s1")];
    const page = mergeActivityPage([orders, scans], 3);
    expect(page.items.map((item) => item.id)).toEqual(["o2", "s2", "s1"]);
    expect(page.nextCursor).toBe(encodeActivityCursor(row(3, "s1")));
  });

  test("a full source means there may be more, even if the page isn't cut", () => {
    const page = mergeActivityPage([[row(2, "a"), row(1, "b")], []], 2);
    expect(page.nextCursor).toBe(encodeActivityCursor(row(1, "b")));
  });

  test("short sources end the feed", () => {
    const page = mergeActivityPage([[row(2, "a")], [row(1, "b")]], 3);
    expect(page.items.length).toBe(2);
    expect(page.nextCursor).toBe(null);
  });

  test("rows in the same millisecond are ordered by id", () => {
    const page = mergeActivityPage([[row(1, "a")], [row(1, "b")]], 5);
    expect(page.items.map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("activity cursor", () => {
  test("round-trips", () => {
    const cursor = row(7, "cm123");
    expect(decodeActivityCursor(encodeActivityCursor(cursor))).toEqual(cursor);
  });

  test("rejects anything it didn't write", () => {
    expect(decodeActivityCursor("nonsense")).toBe(null);
    expect(decodeActivityCursor("not-a-date|id")).toBe(null);
    expect(decodeActivityCursor(undefined)).toBe(null);
  });
});
