import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import {
  readChatSession,
  recoverChatSession,
  writeChatSession,
} from "./will-gpt-session";

const storage = (value: unknown) => ({ getItem: () => JSON.stringify(value) });
const pending = {
  id: crypto.randomUUID(),
  text: "Create the gig",
  fileNames: ["announcement.pdf"],
};

describe("chat recovery", () => {
  test("restores unsaved submissions and keeps the next draft", () => {
    const saved = readChatSession(
      storage({ input: "Next question", pending }),
      "chat",
    );
    const recovered = recoverChatSession(saved, []);
    assert.equal(recovered.session.input, "Create the gig\n\nNext question");
    assert.equal(recovered.session.pending, null);
    assert.equal(recovered.missingFiles, true);
    assert.equal(
      recoverChatSession(recovered.session, []).session.input,
      recovered.session.input,
    );
  });

  test("does not offer a saved request for retry, even when its reply was interrupted", () => {
    const saved = readChatSession(
      storage({ input: "Next question", pending }),
      "chat",
    );
    const recovered = recoverChatSession(saved, [
      { role: "user", id: pending.id, text: pending.text },
    ]);
    assert.equal(recovered.received, true);
    assert.equal(recovered.session.input, "Next question");
    assert.equal(recovered.missingFiles, false);
  });

  test("matches request identity rather than repeated message text", () => {
    const saved = readChatSession(storage({ pending }), "chat");
    assert.equal(
      recoverChatSession(saved, [
        { role: "user", id: crypto.randomUUID(), text: pending.text },
      ]).received,
      false,
    );
  });

  test("recovers approval interruptions without inventing a user message", () => {
    const saved = readChatSession(
      storage({ responding: true, input: "A draft" }),
      "chat",
    );
    assert.deepEqual(recoverChatSession(saved, []).session, {
      ...saved,
      responding: false,
      input: "A draft",
      pending: null,
    });
  });

  test("keeps compatible settings and falls back on damaged values", () => {
    const id = crypto.randomUUID();
    const parsed = readChatSession(
      storage({
        conversationId: id,
        open: true,
        width: 500,
        model: "removed",
        pending: {},
      }),
      "chat",
    );
    assert.deepEqual(parsed, {
      ...parsed,
      conversationId: id,
      open: true,
      width: 500,
      model: "z-ai/glm-5.3-flash",
      pending: null,
    });
    assert.equal(
      readChatSession({ getItem: () => "{broken" }, "chat").input,
      "",
    );
  });

  test("storage failures do not prevent using the chat", () => {
    const session = readChatSession(
      {
        getItem: () => {
          throw new Error("Disabled");
        },
      },
      "chat",
    );
    assert.ok(session.conversationId);
    assert.doesNotThrow(() =>
      writeChatSession(
        {
          setItem: () => {
            throw new Error("Quota");
          },
        },
        "chat",
        session,
      ),
    );
  });
});
