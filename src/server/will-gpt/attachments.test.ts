import { describe, expect, mock, test } from "bun:test";
import OpenAI from "openai";
import assert from "node:assert/strict";
import { initTRPC } from "@trpc/server";
import { z } from "zod";

import { readDocument, readTextAttachment } from "./attachment-content";
// Bun runs outside React; the server-only marker is a no-op in the server runtime.
mock.module("server-only", () => ({}));
const { runWillGpt } = await import("./agent");
const { ownAttachment } = await import("./attachments");
import type { PrismaClient } from "~Prisma/client";
import { readMessages } from "./conversations";
import { willGptRunInputSchema, type WillGptMessage } from "~/lib/will-gpt";
import { presetConstraints } from "~/lib/uploads/presets";
import { validateBatch } from "~/lib/uploads/validate";
import type { createTRPCContext, ProcedureMeta } from "~/server/api/trpc";

const announcement =
  "Atmos Halloween\n31 October 2026, 9pm\nMoon Bar, Wellington\nFeaturing DJ Example\nTickets $20";

describe("attachment reading", () => {
  test("refuses an unavailable attachment and scopes the lookup to its uploader and conversation", async () => {
    const queries: unknown[] = [];
    const db = {
      file_upload: {
        findFirst: (query: unknown) => {
          queries.push(query);
          return Promise.resolve(null);
        },
      },
    } as unknown as PrismaClient;
    await assert.rejects(
      ownAttachment(db, "file-id", "conversation-id", "admin-id"),
      /not available/,
    );
    assert.deepEqual(queries, [
      {
        where: {
          id: "file-id",
          userId: "admin-id",
          forId: "conversation-id",
          preset: "willGptAttachment",
          status: "OK",
        },
      },
    ]);
  });

  test("reads UTF-8 announcements and rejects binary, empty and oversized input without truncation", () => {
    expect(readTextAttachment(Buffer.from(announcement))).toBe(announcement);
    expect(() => readTextAttachment(Buffer.from([0xff, 0xfe]))).toThrow(
      "UTF-8",
    );
    expect(() => readTextAttachment(Buffer.from("data\0binary"))).toThrow(
      "not a text",
    );
    expect(() => readTextAttachment(Buffer.from(" \n"))).toThrow(
      "no readable text",
    );
    expect(() => readTextAttachment(Buffer.from("x".repeat(100_001)))).toThrow(
      "too long",
    );
  });

  test("sends PDF bytes through the parser and images through vision, rejecting incomplete extraction", async () => {
    const requests: {
      plugins?: unknown;
      messages: { content: unknown[] }[];
    }[] = [];
    let finishReason = "stop";
    const client = new OpenAI({
      apiKey: "test",
      fetch: (_url, init) => {
        assert.equal(typeof init?.body, "string");
        requests.push(
          JSON.parse(init?.body as string) as (typeof requests)[number],
        );
        return Promise.resolve(
          Response.json({
            choices: [
              {
                finish_reason: finishReason,
                message: { role: "assistant", content: announcement },
              },
            ],
          }),
        );
      },
    });
    const pdf = Buffer.from("%PDF-1.4\nfixture");
    const common = { client, model: "test-reader" };
    expect(
      await readDocument({
        ...common,
        file: { name: "announcement.pdf", mimeType: "application/pdf" },
        body: pdf,
      }),
    ).toBe(announcement);
    assert.deepEqual(requests[0]?.plugins, [
      { id: "file-parser", pdf: { engine: "cloudflare-ai" } },
    ]);
    assert.deepEqual(requests[0]?.messages[0]?.content[1], {
      type: "file",
      file: {
        filename: "announcement.pdf",
        file_data: `data:application/pdf;base64,${pdf.toString("base64")}`,
      },
    });
    await readDocument({
      ...common,
      file: { name: "poster.webp", mimeType: "image/webp" },
      body: Buffer.from("image"),
    });
    assert.deepEqual(requests[1]?.messages[0]?.content[1], {
      type: "image_url",
      image_url: { url: "data:image/webp;base64,aW1hZ2U=" },
    });
    finishReason = "length";
    await assert.rejects(
      readDocument({
        ...common,
        file: { name: "announcement.pdf", mimeType: "application/pdf" },
        body: pdf,
      }),
      /whole document/,
    );
  });

  test("accepts common text files without a browser MIME type and enforces combined limits", () => {
    const constraints = presetConstraints("willGptAttachment");
    const files = ["txt", "md", "csv", "json", "yaml", "pdf"].map(
      (extension) => ({
        name: `announcement.${extension}`,
        size: 100,
        type: "",
      }),
    );
    expect(validateBatch(files, constraints).rejected).toEqual([]);
    expect(
      validateBatch(
        [{ name: "installer.exe", size: 100, type: "" }],
        constraints,
      ).accepted,
    ).toEqual([]);
    expect(
      validateBatch(files, constraints, { count: 8, size: 800 }).accepted,
    ).toEqual([]);
    expect(
      validateBatch(files, constraints, { count: 1, size: 50 * 1024 * 1024 })
        .accepted,
    ).toEqual([]);
    expect(
      willGptRunInputSchema.safeParse({
        conversationId: crypto.randomUUID(),
        model: "z-ai/glm-5.3-flash",
        page: "/admin",
        message: "Read this",
        attachmentIds: Array.from({ length: 9 }, () => crypto.randomUUID()),
      }).success,
    ).toBe(false);
  });
});

