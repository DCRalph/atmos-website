import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  continuesBlock,
  groupReactions,
  receiptAnchorId,
  REACTIONS,
  seenBy,
  type Member,
  type ReactionRow,
} from "./room";

const [THUMB, , EYES] = REACTIONS;

const at = (hhmm: string) => new Date(`2026-08-26T${hhmm}:00+12:00`);

describe("groupReactions", () => {
  const rows: ReactionRow[] = [
    { emoji: EYES, userId: "u2", userName: "Priya" },
    { emoji: THUMB, userId: "u1", userName: "Will" },
    { emoji: THUMB, userId: "me", userName: "You" },
  ];

  test("draws in the fixed order, not by count, so chips never move", () => {
    const groups = groupReactions(rows, "me");
    assert.deepEqual(
      groups.map((group) => group.emoji),
      [THUMB, EYES],
    );
  });

  test("counts, names, and knows whether the viewer is in it", () => {
    const [thumb, eyes] = groupReactions(rows, "me");
    assert.equal(thumb?.count, 2);
    assert.equal(thumb?.mine, true);
    assert.deepEqual(thumb?.names, ["Will", "You"]);
    assert.equal(eyes?.mine, false);
  });

  test("drops an emoji that is no longer in the set", () => {
    const stale = groupReactions(
      [{ emoji: "\u{1F389}", userId: "u1", userName: "Will" }],
      "me",
    );
    assert.deepEqual(stale, []);
  });
});

describe("seenBy", () => {
  const members: Member[] = [
    { id: "me", name: "You", lastReadAt: at("21:20") },
    { id: "u1", name: "Will", lastReadAt: at("21:20") },
    { id: "u2", name: "Priya", lastReadAt: at("21:05") },
    { id: "u3", name: "Marcus", lastReadAt: null },
  ];

  test("excludes the author from both the names and the total", () => {
    const result = seenBy(members, { createdAt: at("21:10"), authorId: "me" });
    assert.deepEqual(result.names, ["Will"]);
    // Four members, minus the author. Not four.
    assert.equal(result.total, 3);
  });

  test("a mark exactly on the message counts as read", () => {
    const result = seenBy(members, { createdAt: at("21:20"), authorId: "me" });
    assert.deepEqual(result.names, ["Will"]);
  });

  test("somebody who has never opened the room has not seen it", () => {
    const result = seenBy(members, { createdAt: at("20:00"), authorId: "me" });
    assert.deepEqual(result.names, ["Will", "Priya"]);
  });
});

describe("receiptAnchorId", () => {
  const mine = { id: "m3", authorId: "me" };
  const theirs = { id: "m4", authorId: "u1" };

  test("is the viewer's message when it is the newest", () => {
    assert.equal(receiptAnchorId([theirs, mine], "me"), "m3");
  });

  test("is nothing once somebody has replied underneath", () => {
    assert.equal(receiptAnchorId([mine, theirs], "me"), null);
  });

  test("is nothing in an empty room", () => {
    assert.equal(receiptAnchorId([], "me"), null);
  });
});

describe("continuesBlock", () => {
  const will = (hhmm: string) => ({ authorId: "u1", createdAt: at(hhmm) });

  test("a follow-up thought joins the block", () => {
    assert.equal(continuesBlock(will("21:00"), will("21:03")), true);
  });

  test("coming back later starts a new one", () => {
    assert.equal(continuesBlock(will("21:00"), will("21:06")), false);
  });

  test("a different person always starts a new one", () => {
    assert.equal(
      continuesBlock(will("21:00"), { authorId: "u2", createdAt: at("21:01") }),
      false,
    );
  });

  test("the first message of a room has nothing to join", () => {
    assert.equal(continuesBlock(undefined, will("21:00")), false);
  });
});
