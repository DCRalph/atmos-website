import { describe, mock, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { reportDocument } from "./document";
import { decryptReport, encryptReport } from "./encryption";
import { ReportFrame } from "~/components/admin/reports/report-frame";
import { MAX_REPORT_BYTES } from "~/lib/reports";
import { isOffered, riskOf } from "~/server/will-gpt/policy";

describe("report documents", () => {
  test("preserves responsive CSS, SVG charts and tables while removing active content and navigation", () => {
    const html = reportDocument(
      'Sales <report> & "figures"',
      `<html><head><style>.stats{display:grid}@media(max-width:400px){.stats{display:block}}</style><script>window.parent.hacked=true</script><meta http-equiv="refresh" content="0;url=https://example.com"><base href="https://example.com"></head><body onload="alert(1)"><h1>Sales</h1><svg viewBox="0 0 400 100" role="img" aria-label="Sales"><rect x="0" y="0" width="60" height="10" fill="#c6ff33"/><text x="5" y="30">$120</text></svg><table><tr><th>Tickets</th><td>12</td></tr></table><a href="javascript:alert(1)" target="_top">Source</a><img src="https://example.com/private" onerror="alert(1)"><iframe src="/admin"></iframe><form action="/api"><input name="secret"></form></body></html>`,
    );
    assert.match(html, /Sales &lt;report&gt; &amp; &quot;figures&quot;/);
    assert.match(html, /viewBox="0 0 400 100"/);
    assert.match(html, /<td>12<\/td>/);
    assert.match(html, /@media\(max-width:400px\)/);
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /script-src 'none'/);
    assert.doesNotMatch(
      html,
      /<script|onload=|onerror=|http-equiv="refresh"|<base|href=|<iframe|<form|<input|https:\/\/example/,
    );
    assert.ok(
      html.indexOf("Content-Security-Policy") <
        html.indexOf(".stats{display:grid}"),
    );
    const frame = renderToStaticMarkup(
      <ReportFrame html={html} title="Sales" />,
    );
    assert.match(frame, /sandbox="allow-same-origin"/);
    assert.doesNotMatch(frame, /allow-scripts| src="/);
  });

  test("rejects oversized UTF-8 documents and documents without readable content", () => {
    assert.throws(
      () => reportDocument("Too large", "é".repeat(MAX_REPORT_BYTES / 2 + 1)),
      /1 MB/,
    );
    assert.throws(
      () => reportDocument("Empty", "<script>alert(1)</script>"),
      /readable content/,
    );
  });
});

test("stored reports are opaque in R2 and authenticated against the report id, key and bytes", () => {
  const html = "<h1>Private ticket sales: $12,480</h1>";
  const encrypted = encryptReport(html, "report-id", "test-secret");
  assert.equal(decryptReport(encrypted, "report-id", "test-secret"), html);
  assert.ok(!encrypted.includes(Buffer.from("Private ticket sales")));
  assert.notDeepEqual(
    encrypted,
    encryptReport(html, "report-id", "test-secret"),
  );
  assert.throws(() => decryptReport(encrypted, "other-report", "test-secret"));
  assert.throws(() => decryptReport(encrypted, "report-id", "wrong-secret"));
  const modified = Buffer.from(encrypted);
  modified[modified.length - 1] = modified[modified.length - 1]! ^ 1;
  assert.throws(() => decryptReport(modified, "report-id", "test-secret"));
});

// No test can contact the bucket; the router is exercised with an in-memory object store.
mock.module("server-only", () => ({}));
const r2 = await import("~/server/uploads/r2");
const objects = new Map<string, Buffer>();
mock.module("~/server/uploads/r2", () => ({
  ...r2,
  putBuffer: ({ key, body }: { key: string; body: Buffer }) => {
    objects.set(key, body);
    return Promise.resolve();
  },
  getObjectBuffer: (key: string) => {
    const body = objects.get(key);
    return body
      ? Promise.resolve(body)
      : Promise.reject(new Error("Not found"));
  },
  deleteObject: (key: string) => {
    objects.delete(key);
    return Promise.resolve();
  },
}));
const { reportsRouter } = await import("~/server/api/routers/reports");
import type { PrismaClient } from "~Prisma/client";
import type { createTRPCContext } from "~/server/api/trpc";

test("admin report creation stores HTML in R2, links its source, reads back through the wrapper API and cleans up failed saves", async () => {
  const conversationId = crypto.randomUUID();
  const user = {
    id: "admin-id",
    name: "William Giles",
    image: null,
    permissions: [{ permission: "ADMIN" }],
  };
  let conversationOwner = user.id;
  let failSave = false;
  let saved: {
    id: string;
    title: string;
    objectKey: string;
    byteSize: number;
    userId: string;
    conversationId: string;
    createdAt: Date;
    user: typeof user;
  } | null = null;
  const db = {
    user: { findUnique: () => Promise.resolve(user) },
    willGptConversation: {
      findUnique: () => Promise.resolve({ userId: conversationOwner }),
    },
    htmlReport: {
      create: ({
        data,
      }: {
        data: Omit<NonNullable<typeof saved>, "createdAt" | "user">;
      }) => {
        if (failSave) return Promise.reject(new Error("Database unavailable"));
        saved = { ...data, createdAt: new Date(), user };
        return Promise.resolve({
          id: saved.id,
          title: saved.title,
          createdAt: saved.createdAt,
          conversationId: saved.conversationId,
          user,
        });
      },
      findUnique: () => Promise.resolve(saved),
    },
  } as unknown as PrismaClient;
  const ctx = {
    db,
    session: { user: { id: user.id } },
    headers: new Headers(),
  } as Awaited<ReturnType<typeof createTRPCContext>>;
  const caller = reportsRouter.createCaller(ctx);
  const input = {
    title: "October ticket sales",
    conversationId,
    html: "<h1>October</h1><p>Ticket revenue: $12,480</p>",
  };
  const created = await caller.create(input);
  assert.equal(created.url, `/admin/reports/${created.id}`);
  assert.ok(!("objectKey" in created));
  assert.equal(created.conversationId, conversationId);
  const loaded = await caller.byId({ id: created.id });
  assert.match(loaded.html, /Ticket revenue: \$12,480/);
  assert.ok(!("objectKey" in loaded));
  assert.equal(objects.size, 1);
  assert.ok(isOffered("reports.create", "mutation", { permission: "ADMIN" }));
  assert.equal(riskOf("reports.create", "mutation"), "write");

  failSave = true;
  await assert.rejects(caller.create(input), /Database unavailable/);
  assert.equal(objects.size, 1);
  conversationOwner = "other-admin";
  await assert.rejects(caller.create(input), /own conversation/);
  assert.equal(objects.size, 1);
  user.permissions = [];
  await assert.rejects(caller.byId({ id: created.id }), /permission required/);
  await assert.rejects(caller.list({}), /permission required/);
  await assert.rejects(caller.create(input), /permission required/);
  const signedOut = reportsRouter.createCaller({ ...ctx, session: null });
  await assert.rejects(
    signedOut.byId({ id: created.id }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "UNAUTHORIZED",
  );
});
