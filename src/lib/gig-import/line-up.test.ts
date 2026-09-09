import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { unresolvedHandles } from "./line-up";

/**
 * Step three of the import wizard asks the admin about every name the post
 * billed that nobody stands behind. Getting this wrong either nags about a
 * name that is already sorted, or quietly drops one off the bill.
 */

const handles = (result: { handle: string }[]) =>
  result.map((entry) => entry.handle);

describe("unresolvedHandles", () => {
  test("a slot nobody matched is still waiting", () => {
    assert.deepEqual(handles(unresolvedHandles([{ handles: ["teiko"] }], [])), [
      "teiko",
    ]);
  });

  test("a filled slot is answered", () => {
    assert.deepEqual(
      unresolvedHandles(
        [{ handles: ["teiko"] }],
        [{ sortOrder: 0, artistCount: 1 }],
      ),
      [],
    );
  });

  test("an existing profile under a different handle answers it", () => {
    // @teiko was pointed at @tk. No profile will ever carry "teiko", so this
    // has to be answered by the slot being filled, not by a handle lookup.
    assert.deepEqual(
      unresolvedHandles(
        [{ handles: ["teiko"] }],
        [{ sortOrder: 0, artistCount: 1 }],
      ),
      [],
    );
  });

  test("a back to back with one of two filled still wants the other", () => {
    assert.deepEqual(
      handles(
        unresolvedHandles(
          [{ handles: ["wickedjay", "nvrland"] }],
          [{ sortOrder: 0, artistCount: 1 }],
        ),
      ),
      ["nvrland"],
    );
  });

  test("reports which slot a name belongs to, so it lands in the right one", () => {
    assert.deepEqual(
      unresolvedHandles(
        [{ handles: ["kaia"] }, { handles: ["teiko"] }],
        [{ sortOrder: 0, artistCount: 1 }],
      ),
      [{ handle: "teiko", slotIndex: 1 }],
    );
  });

  test("a slot filled beyond what the post named asks for nothing", () => {
    assert.deepEqual(
      unresolvedHandles(
        [{ handles: ["kaia"] }],
        [{ sortOrder: 0, artistCount: 2 }],
      ),
      [],
    );
  });
});
