import { z } from "zod";
import { WILL_GPT_MODELS, type WillGptMessage } from "./will-gpt";

export const CHAT_WIDTH = { min: 340, max: 760, initial: 412 } as const;

const sessionSchema = z.object({
  open: z.boolean().catch(false),
  model: z
    .enum(WILL_GPT_MODELS.map((model) => model.id))
    .catch(WILL_GPT_MODELS[0].id),
  conversationId: z.uuid().catch(() => crypto.randomUUID()),
  width: z
    .number()
    .min(CHAT_WIDTH.min)
    .max(CHAT_WIDTH.max)
    .catch(CHAT_WIDTH.initial),
  input: z.string().catch(""),
  responding: z.boolean().catch(false),
  fileNames: z.array(z.string()).catch([]),
  pending: z
    .object({
      id: z.uuid(),
      text: z.string(),
      fileNames: z.array(z.string()),
    })
    .nullable()
    .catch(null),
});

export type WillGptSession = z.infer<typeof sessionSchema>;

/** Storage can be unavailable or full. Chat still works for the current visit. */
export function readChatSession(
  storage: Pick<Storage, "getItem">,
  key: string,
): WillGptSession {
  try {
    return sessionSchema.parse(JSON.parse(storage.getItem(key) ?? "{}"));
  } catch {
    return sessionSchema.parse({});
  }
}

export function writeChatSession(
  storage: Pick<Storage, "setItem">,
  key: string,
  session: WillGptSession,
) {
  try {
    storage.setItem(key, JSON.stringify(session));
  } catch {
    // Private browsing and quota errors must not prevent sending or resetting.
  }
}

/** Never offer an interrupted request for retry if the server already saved it. */
export function recoverChatSession(
  session: WillGptSession,
  messages: WillGptMessage[],
) {
  const pending = session.pending;
  if (!pending)
    return {
      session: { ...session, responding: false },
      received: false,
      missingFiles: false,
    };
  const received = messages.some(
    (message) => message.role === "user" && message.id === pending.id,
  );
  return {
    session: {
      ...session,
      input: received
        ? session.input
        : [pending.text, session.input].filter(Boolean).join("\n\n"),
      fileNames: received
        ? session.fileNames
        : pending.fileNames.length
          ? pending.fileNames
          : session.fileNames,
      pending: null,
      responding: false,
    },
    received,
    missingFiles: !received && pending.fileNames.length > 0,
  };
}