test("a saved PDF announcement reaches the gig creation tools and remains available on subsequent turns", async () => {
  const id = crypto.randomUUID();
  const messages: WillGptMessage[] = readMessages([
    {
      role: "user",
      text: "Read this PDF and create the gig.",
      attachments: [
        {
          id,
          name: "announcement.pdf",
          mimeType: "application/pdf",
          size: 100,
          content: announcement,
        },
      ],
    },
  ]);
  const t = initTRPC.meta<ProcedureMeta>().create();
  const created: unknown[] = [];
  const router = t.router({
    gigs: t.router({
      create: t.procedure
        .meta({ permission: "ADMIN" })
        .input(
          z.object({
            title: z.string(),
            gigStartTime: z.date(),
            venue: z.string(),
          }),
        )
        .mutation(({ input }) => {
          created.push(input);
          return { id: "test-gig", ...input };
        }),
    }),
  });
  let turn = 0;
  const client = new OpenAI({
    apiKey: "test",
    fetch: (_url, init) => {
      assert.equal(typeof init?.body, "string");
      const request = JSON.parse(init?.body as string) as {
        messages: Array<{ role: string; content: string }>;
      };
      const user = request.messages.find((message) => message.role === "user");
      expect(user?.content).toContain(announcement);
      expect(user?.content).toContain(id);
      const calls = [
        {
          id: "describe-create",
          name: "describe",
          arguments: JSON.stringify({ paths: ["gigs.create"] }),
        },
        {
          id: "create-gig",
          name: "call",
          arguments: JSON.stringify({
            path: "gigs.create",
            summary: "Create Atmos Halloween",
            input: {
              title: "Atmos Halloween",
              gigStartTime: "2026-10-31T21:00:00+13:00",
              venue: "Moon Bar",
            },
          }),
        },
      ];
      const call = calls[turn++];
      const delta = call
        ? {
            tool_calls: [
              {
                index: 0,
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: call.arguments },
              },
            ],
          }
        : { content: "Created Atmos Halloween." };
      return Promise.resolve(
        new Response(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      );
    },
  });
  const events = [];
  for await (const event of runWillGpt({
    client,
    router,
    ctx: {} as Awaited<ReturnType<typeof createTRPCContext>>,
    model: "z-ai/glm-5.3-flash",
    messages,
    decisions: {},
    page: "/admin/gigs",
    conversationId: crypto.randomUUID(),
    signal: undefined,
  }))
    events.push(event);
  expect(created).toEqual([
    {
      title: "Atmos Halloween",
      gigStartTime: new Date("2026-10-31T08:00:00Z"),
      venue: "Moon Bar",
    },
  ]);
  assert.ok(
    events.some(
      (event) =>
        event.type === "message" &&
        event.message.role === "tool" &&
        event.message.callId === "create-gig" &&
        event.message.status === "ok" &&
        event.message.risk === "write",
    ),
  );
  expect(turn).toBe(3);
});
